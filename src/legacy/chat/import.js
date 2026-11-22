import { renderChatInterface } from './conversation.js'
import { renderChatList } from './list.js'
import { showChoiceModal, showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export async function handleCardImport(event) {
            const file = event.target.files[0];
            if (!file) return;
        
            try {
                let cardData;
                let avatarBase64 = null; 
        
                if (file.name.endsWith('.json')) {
                    
                    const text = await file.text();
                    cardData = JSON.parse(text);
                } else if (file.name.endsWith('.png')) {
                    
                    const arrayBuffer = await file.arrayBuffer();
                    
                    cardData = await parsePngForTavernData(arrayBuffer);
                    
                    
                    avatarBase64 = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(file);
                    });
                } else {
                    throw new Error("不支持的文件格式。请选择 .json 或 .png 文件。");
                }
        
                
                await createChatFromCardData(cardData, avatarBase64);
        
            } catch (error) {
                console.error("角色卡导入失败:", error);
                await showCustomAlert("Import Failed", `Could not read the character card. Error: ${error.message}`);
            } finally {
                
                event.target.value = null;
            }
        }

export function parsePngForTavernData(arrayBuffer) {
            return new Promise((resolve, reject) => {
                const view = new DataView(arrayBuffer);
                
                if (view.getUint32(0) !== 0x89504E47 || view.getUint32(4) !== 0x0D0A1A0A) {
                    return reject(new Error("文件不是一个有效的PNG。"));
                }
        
                let offset = 8;
                const decoder = new TextDecoder(); 
        
                while (offset < view.byteLength) {
                    const length = view.getUint32(offset);
                    const type = decoder.decode(arrayBuffer.slice(offset + 4, offset + 8));
        
                    if (type === 'tEXt') {
                        const data = new Uint8Array(arrayBuffer, offset + 8, length);
                        const nullSeparatorIndex = data.indexOf(0);
                        if (nullSeparatorIndex !== -1) {
                            const key = decoder.decode(data.slice(0, nullSeparatorIndex));
                            if (key === 'chara') {
                                const value = decoder.decode(data.slice(nullSeparatorIndex + 1));
                                try {
                                    
                                    
                                    
                                    
                                    
                                    const binaryString = atob(value);
                                    
                                    
                                    const bytes = new Uint8Array(binaryString.length);
                                    for (let i = 0; i < binaryString.length; i++) {
                                        bytes[i] = binaryString.charCodeAt(i);
                                    }
                                    
                                    
                                    
                                    const decodedData = new TextDecoder('utf-8').decode(bytes);
                                    
                                    
                                    
                                    resolve(JSON.parse(decodedData));
                                    return; 
                                } catch (e) {
                                    return reject(new Error("在PNG中找到角色数据，但解码或解析失败。错误: " + e.message));
                                }
                            }
                        }
                    }
                    
                    
                    offset += 4 + 4 + length + 4;
                }
        
                reject(new Error("在PNG文件中未找到有效的Tavern AI角色数据(chara chunk)。"));
            });
        }

export function findWorldBookEntries(cardData) {
            
            
            
            
            if (cardData.data?.character_book?.entries?.length > 0) {
                console.log("诊断：在 data.character_book 中找到世界书。");
                return cardData.data.character_book.entries;
            }
            
            
            if (cardData.extensions?.character_book?.entries?.length > 0) {
                console.log("诊断：在 extensions.character_book 中找到世界书。");
                return cardData.extensions.character_book.entries;
            }
            
            
            if (cardData.data?.extensions?.character_book?.entries?.length > 0) {
                console.log("诊断：在 data.extensions.character_book 中找到世界书。");
                return cardData.data.extensions.character_book.entries;
            }
            
            
            const possibleTopLevelKeys = ['character_book', 'lorebook', 'world_info', 'char_book'];
            for (const key of possibleTopLevelKeys) {
                if (cardData[key]?.entries?.length > 0) {
                    console.log(`诊断：在顶层 ${key} 中找到世界书。`);
                    return cardData[key].entries;
                }
            }
        
            console.log("诊断：未在此角色卡中找到任何有效的世界书数据。");
            return null; 
        }

