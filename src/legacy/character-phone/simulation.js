import { newReplyTurn, replyTimestamp } from '../../features/chat/reply-turns'
import { withConversationRequest } from '../../features/chat/sessions'
import { requestContextCompletion } from '../../features/api/completion'
import { getGeminiResponseText, parseAiResponse } from '../api/client.js'
import { renderCharTaobao } from './apps.js'
import { switchToCharScreen } from './launcher.js'
import { renderCharMusicScreen } from './music.js'
import { renderCharMemoList, renderCharSimulatedQQ } from './notes.js'
import { triggerAiResponse } from '../chat/ai.js'
import { createMessageElement } from '../chat/conversation.js'
import { formatTimeAgo } from '../../features/chat/format'
import { renderChatList } from '../chat/list.js'
import { showCustomAlert } from '../dialogs/dialogs.js'
import { hideLoader, showLoader } from '../dialogs/dialogs.js'
import { showNotification } from '../home/status.js'
import { getPlayableSongDetails, searchNeteaseMusic, searchTencentMusic } from '../music/search.js'
import { getGroupStickerContextForPrompt, getStickerContextForPrompt } from '../stickers/stickers.js'
import { runtime } from '../runtime/state.js'

export async function renderCharAlbum() {
            const gridEl = document.getElementById('char-album-grid');
            gridEl.innerHTML = '';
            if (!runtime.activeCharacterId) return;
            const char = runtime.state.chats[runtime.activeCharacterId];
        
            const photos = char.simulatedAlbum || [];
        
            if (photos.length === 0) {
                gridEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">This album is empty.<br>Use Regenerate to generate photos.</p>";
                return;
            }
        
            const fallbackImageUrl = `https://i.postimg.cc/KYr2qRCK/1.jpg`;

            photos.forEach(photo => {
                const item = document.createElement('div');
                item.className = 'char-photo-item';
                item.dataset.description = photo.description;
                gridEl.appendChild(item);

                
                
                
                
                
                
                if (runtime.state.globalSettings.enableAiDrawing) {
                    
                    item.style.backgroundColor = '#e9ecef';
                    const containsNonEnglish = /[^\x00-\x7F]/.test(photo.image_prompt);
                    const isValidPrompt = photo.image_prompt && photo.image_prompt.trim() && !containsNonEnglish;
                    const finalPrompt = isValidPrompt ? photo.image_prompt : 'a beautiful scenery, anime style, cinematic lighting';
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}`;
                    
                    const img = new Image();
                    img.onload = function() { item.style.backgroundImage = `url(${this.src})`; };
                    img.onerror = function() { item.style.backgroundImage = `url(${fallbackImageUrl})`; };
                    img.src = imageUrl;

                } else {
                    
                    item.style.backgroundColor = '#f0f2f5';
                    item.style.border = '1px solid #e0e0e0';
                    
                    const descriptionEl = document.createElement('p');
                    descriptionEl.className = 'char-photo-description';
                    descriptionEl.textContent = photo.description || 'No photo description';
                    
                    item.appendChild(descriptionEl);
                }
            });
        }

export function renderCharBrowserHistory() {
    const listEl = document.getElementById('char-browser-history');
    listEl.innerHTML = '';
    if (!runtime.activeCharacterId) return;

    const char = runtime.state.chats[runtime.activeCharacterId];
    const history = char.simulatedBrowserHistory || [];

    if (history.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No browser history yet.<br>Use Regenerate to create activity.</p>";
        return;
    }

    history.forEach((item, index) => {
        const entryEl = document.createElement('div');
        entryEl.className = 'char-browser-item';
        entryEl.innerHTML = `
            <div class="title">${item.title}</div>
            <div class="url">${item.url}</div>
        `;
        
        entryEl.addEventListener('click', () => openCharArticle(index));
        listEl.appendChild(entryEl);
    });
}

export function renderCharAppUsage() {
            const listEl = document.getElementById('char-usage-list');
            listEl.innerHTML = '';
            if (!runtime.activeCharacterId) return;

            const char = runtime.state.chats[runtime.activeCharacterId];
            const usageData = (char.simulatedAppUsage || []).sort((a, b) => b.usageTimeMinutes - a.usageTimeMinutes);

            if (usageData.length === 0) {
                listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No app activity yet.<br>Use Regenerate to generate activity.</p>";
                return;
            }

            usageData.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'char-usage-item';
                
                const hours = Math.floor(item.usageTimeMinutes / 60);
                const minutes = item.usageTimeMinutes % 60;
                let timeString = '';
                if (hours > 0) timeString += `${hours}小时`;
                if (minutes > 0) timeString += `${minutes}分钟`;
                if (!timeString) timeString = '小于1分钟';

                const prompt = item.image_prompt || `modern app icon for ${item.appName}, flat design, simple`;
       
                const iconUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
                  

                itemEl.innerHTML = `
                    <img src="${iconUrl}" class="usage-item-icon">
                    <div class="usage-item-info">
                        <div class="usage-item-name">${item.appName}</div>
                        <div class="usage-item-category">${item.category}</div>
                    </div>
                    <div class="usage-item-time">${timeString}</div>
                `;
                listEl.appendChild(itemEl);
            });
        }

export async function handleGenerateSimulatedQQ() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Generating social activity based on “${chat.name}” and their memories…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure your provider in API Connections first.");
        return;
    }
    
    const userDisplayNameForAI = runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname ? 'the user' : runtime.state.qzoneSettings.nickname;
    const userNicknameInThisChat = chat.settings.myNickname || userDisplayNameForAI;

    const characterOriginalName = chat.originalName || chat.name;
    const stickerContext = getGroupStickerContextForPrompt(chat);
    
    const systemPrompt = `
# Simulated QQ history
Portray "${chat.name}". Invent 5–7 recent QQ conversations, each with 8–15 messages. Use the language established by the character, user, and relevant context.

## Who appears and what they discuss
- NPC names must be unique across this batch, including private and group chats. Do not repeat groups.
- Draw participants first from the character's linked NPCs and World Info. Invent new NPCs only as needed. Give the chats enough variety to reflect the character's life.
- Weave in long-term memories, their worldview, and any changes in mood caused by recent interactions with the user.

## Output (highest priority)
Return only a valid JSON array, starting with [ and ending with ]. Omit surrounding prose, explanation, and Markdown fences. Use one of these two shapes per conversation. Supply avatar_prompt only for newly invented NPCs, in English keywords for anime or illustrated avatars. Do not depict real people.

Private chat
{"type":"private_npc","participant":{"name":"NPC name","avatar_prompt":"anime portrait, dark hair, warm lighting"},"messages":[{"sender":"${characterOriginalName}","content":"First message"},{"sender":"NPC name","content":"Reply"},{"sender":"${characterOriginalName}","type":"sticker","meaning":"Exact sticker meaning from the list"}]}

Group chat
{"type":"group","groupName":"Invented group name","participants":[{"name":"First NPC","avatar_prompt":"anime portrait, red scarf"},{"name":"Second NPC","avatar_prompt":"anime portrait, round glasses"}],"messages":[{"sender":"${characterOriginalName}","content":"Message to the group"},{"sender":"First NPC","content":"Reply"},{"sender":"Second NPC","type":"sticker","meaning":"Exact sticker meaning from the list"}]}

## Character and stickers
${chat.settings.aiPersona}
Choose exactly one listed meaning when sending a sticker.
${stickerContext}
`;
  
            
    try {
        const messagesForApi = [{ role: 'user', content: "Generate the simulated QQ conversations in character." }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });

        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error(`The AI reply did not contain a valid JSON array. Raw reply: ${aiResponseContent}`);
        }
        const cleanedJsonString = jsonMatch[0];
        let simulatedConversations;
        try {
            simulatedConversations = JSON.parse(cleanedJsonString);
        } catch (e) {
            throw new Error(`Could not read the AI reply as JSON: ${e.message}\n\nRaw AI reply:\n${aiResponseContent}`);
        }
        
        chat.simulatedConversations = simulatedConversations;
        await runtime.db.chats.put(chat);
        
        await renderCharSimulatedQQ();

        
        const hiddenMessage = {
            role: 'system',
            content: `[System instruction: You just spent time on your phone chatting with friends or in groups. Send the user one message in character. Mention something interesting you saw or talked about, or simply say hello.]`,
            timestamp: Date.now(),
            isHidden: true
        };
        chat.history.push(hiddenMessage);
        await runtime.db.chats.put(chat);
        triggerAiResponse();
        
    } catch (error) {
        console.error("生成模拟聊天失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate simulated chats. Check API Connections or retry. Error: ${error.message}`);
    }
}

export function handleContinueRealConversationFromCPhone() {
    const chatId = runtime.activeCharacterId;
    return withConversationRequest(chatId, () => continueRealConversation(chatId));
}

async function continueRealConversation(chatId) {
    const chat = runtime.state.chats[chatId];
    if (!chat) return;



    try {
        const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
        if (!proxyUrl || !model) {
            throw new Error('API未配置，无法生成对话。');
        }

        const myNickname = chat.settings.myNickname || 'Me';

        
        
        

        
        const userPersona = chat.settings.myPersona || '用户';

        
    const stickerContext = getStickerContextForPrompt(chat);        
        const systemPrompt = `
# Continue the QQ conversation
You are "${chat.originalName}". The user used Cphone to ask you to continue your previous conversation. Use the latest exchange and send 3–5 new, short consecutive replies in character. Use the language established by the character, user, and relevant context.

## Output (highest priority)
Return only a valid JSON array, starting with [ and ending with ]. Omit surrounding prose, explanation, and Markdown fences. Each object represents one message. You can combine "text", "sticker", "ai_image", and "voice_message".
[{"type":"text","content":"First message"},{"type":"text","content":"Second message"},{"type":"sticker","meaning":"Exact sticker meaning from the list"}]
For a sticker, choose exactly one meaning from this list. Match the moment and your mood and vary your choices.
${stickerContext}

## Context
- Your original name: "${chat.originalName}"
- The user's nickname: "${myNickname}"
- Your persona: ${chat.settings.aiPersona}
- The user's persona: ${chat.settings.myPersona}
`;

        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: [{ role: 'user', content: 'Continue this conversation as the character.' }], task: 'QQ reply from Cphone' });
        if (!response.ok) {
            throw new Error(`API 请求失败: ${(await response.json()).error.message}`);
        }

        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        const messagesArray = parseAiResponse(aiResponseContent);

        if (!messagesArray || messagesArray.length === 0) {
            throw new Error("AI返回了空内容。");
        }

        let newMessagesCount = 0;
        const turn = newReplyTurn();
        let messageTimestamp = replyTimestamp(chat.history);
        for (const msgData of messagesArray) {
            const baseMessage = { role: 'assistant', senderName: chat.originalName, timestamp: messageTimestamp++, ...turn };
            let aiMessage = null;
            switch(msgData.type) {
                case 'text':
                    aiMessage = { ...baseMessage, content: String(msgData.content || msgData.message) };
                    break;
                case 'sticker':
                    if (msgData.meaning) {
                        const sticker = runtime.state.userStickers.find(s => s.name === msgData.meaning);
                        if (sticker) {
                            aiMessage = { ...baseMessage, type: 'sticker', content: sticker.url, meaning: sticker.name };
                        } else {
                            console.warn(`AI (CPhone) 尝试使用一个不存在的表情: "${msgData.meaning}"`);
                            aiMessage = { ...baseMessage, type: 'text', content: `[表情: ${msgData.meaning}]` };
                        }
                    } else {
                        console.warn("AI (CPhone) 发送了一个没有 'meaning' 的 sticker 指令。", msgData);
                        aiMessage = { ...baseMessage, type: 'sticker', content: msgData.url, meaning: '未知表情' };
                    }
                    break;
            }
            if (aiMessage) {
                chat.history.push(aiMessage);
                newMessagesCount++;
            }
        }
        
        if (newMessagesCount > 0) {
            chat.unreadCount = (chat.unreadCount || 0) + newMessagesCount;
        }
        
        await runtime.db.chats.put(chat);
        await renderChatList();

        if (newMessagesCount > 0) {
            showNotification(chat.id, `发来了 ${newMessagesCount} 条新消息`);
        }

    } catch (error) {
        console.error("从CPhone推进真实对话失败:", error);
        await showCustomAlert("Operation Failed", `Could not generate a reply: ${error.message}`);
    }
}