export async function createChatFromCardData(cardData, avatarBase64 = null) {
            const effectiveCardData = cardData.data || cardData;
            if (!effectiveCardData.name) {
                throw new Error("角色卡数据无效或缺少'name'字段。");
            }
        
            let worldBookIdToLink = null;
            const worldBookEntries = findWorldBookEntries(cardData);
        
            if (worldBookEntries) {
                const structuredEntries = worldBookEntries
                    .filter(entry => entry.enabled && entry.content)
                    .map(entry => ({
                        keys: entry.keys || [],
                        comment: entry.comment || '',
                        content: entry.content.replace(/<memory>|<\/memory>/g, '').trim()
                    }));
        
                if (structuredEntries.length > 0) {
                    const newWorldBook = {
                        id: 'wb_' + Date.now(),
                        name: `${effectiveCardData.name}的设定集`,
                        content: structuredEntries,
                        categoryId: null
                    };
                    await runtime.db.worldBooks.add(newWorldBook);
                    runtime.state.worldBooks.push(newWorldBook);
                    worldBookIdToLink = newWorldBook.id;
                }
            }
        
            let description = effectiveCardData.description || cardData.description || '无';
            description = description
                .replace(/```yaml/g, '').replace(/```/g, '')
                .replace(/<\/?info>/g, '').replace(/<\/?character>/g, '')
                .replace(/<\/?writing_rule>/g, '').replace(/\[OOC：.*?\]/g, '').trim();
            let persona = `# 角色核心设定\n${description}\n\n`;
            if (effectiveCardData.personality) persona += `# 性格补充\n${effectiveCardData.personality}\n\n`;
            if (effectiveCardData.scenario) persona += `# 场景设定\n${effectiveCardData.scenario}\n\n`;
            if (effectiveCardData.mes_example) persona += `# 对话示例\n${effectiveCardData.mes_example}\n\n`;

           
            const remarkName = effectiveCardData.name;
            const originalName = effectiveCardData.name;
            
            const newChatId = 'chat_' + Date.now();
            const newChat = {
                id: newChatId,
                name: remarkName.trim(),
                originalName: originalName.trim(),
                isGroup: false,
                relationship: { status: 'friend' },
                status: { text: '在线', lastUpdate: Date.now(), isBusy: false },
                settings: {
                    aiPersona: persona,
                    myPersona: '我是谁呀。',
                    maxMemory: 10,
                    aiAvatar: runtime.defaultAvatar,
                    myAvatar: runtime.defaultAvatar,
                    background: '',
                    theme: 'default',
                    fontSize: 13,
                    customCss: '',
                    linkedWorldBookIds: worldBookIdToLink ? [worldBookIdToLink] : [],
                    aiAvatarLibrary: []
                },
                history: [],
                musicData: { totalTime: 0 },
                longTermMemory: []
            };

            if (avatarBase64) {
                newChat.settings.aiAvatar = avatarBase64;
                newChat.settings.aiAvatarLibrary.push({ name: '默认头像', url: avatarBase64 });
            }

            const greetingHtml = effectiveCardData.first_mes || cardData.first_mes;
            if (greetingHtml && typeof greetingHtml === 'string') {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = greetingHtml;
                const cleanGreeting = (tempDiv.textContent || tempDiv.innerText || "").replace(/原作者UR.*?开局/s, '').trim();
                if (cleanGreeting) {
                    newChat.history.push({
                        role: 'assistant',
                        senderName: newChat.originalName,
                        content: cleanGreeting,
                        timestamp: Date.now()
                    });
                }
            }
            runtime.state.chats[newChatId] = newChat;
            await runtime.db.chats.put(newChat);
            renderChatList();
            let successMessage = `角色 “${newChat.name}” 已成功导入！`;
            if (worldBookIdToLink) {
                successMessage += `\n\n其专属的“世界书”也已自动创建并关联。`;
            }
            await showCustomAlert("Import Complete", successMessage);
        }

export async function handleSwitchGreeting() {
                if (!runtime.state.activeChatId) return;
                const chat = runtime.state.chats[runtime.state.activeChatId];
                const greetings = chat.settings.alternateGreetings;
        
                if (!greetings || greetings.length === 0) {
                    alert("This character has no alternate greetings.");
                    return;
                }
        
                
                const options = greetings.map((text, index) => {
                    
                    const preview = text.replace(/<[^>]*>/g, '').trim().substring(0, 20);
                    return {
                        text: `开场 ${index + 1}: ${preview}...`,
                        value: index 
                    };
                });
        
                
                const selectedIndex = await showChoiceModal('选择一个开场白', options);
        
                
                if (selectedIndex !== null) {
                    
                    const confirmed = await showCustomConfirm(
                        "Confirm Repair",
                        "Switch greetings and replace the current chat history?",
                        { confirmButtonClass: 'btn-danger', confirmText: '确定切换' }
                    );
        
                    if (confirmed) {
                        
                        const newGreetingText = greetings[selectedIndex];
                        
                        const newMessage = {
                            role: 'assistant',
                            senderName: chat.originalName,
                            content: newGreetingText,
                            timestamp: Date.now()
                        };
        
                        
                        chat.history = [newMessage];
                        
                        
                        await runtime.db.chats.put(chat);
        
                        
                        renderChatInterface(chat.id);
                        document.getElementById('chat-settings-modal').classList.remove('visible'); 
                        await showCustomAlert("Success", "Switched to the new greeting.");
                    }
                }
            }

export async function exportSingleChat() {
    if (!runtime.state.activeChatId) return;
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return;

    try {
        const backupData = {
            type: 'EPhoneSingleChat', 
            version: 1,
            chatData: chat
        };

        const blob = new Blob(
            [JSON.stringify(backupData, null, 2)], 
            { type: 'application/json' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        link.download = `EPhone-Chat-${chat.name}-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        await showCustomAlert("Export Complete", `Chat history with “${chat.name}” exported.`);

    } catch (error) {
        console.error("导出单个聊天时出错:", error);
        await showCustomAlert("Export Failed", `An error occurred: ${error.message}`);
    }
}

export async function importSingleChat(file) {
    if (!file || !runtime.state.activeChatId) return;
    const currentChatId = runtime.state.activeChatId;
    const currentChat = runtime.state.chats[currentChatId];

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        
        if (data.type !== 'EPhoneSingleChat' || !data.chatData) {
            throw new Error("文件格式不正确，这不是一个有效的单聊备份文件。");
        }

        
        const confirmed = await showCustomConfirm(
            "Restore Backup?",
            `Restore the backup and replace the chat history and settings for “${currentChat.name}”?`,
            { confirmButtonClass: 'btn-danger', confirmText: '确认覆盖' }
        );

        if (!confirmed) return;

        
        const importedChatData = data.chatData;
        
        
        importedChatData.id = currentChatId; 
        
        
        await runtime.db.chats.put(importedChatData);
        runtime.state.chats[currentChatId] = importedChatData;

        
        await showCustomAlert("Import Complete", "Chat history restored. Refreshing the screen…");
        
        
        renderChatInterface(currentChatId);
        renderChatList();
        document.getElementById('chat-settings-btn').click(); 

    } catch (error) {
        console.error("导入单个聊天时出错:", error);
        await showCustomAlert("Import Failed", `Could not read or apply the file: ${error.message}`);
    }
}