export async function loadMoreMirroredMessages() {
    if (runtime.isLoadingMoreCphoneMessages || !runtime.activeCharacterId) return;
    runtime.isLoadingMoreCphoneMessages = true;

    const messagesContainer = document.getElementById('char-conversation-messages');
    const mainChar = runtime.state.chats[runtime.activeCharacterId];
    if (!mainChar) {
        runtime.isLoadingMoreCphoneMessages = false;
        return;
    }

    showLoader(messagesContainer, 'top'); 
    const oldScrollHeight = messagesContainer.scrollHeight;

    
    await new Promise(resolve => setTimeout(resolve, 500));

    const totalMessages = mainChar.history.length;
    const renderWindow = runtime.state.globalSettings.chatRenderWindow || 50;
    const nextSliceEnd = totalMessages - runtime.cphoneRenderedCount;
    const nextSliceStart = Math.max(0, nextSliceEnd - renderWindow);
    
    const messagesToPrepend = mainChar.history.slice(nextSliceStart, nextSliceEnd);

    
    hideLoader(messagesContainer);

    if (messagesToPrepend.length === 0) {
        runtime.isLoadingMoreCphoneMessages = false;
        return;
    }

    
    for (const msg of messagesToPrepend.reverse()) {
        const mirroredMsg = { ...msg, role: msg.role === 'user' ? 'assistant' : 'user' };
        
        
        const tempChatObjectForRendering = {
            id: 'temp_user_chat_mirror', isGroup: false, name: mainChar.name,
            settings: {
                ...mainChar.settings,
                myAvatar: mainChar.settings.aiAvatar,
                myAvatarFrame: mainChar.settings.aiAvatarFrame,
                aiAvatar: mainChar.settings.myAvatar,
                aiAvatarFrame: mainChar.settings.myAvatarFrame
            }
        };
        
        const messageEl = await createMessageElement(mirroredMsg, tempChatObjectForRendering);
        if (messageEl) {
            messagesContainer.prepend(messageEl);
        }
    }

    runtime.cphoneRenderedCount += messagesToPrepend.length;

    
    const newScrollHeight = messagesContainer.scrollHeight;
    messagesContainer.scrollTop = newScrollHeight - oldScrollHeight;

    runtime.isLoadingMoreCphoneMessages = false;
}

export async function openCharSimulatedConversation(conversationIndex) {
    const mainChar = runtime.state.chats[runtime.activeCharacterId];
    if (!mainChar) return; 

    runtime.cphoneActiveConversationType = (conversationIndex === -1) ? 'private_user' : mainChar.simulatedConversations[conversationIndex]?.type; 

    const bodyEl = document.getElementById('char-conversation-messages'); 
    bodyEl.innerHTML = '';
    bodyEl.dataset.theme = mainChar.settings.theme || 'default';
    const isDarkMode = document.getElementById('phone-screen').classList.contains('dark-mode');
    bodyEl.style.backgroundColor = isDarkMode ? '#000000' : '#f0f2f5';

    let tempChatObjectForRendering;
    let messagesToRender = [];
    const allNpcs = await runtime.db.npcs.toArray(); 
    const npcMap = new Map(allNpcs.map(npc => [npc.name, npc])); // 确保 npcMap 可用

    if (conversationIndex === -1) {
  
        runtime.cphoneActiveConversationType = 'private_user';
        const titleEl = document.getElementById('char-conversation-partner-name');
        // const bodyEl = document.getElementById('char-conversation-messages'); 
        const inputEl = document.getElementById('char-simulated-input');

        bodyEl.innerHTML = '';
        titleEl.textContent = mainChar.settings.myNickname || (runtime.state.qzoneSettings.nickname || "Me");
        inputEl.placeholder = `Chat with ${mainChar.settings.myNickname || 'Me'} (read-only)`;

        runtime.cphoneRenderedCount = 0;
        runtime.isLoadingMoreCphoneMessages = false;

        const history = mainChar.history;
        const renderWindow = runtime.state.globalSettings.chatRenderWindow || 50;
        const initialMessages = history.slice(-renderWindow);

        tempChatObjectForRendering = {
            id: 'temp_user_chat_mirror', isGroup: false, name: mainChar.name,
            settings: {
                ...mainChar.settings,
                myAvatar: mainChar.settings.aiAvatar,
                myAvatarFrame: mainChar.settings.aiAvatarFrame,
                aiAvatar: mainChar.settings.myAvatar,
                aiAvatarFrame: mainChar.settings.myAvatarFrame
            }
        };

        messagesToRender = initialMessages.map(msg => ({ 
             ...msg,
             role: msg.role === 'user' ? 'assistant' : 'user' 
         }));
        runtime.cphoneRenderedCount = initialMessages.length;

    } else {
   
        const conversation = mainChar.simulatedConversations[conversationIndex];
        if (!conversation) return;
        runtime.cphoneActiveConversationType = conversation.type;

        const titleEl = document.getElementById('char-conversation-partner-name');
        // const bodyEl = document.getElementById('char-conversation-messages'); 
        const inputEl = document.getElementById('char-simulated-input');

        if (conversation.type === 'group') {
            titleEl.textContent = `${conversation.groupName} (${conversation.participants.length + 1})`;
            inputEl.placeholder = `Chat in ${conversation.groupName}`;
            tempChatObjectForRendering = {
                id: 'temp_group_chat', isGroup: true,
                name: conversation.groupName,
                originalName: mainChar.originalName, 
                members: conversation.participants.map(p => {
                    const npcData = npcMap.get(p.name);
                    let avatarUrl = (npcData && npcData.avatar) ? npcData.avatar :
                        (runtime.state.globalSettings.enableAiDrawing
                            ? `https://image.pollinations.ai/prompt/${encodeURIComponent(p.avatar_prompt || 'anime person')}`
                            : runtime.defaultGroupMemberAvatar);
                    return { originalName: p.name, groupNickname: p.name, avatar: avatarUrl };
                }),
                settings: {
                    ...mainChar.settings,
                    myNickname: mainChar.name,
                    myAvatar: mainChar.settings.aiAvatar,
                    myAvatarFrame: mainChar.settings.aiAvatarFrame,
                }
            };
        } else { 
            titleEl.textContent = conversation.participant.name;
            inputEl.placeholder = `Chat with ${conversation.participant.name}`;
            const npcData = npcMap.get(conversation.participant.name);
            const npcAvatarUrl = (npcData && npcData.avatar) ? npcData.avatar :
                (runtime.state.globalSettings.enableAiDrawing
                    ? `https://image.pollinations.ai/prompt/${encodeURIComponent(conversation.participant.avatar_prompt || 'anime person')}`
                    : runtime.defaultGroupMemberAvatar);
            tempChatObjectForRendering = {
                id: 'temp_npc_chat', isGroup: false,
                name: conversation.participant.name,
                originalName: mainChar.originalName, 
                settings: {
                    ...mainChar.settings,
                    myAvatar: mainChar.settings.aiAvatar, 
                    myAvatarFrame: mainChar.settings.aiAvatarFrame,
                    aiAvatar: npcAvatarUrl,
                    aiAvatarFrame: '' 
                }
            };
        }
        messagesToRender = conversation.messages; // 准备要渲染的消息
    }

   
    // const bodyEl = document.getElementById('char-conversation-messages'); // 已在上面定义
    for (const msg of messagesToRender) {
        let role = msg.role; // 如果渲染真实历史记录，直接使用 role
        if(conversationIndex !== -1) { // 如果是模拟对话
            const isFromMainChar = msg.sender === (mainChar.originalName || mainChar.name);
            role = isFromMainChar ? 'user' : 'assistant';
        }

        const tempMessageObject = {
            role: role,
            senderName: msg.sender || (role === 'user' ? tempChatObjectForRendering.settings.myNickname : tempChatObjectForRendering.name),
            timestamp: msg.timestamp || (Date.now() + Math.random()) 
        };

    
        if (msg.type === 'sticker' && msg.meaning) {
        
            const sticker = runtime.state.userStickers.find(s => s.name === msg.meaning);
            if (sticker) {
                tempMessageObject.content = sticker.url; 
                tempMessageObject.meaning = msg.meaning; 
                tempMessageObject.type = 'sticker';
            } else {
           
                console.warn(`模拟表情含义 "${msg.meaning}" 在库中未找到。`);
                tempMessageObject.content = `[表情: ${msg.meaning}]`;
                tempMessageObject.type = 'text'; 
            }
        } else {
     
            tempMessageObject.content = msg.content;
            tempMessageObject.type = msg.type || 'text';
        }

        const bubbleElement = await createMessageElement(tempMessageObject, tempChatObjectForRendering);
        if (bubbleElement) {
            bodyEl.appendChild(bubbleElement);
        }
    }

    switchToCharScreen('char-qq-conversation-screen');
    setTimeout(() => bodyEl.scrollTop = bodyEl.scrollHeight, 0); // 渲染完成后滚动到底部
}

export function closeSimulatedTranscriptModal() {
    document.getElementById('char-qq-transcript-modal').classList.remove('visible');
}

export async function handleGenerateSimulatedAlbum() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];

    if (!chat) {
        await showCustomAlert("Operation Failed", "The character’s data could not be found.");
        return;
    }

    await showCustomAlert("Please wait…", `Asking “${chat.name}” to recall their album photos…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure your provider in API Connections first.");
        return;
    }

    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? 'the user' : runtime.state.qzoneSettings.nickname;
    


    
    const systemPrompt = `
# Simulated photo album
Portray "${chat.name}". Imagine 8–10 recent photos the character took or kept. Use their persona, memories, and recent interactions. Make the photos fit their personality, interests, work, and surroundings. Vary the subjects, such as selfies, scenery, food, pets, photos with friends, or work scenes.

## Output (highest priority)
Return only a valid JSON array, starting with [ and ending with ]. Omit surrounding prose, explanation, and Markdown fences. Each object represents a photo.
[{"description":"I wanted to remember how quiet the gym was that evening.","image_prompt":"1boy, solo, basketball jersey, locker room, smiling, selfie, best quality, masterpiece, anime style, cinematic lighting"}]

- In "description", write the story or feeling behind the photo from the character's first-person perspective. Use the language established by the character, user, and relevant context.
- In "image_prompt", use detailed comma-separated English keywords without full sentences, Chinese characters, or special symbols. Keep out NSFW, violence, gore, politics, and real people.
- Always end the image prompt with art-style tags such as "best quality, masterpiece, anime style, cinematic lighting".

# Context
- Character persona: ${chat.settings.aiPersona}
- Recent conversation with "${userDisplayNameForAI}", saved memories, and other supplied context.
`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "Generate the photo album entries in character." }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error(`The AI reply did not contain a valid JSON array. Raw reply: ${aiResponseContent}`);
        }
        const cleanedJsonString = jsonMatch[0];
        let simulatedAlbumData;
        try {
            simulatedAlbumData = JSON.parse(cleanedJsonString);
        } catch (e) {
            throw new Error(`Could not read the AI reply as JSON: ${e.message}\n\nRaw AI reply:\n${aiResponseContent}`);
        }
          
        
        chat.simulatedAlbum = simulatedAlbumData;
        await runtime.db.chats.put(chat);
        
        await renderCharAlbum();
        
    } catch (error) {
        console.error("生成模拟相册失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate album photos. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function handleGenerateBrowserHistory() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Generating browsing activity for “${chat.name}”…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure an API connection before generating content.");
        return;
    }
    
    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? 'the user' : runtime.state.qzoneSettings.nickname;



    const userPersona = chat.settings.myPersona || '(not set)';
    const systemPrompt = `
# Simulated browser history
Portray "${chat.name}". Invent 10–20 recent browsing or search records that fit the character's personality, interests, work, and surroundings. Vary the material across posts, articles, news, Q&A, or other plausible sources. Use the language established by the character, user, and relevant context.

## Output (highest priority)
Return only a valid JSON array, starting with [ and ending with ]. Omit surrounding prose, explanation, and Markdown fences. Every record must have "type": "text". Never return "type": "image". Write 200–400 characters of detailed article or post content per record. Use escaped newlines where needed. Use an invented but credible URL and an engaging title.
[{"type":"text","title":"An engaging title","url":"https://example.com/sample","content":"Write the full body here.\\nUse another paragraph where appropriate."}]

# Context
- Character persona: ${chat.settings.aiPersona}
- Recent conversation with "${userDisplayNameForAI}", saved memories, and other supplied context.
- User persona: ${userPersona}
`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "Generate the browser history in character." }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error(`The AI reply did not contain a valid JSON array. Raw reply: ${aiResponseContent}`);
        }
        const cleanedJsonString = jsonMatch[0];
        let simulatedHistory;
        try {
            simulatedHistory = JSON.parse(cleanedJsonString);
        } catch (e) {
            throw new Error(`Could not read the AI reply as JSON: ${e.message}\n\nRaw AI reply:\n${aiResponseContent}`);
        }
          
        
        chat.simulatedBrowserHistory = simulatedHistory;
        await runtime.db.chats.put(chat);
        
        await renderCharBrowserHistory();
        
    } catch (error) {
        console.error("生成模拟浏览器历史失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate browser history. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function openCharArticle(index) {
    const char = runtime.state.chats[runtime.activeCharacterId];
    const articleData = char.simulatedBrowserHistory[index];
    if (!articleData) return;
    
      
    
    runtime.activeArticleForViewing = articleData;
    
    
    renderCharArticle(articleData);
    switchToCharScreen('char-browser-article-screen');

      
    
    const favBtn = document.getElementById('favorite-article-btn');
    
    const existingFavorite = await runtime.db.favorites.where({ type: 'char_browser_article', 'content.url': articleData.url }).first();
    favBtn.classList.toggle('active', !!existingFavorite);
    
}

export async function toggleBrowserArticleFavorite() {
    if (!runtime.activeArticleForViewing || !runtime.activeCharacterId) return;

    const article = runtime.activeArticleForViewing;
    const char = runtime.state.chats[runtime.activeCharacterId];
    const favBtn = document.getElementById('favorite-article-btn');

    
    const existingFavorite = await runtime.db.favorites.where({ type: 'char_browser_article', 'content.url': article.url }).first();

    if (existingFavorite) {
        
        await runtime.db.favorites.delete(existingFavorite.id);
        favBtn.classList.remove('active');
        await showCustomAlert("Complete", "Removed from Favorites.");
    } else {
        
        const newFavorite = {
            type: 'char_browser_article',
            
            content: {
                ...article, 
                characterId: runtime.activeCharacterId,
                characterName: char.name
            },
            timestamp: Date.now() 
        };
        await runtime.db.favorites.add(newFavorite);
        favBtn.classList.add('active');
        await showCustomAlert("Complete", "Added to Favorites.");
    }
}

export function renderCharArticle(articleData) {
            const titleEl = document.getElementById('char-article-title');
            const contentEl = document.getElementById('char-article-content');
            
            titleEl.textContent = articleData.title;
            contentEl.innerHTML = ''; 


            
            
            if (articleData.type === 'image') {
                contentEl.innerHTML = `<p class="char-browser-image-description">${articleData.title || '(无标题)'}</p>`;
            } else {
                
                contentEl.innerHTML = `<p>${(articleData.content || '内容加载失败...').replace(/\n/g, '</p><p>')}</p>`;
            }
            
        }

const taobaoStatusLabels = new Map([
    ['已签收', 'Delivered'],
    ['待发货', 'Awaiting shipment'],
    ['运输中', 'In transit'],
    ['待评价', 'Awaiting review'],
]);

export function taobaoStatusLabel(status) {
    return taobaoStatusLabels.get(status) ?? status ?? '';
}

export async function handleGenerateTaobaoHistory() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Generating shopping activity for “${chat.name}”…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure an API connection before generating content.");
        return;
    }
    
    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? 'the user' : runtime.state.qzoneSettings.nickname;



    
    const systemPrompt = `
# Simulated Taobao purchases
Portray "${chat.name}". Use the character's persona, saved memories, and recent interactions to invent recent Taobao purchases and a balance. Match the items to their personality, interests, and means. Choose a new plausible balance that reflects their finances. A wealthy character should have a higher balance, while a student or character with little money should have a lower one.

## Output (highest priority)
Return only a valid JSON object, starting with { and ending with }. Omit surrounding prose, explanation, and Markdown fences.
{"totalBalance":12345.67,"purchases":[{"itemName":"A specific product name","price":128.80,"status":"Delivered","reason":"I bought it to replace my old travel mug.","image_prompt":"realistic product photo, high quality, travel mug on a clean white background"}]}
- Include 12–15 purchases. Each item's "reason" is a first-person thought or reason for buying it. Use the language established by the character, user, and relevant context.
- For "status", choose only "Delivered", "Awaiting shipment", "In transit", or "Awaiting review".
- Write detailed English keywords for a realistic high-quality product photo on a clean white background.

# Context
- Character persona: ${chat.settings.aiPersona}
- Recent conversation with "${userDisplayNameForAI}", saved memories, and other supplied context.
`;

    try {
        const messagesForApi = [{ role: 'user', content: "Generate the Taobao purchases and balance in character." }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });

        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        const jsonMatch = aiResponseContent.match(/({[\s\S]*})/);
        if (!jsonMatch) throw new Error("AI返回的内容中未找到有效的JSON对象。");
        const simulatedTaobaoData = JSON.parse(jsonMatch[0]);
        

        if (!simulatedTaobaoData.purchases) {
            simulatedTaobaoData.purchases = [];
        }

        chat.simulatedTaobaoHistory = simulatedTaobaoData;
        await runtime.db.chats.put(chat);
        
        await renderCharTaobao();
        
    } catch (error) {
        console.error("生成模拟淘宝记录失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate shopping history. Check API Connections or retry. Error: ${error.message}`);
    }
}

export function openCharWallet() {
    renderCharWallet();
    switchToCharScreen('char-wallet-screen');
}

export function renderCharWallet() {
    const contentEl = document.getElementById('char-wallet-content');
    contentEl.innerHTML = '';
    const char = runtime.state.chats[runtime.activeCharacterId];
    const history = char.simulatedTaobaoHistory || {};
    const purchases = history.purchases || [];

    
    const totalBalance = history.totalBalance || 0;

    
    const summaryCard = document.createElement('div');
    summaryCard.style.cssText = `
        background-color: #fff;
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        margin-bottom: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    `;
    summaryCard.innerHTML = `
        <p style="color: #8a8a8a; margin: 0 0 10px 0;">Account Balance</p>
        <p style="font-size: 2rem; font-weight: 600; color: #1f1f1f; margin: 0;">¥${totalBalance.toFixed(2)}</p>
    `;
    contentEl.appendChild(summaryCard);

    
    const detailsTitle = document.createElement('h3');
    detailsTitle.textContent = "Recent Spending";
    detailsTitle.style.cssText = `font-size: 1rem; color: #555; margin-bottom: 10px;`;
    contentEl.appendChild(detailsTitle);

    if (purchases.length === 0) {
        contentEl.innerHTML += "<p style=\"text-align:center; color: var(--text-secondary);\">No recent spending.</p>";
        return;
    }

    
    purchases.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #f0f0f0;
        `;
        itemEl.innerHTML = `
            <div>
                <p style="font-weight: 500; margin: 0 0 4px 0;">${item.itemName}</p>
                <p style="font-size: 0.75rem; color: #8a8a8a; margin: 0;">${taobaoStatusLabel(item.status)}</p>
            </div>
            <div style="font-weight: 600; font-size: 1rem; color: #ff5722;">- ¥${(item.price || 0).toFixed(2)}</div>
        `;
        contentEl.appendChild(itemEl);
    });
}

export async function handleGenerateSimulatedMemos() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Asking “${chat.name}” to share their notes…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure your provider in API Connections first.");
        return;
    }

    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? 'the user' : runtime.state.qzoneSettings.nickname;



    const userPersona = chat.settings.myPersona || '(not set)';
    const systemPrompt = `
# Simulated phone memos
Portray "${chat.name}". Create 12–20 recent memos that fit the character's personality, interests, job, and surroundings. Use their memories and recent interactions. Possible subjects include shopping lists, tasks, ideas, reflections, or drafts. Use the language established by the character, user, and relevant context.

## Output (highest priority)
Return only a valid JSON array, starting with [ and ending with ]. Omit surrounding prose, explanation, and Markdown fences. Include a title and detailed content in each object. Use escaped newlines when needed.
[{"title":"Weekend plans","content":"Pick up groceries.\\nCheck whether the exhibit is still open."}]

# Context
- Character persona: ${chat.settings.aiPersona}
- Recent conversation with "${userDisplayNameForAI}", saved memories, and other supplied context.
- User persona: ${userPersona}
`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "Generate the memos in character." }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) {
             const errorData = await response.json().catch(() => null);
             const errorMessage = errorData?.error?.message || response.statusText;
             throw new Error(`API error: ${response.status} - ${errorMessage}`);
        }
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
   
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error(`The AI reply did not contain a valid JSON array. Raw reply: ${aiResponseContent}`);
        }
        const cleanedJsonString = jsonMatch[0];
        let simulatedMemos;
        try {
            simulatedMemos = JSON.parse(cleanedJsonString);
        } catch (e) {
            throw new Error(`Could not read the AI reply as JSON: ${e.message}\n\nRaw AI reply:\n${aiResponseContent}`);
        }
          
        
        if (!Array.isArray(simulatedMemos)) {
            throw new Error(`AI返回的数据不是一个数组。原始返回: ${JSON.stringify(simulatedMemos)}`);
        }

        chat.memos = simulatedMemos.map(memo => ({
            id: Date.now() + Math.random(),
            title: memo.title,
            content: memo.content
        }));
        
        await runtime.db.chats.put(chat);
        await renderCharMemoList();
        
    } catch (error) {
        console.error("生成模拟备忘录失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate notes. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function handleGenerateAmapHistory() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Generating location history for “${chat.name}”…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure an API connection before generating content.");
        return;
    }
    
    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? 'the user' : runtime.state.qzoneSettings.nickname;


    const systemPrompt = `
# Simulated Amap visits
Portray "${chat.name}". Invent 12–20 recent visits that fit the character's persona, memories, interactions, and everyday setting. Vary the places, such as restaurants, malls, parks, offices, or friends' homes.

## Date and order (highest priority)
Today is ${new Date().toISOString()}. Place all visits in the past few weeks, including today if appropriate. Never use a future date. Sort from newest to oldest. Use ISO 8601 timestamps.

## Output (highest priority)
Return only a valid JSON array, starting with [ and ending with ]. Omit surrounding prose, explanation, and Markdown fences.
[{"locationName":"A specific place name","address":"A detailed, invented but plausible address","comment":"I stopped here on the way home.","image_prompt":"realistic photo, high quality, empty reading room","timestamp":"2025-09-25T18:30:00Z"}]
- Write each comment from the character's first-person perspective. Use the language established by the character, user, and relevant context.
- Include "image_prompt" for about a third of the visits. Use detailed English keywords for a realistic, high-quality photo. Never depict real people. Empty interiors, outdoor scenery, and buildings are suitable.

# Context
- Character persona: ${chat.settings.aiPersona}
- Recent conversation with "${userDisplayNameForAI}", saved memories, and other supplied context.
`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "Generate the Amap visits in character." }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error(`The AI reply did not contain a valid JSON array. Raw reply: ${aiResponseContent}`);
        }
        const cleanedJsonString = jsonMatch[0];
        let simulatedAmapData;
        try {
            simulatedAmapData = JSON.parse(cleanedJsonString);
        } catch (e) {
            throw new Error(`Could not read the AI reply as JSON: ${e.message}\n\nRaw AI reply:\n${aiResponseContent}`);
        }
          
        
        chat.simulatedAmapHistory = simulatedAmapData;
        await runtime.db.chats.put(chat);
        
        await renderCharAmap();
        
    } catch (error) {
        console.error("生成模拟足迹失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate location history. Check API Connections or retry. Error: ${error.message}`);
    }
}

export function renderCharAmap() {
            const listEl = document.getElementById('char-amap-list');
            listEl.innerHTML = '';
            if (!runtime.activeCharacterId) return;

            const char = runtime.state.chats[runtime.activeCharacterId];
            const history = char.simulatedAmapHistory || [];

            if (history.length === 0) {
                listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No location history yet.<br>Use Regenerate to create activity.</p>";
                return;
            }

            
            history.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'char-amap-item';
                
                let photoHtml = '';
                if (item.image_prompt) {
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(item.image_prompt)}`;
                    photoHtml = `<div class="amap-item-photo" style="background-image: url('${imageUrl}')" data-comment="${item.comment}"></div>`;
                }

                // 使用我们之前创建的 formatTimeAgo 函数来格式化时间
                const timeAgo = item.timestamp ? formatTimeAgo(new Date(item.timestamp).getTime()) : '某个时间';

                itemEl.innerHTML = `
                    <div class="amap-item-header">
                        <div class="amap-item-icon">📍</div>
                        <div class="amap-item-info">
                            <div class="amap-item-title">${item.locationName}</div>
                            <div class="amap-item-address">${item.address}</div>
                        </div>
                    </div>
                    <div class="amap-item-body">
                        <div class="amap-item-comment">${item.comment.replace(/\n/g, '<br>')}</div>
                        ${photoHtml}
                    </div>
                    <div class="amap-item-footer">${timeAgo}</div>
                `;
                listEl.appendChild(itemEl);
            });
      
        }

export async function handleGenerateAppUsage() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Generating app activity for “${chat.name}”…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure an API connection before generating content.");
        return;
    }
    
    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? 'the user' : runtime.state.qzoneSettings.nickname;


  
    const systemPrompt = `
# Simulated app usage
Portray "${chat.name}". Invent about 20 screen-time records from the character's most recent day. Reflect their personality, interests, work, and surroundings in the apps and time spent. You may include apps beyond the Cphone home screen, such as Instagram, Genshin Impact, Honor of Kings, Douyin, YouTube, or tools for study and work.

## Output (highest priority)
Return only a valid JSON array, starting with [ and ending with ]. Omit surrounding prose, explanation, and Markdown fences. Each object represents an app. Use an appropriate category, such as social, games, media, utility, reading, or shopping. Write a concise English image prompt for a modern flat app icon on a clean, simple background.
[{"appName":"An app name","usageTimeMinutes":125,"category":"Social","image_prompt":"modern app icon, flat design, simple, clean background"}]

# Context
- Character persona: ${chat.settings.aiPersona}
- Recent conversation with "${userDisplayNameForAI}", saved memories, and other supplied context.
`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "Generate the app usage records in character." }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        const cleanedJson = aiResponseContent.replace(/^```json\s*/, '').replace(/```$/, '');
        
        const simulatedUsageData = JSON.parse(cleanedJson);
        
        chat.simulatedAppUsage = simulatedUsageData;
        await runtime.db.chats.put(chat);
        
        await renderCharAppUsage();
        
    } catch (error) {
        console.error("生成模拟App使用记录失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate app activity. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function handleGenerateSimulatedMusic() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Asking “${chat.name}” to share their playlist…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure your provider in API Connections first.");
        return;
    }
    
    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? 'the user' : runtime.state.qzoneSettings.nickname;



 
    const systemPrompt = `
# Simulated playlist
Portray "${chat.name}". Based on the character's persona, memories, and recent interactions, choose 14–18 songs that fit their current mood or taste. Match their personality, interests, and background. Include varied genres where they form a coherent playlist.

## Output (highest priority)
Return only a valid JSON array, starting with [ and ending with ]. Omit surrounding prose, explanation, and Markdown fences. Use accurate, searchable song and artist names.
[{"songName":"Exact song title","artistName":"Exact artist name"}]

# Context
- Character persona: ${chat.settings.aiPersona}
- Recent conversation with "${userDisplayNameForAI}", saved memories, and other supplied context.
`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "Generate the playlist in character." }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        const cleanedJson = aiResponseContent.replace(/^```json\s*/, '').replace(/```$/, '');
        const songPicks = JSON.parse(cleanedJson);

        await showCustomAlert("Please wait…", `Looking up details for ${songPicks.length} tracks…`);

        const songDetailPromises = songPicks.map(async (pick) => {
            let searchResults = await searchNeteaseMusic(pick.songName, pick.artistName);
            if (!searchResults || searchResults.length === 0) {
                searchResults = await searchTencentMusic(pick.songName);
            }
            if (searchResults.length > 0) {
                return getPlayableSongDetails(searchResults[0]);
            }
            console.warn(`所有音乐源都未能找到歌曲：“${pick.songName} - ${pick.artistName}”`);
            return null;
        });

        const fullSongObjects = (await Promise.all(songDetailPromises)).filter(Boolean);

        chat.simulatedMusicPlaylist = fullSongObjects;
        await runtime.db.chats.put(chat);
        
        await renderCharMusicScreen();
        
    } catch (error) {
        console.error("生成模拟歌单失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate the playlist. Check API Connections or retry. Error: ${error.message}`);
    }
}
