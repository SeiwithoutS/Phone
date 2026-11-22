import { runtime } from '../runtime/state.js'
import { renderChatInterface, appendMessage } from './conversation.js'
import { renderChatList } from './list.js'
import { recallMessage, enterSelectionMode } from './messages.js'
import { showCustomAlert, showCustomPrompt } from '../dialogs/dialogs.js'
import { handleAiGomokuMove } from '../gomoku/gomoku.js'
import { updateSettingsPreview } from '../appearance/theme.js'
import { endVideoCall, handleInitiateCall, handleUserJoinCall, hideIncomingCallModal, startVideoCall, triggerAiInCallAction } from '../calls/calls.js'
import { triggerAiResponse } from './ai.js'
import { handleUserTransferResponse, hideTransferActionModal, showTransferActionModal } from './attachments.js'
import { addNewGroup, createNewMemberInGroup, deleteGroup, handleAddMembersToGroup, openContactPickerForAddMember, openGroupManager, openMemberManagementScreen, removeMemberFromGroup, updateContactPickerConfirmButton } from './groups.js'
import { startBackgroundSimulation } from '../npc/simulation.js'
import { copyPostContent, hidePostActions, openPostEditor } from '../qzone/feed.js'
import { showScreen } from '../../app/routes'
import { controls } from '../runtime/state.js'

export function showMessageActions(timestamp) {
        
        const chat = runtime.state.chats[runtime.state.activeChatId];
        document.getElementById('publish-to-announcement-btn').style.display = chat.isGroup ? 'block' : 'none';
          
            
            if (runtime.isSelectionMode) return;
            
            runtime.activeMessageTimestamp = timestamp;
            document.getElementById('message-actions-modal').classList.add('visible');
        }

export function hideMessageActions() {
            document.getElementById('message-actions-modal').classList.remove('visible');
            runtime.activeMessageTimestamp = null;
        }

export async function openMessageEditor() {
            if (!runtime.activeMessageTimestamp) return;
        
            const timestampToEdit = runtime.activeMessageTimestamp;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const message = chat.history.find(m => m.timestamp === timestampToEdit);
            if (!message) return;
        
            hideMessageActions(); 
        
            let contentForEditing;
            
            const isSpecialType = message.type && ['voice_message', 'ai_image', 'transfer', 'share_link'].includes(message.type);
        
            if (isSpecialType) {
                let fullMessageObject = { type: message.type };
                if (message.type === 'voice_message') fullMessageObject.content = message.content;
                else if (message.type === 'ai_image') fullMessageObject.description = message.content; 
                else if (message.type === 'transfer') {
                    fullMessageObject.amount = message.amount;
                    fullMessageObject.note = message.note;
                } 
                
                else if (message.type === 'share_link') {
                    fullMessageObject.title = message.title;
                    fullMessageObject.description = message.description;
                    fullMessageObject.source_name = message.source_name;
                    fullMessageObject.content = message.content;
                }
                contentForEditing = JSON.stringify(fullMessageObject, null, 2);
            } else if (typeof message.content === 'object') {
                contentForEditing = JSON.stringify(message.content, null, 2);
            } else {
                contentForEditing = message.content;
            }
        
            
            const templates = {
                voice: { type: 'voice_message', content: '在这里输入语音内容' },
                image: { type: 'ai_image', description: '在这里输入图片描述' },
                transfer: { type: 'transfer', amount: 5.20, note: '一点心意' },
                link: { type: 'share_link', title: '文章标题', description: '文章摘要...', source_name: '来源网站', content: '文章完整内容...' }
            };
        
            
            const helpersHtml = `
                <div class="format-helpers">
                    <button class="format-btn" data-template='${JSON.stringify(templates.voice)}'>Voice</button>
                    <button class="format-btn" data-template='${JSON.stringify(templates.image)}'>Images</button>
                    <button class="format-btn" data-template='${JSON.stringify(templates.transfer)}'>Transfer</button>
                    <button class="format-btn" data-template='${JSON.stringify(templates.link)}'>Connections</button>
                </div>
            `;
        
            const newContent = await showCustomPrompt(
                "Edit Message", 
                "Edit the content or choose a format template above…",
                contentForEditing, 
                'textarea',
                helpersHtml
            );
        
            if (newContent !== null) {
                
                await saveEditedMessage(timestampToEdit, newContent, true);
            }
        }

export async function copyMessageContent() {
            if (!runtime.activeMessageTimestamp) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const message = chat.history.find(m => m.timestamp === runtime.activeMessageTimestamp);
            if (!message) return;
        
            let textToCopy;
            
            if (message.type === 'offline_text') {
                
                if (message.content) {
                    textToCopy = message.content;
                } else { 
                    textToCopy = `「${message.dialogue || ''}」\n${message.description || ''}`;
                }
            } else if (typeof message.content === 'object') {
                textToCopy = JSON.stringify(message.content);
            } else {
                textToCopy = String(message.content);
            }
        
            try {
                await navigator.clipboard.writeText(textToCopy);
                await showCustomAlert("Copied", "Message copied to the clipboard.");
            } catch (err) {
                await showCustomAlert("Copy Failed", "Could not access the clipboard.");
            }
            
            hideMessageActions();
        }

export async function copyMessageTimestamp() {
    if (!runtime.activeMessageTimestamp) return;

    try {
        await navigator.clipboard.writeText(runtime.activeMessageTimestamp);
        await showCustomAlert("Copied", `Timestamp ${runtime.activeMessageTimestamp} copied to the clipboard.`);
    } catch (err) {
        await showCustomAlert("Copy Failed", "Could not access the clipboard.");
    }
    
    hideMessageActions();
}

export function createMessageEditorBlock(initialContent = '') {
    const block = document.createElement('div');
    block.className = 'message-editor-block';

    
    const templates = {
        voice: { type: 'voice_message', content: '在这里输入语音内容' },
        image: { type: 'ai_image', description: '在这里输入图片描述' },
        transfer: { type: 'transfer', amount: 5.20, note: '一点心意' },
        link: { type: 'share_link', title: '文章标题', description: '文章摘要...', source_name: '来源网站', content: '文章完整内容...' },
        offline: { type: 'offline_text', content: '「在这里输入对话内容」\n(在这里输入动作或环境描写)' },
        quote: { type: 'quote_reply', target_timestamp: 1234567890, reply_content: '在这里输入回复内容' }
    };

    block.innerHTML = `
        <button class="delete-block-btn" title="删除此条">×</button>
        <textarea>${initialContent}</textarea>
        <div class="format-helpers">
            <button class="format-btn" data-template='${JSON.stringify(templates.voice)}'>Voice</button>
            <button class="format-btn" data-template='${JSON.stringify(templates.image)}'>Images</button>
            <button class="format-btn" data-template='${JSON.stringify(templates.transfer)}'>Transfer</button>
            <button class="format-btn" data-template='${JSON.stringify(templates.link)}'>Connections</button>
            <button class="format-btn" data-template='${JSON.stringify(templates.offline)}'>Offline roleplay</button>
            <!-- 【核心修改2】在这里添加新的“引用”按钮 -->
            <button class="format-btn" data-template='${JSON.stringify(templates.quote)}'>Quote</button>
        </div>
    `;

    
    block.querySelector('.delete-block-btn').addEventListener('click', () => {
        
        if (document.querySelectorAll('.message-editor-block').length > 1) {
            block.remove();
        } else {
            alert("Keep at least one message.");
        }
    });

    
    block.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const templateStr = btn.dataset.template;
            const textarea = block.querySelector('textarea');
            if (templateStr && textarea) {
                try {
                    const templateObj = JSON.parse(templateStr);
                    textarea.value = JSON.stringify(templateObj, null, 2);
                    textarea.focus();
                } catch(e) { console.error("解析格式模板失败:", e); }
            }
        });
    });

    return block;
}

export function openAdvancedMessageEditor() {
            if (!runtime.activeMessageTimestamp) return;
        
            const timestampToEdit = runtime.activeMessageTimestamp;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const message = chat.history.find(m => m.timestamp === timestampToEdit);
            if (!message) return;
        
            hideMessageActions(); 
        
            const editorModal = document.getElementById('message-editor-modal');
            const editorContainer = document.getElementById('message-editor-container');
            editorContainer.innerHTML = ''; 
        
            let initialContent;
            
            
            
            
            
            
            if (message.quote) {
                
                const quoteReplyObject = {
                    type: 'quote_reply',
                    target_timestamp: message.quote.timestamp,
                    reply_content: message.content 
                };
                
                initialContent = JSON.stringify(quoteReplyObject, null, 2);
            } 
            
            else if (message.type && ['voice_message', 'ai_image', 'transfer', 'offline_text', 'share_link'].includes(message.type)) {
                let fullMessageObject = { type: message.type };
                if (message.type === 'voice_message') fullMessageObject.content = message.content;
                else if (message.type === 'ai_image') fullMessageObject.description = message.content;
                else if (message.type === 'transfer') {
                    fullMessageObject.amount = message.amount;
                    fullMessageObject.note = message.note;
                } 
                else if (message.type === 'offline_text') {
                    if (message.content) {
                        fullMessageObject.content = message.content;
                    } else { 
                        fullMessageObject.dialogue = message.dialogue;
                        fullMessageObject.description = message.description;
                    }
                }
                else if (message.type === 'share_link') {
                    fullMessageObject.title = message.title;
                    fullMessageObject.description = message.description;
                    fullMessageObject.source_name = message.source_name;
                    fullMessageObject.content = message.content;
                }
                initialContent = JSON.stringify(fullMessageObject, null, 2);
            } 
            
            else if (typeof message.content === 'object') {
                initialContent = JSON.stringify(message.content, null, 2);
            } else {
                initialContent = message.content;
            }
        
            
            
            
        
            const firstBlock = createMessageEditorBlock(initialContent);
            editorContainer.appendChild(firstBlock);
        
            
            const addBtn = document.getElementById('add-message-editor-block-btn');
            const newAddBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newAddBtn, addBtn);
            newAddBtn.addEventListener('click', () => {
                const newBlock = createMessageEditorBlock();
                editorContainer.appendChild(newBlock);
                newBlock.querySelector('textarea').focus();
            });
        
            const cancelBtn = document.getElementById('cancel-advanced-editor-btn');
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', () => {
                editorModal.classList.remove('visible');
            });
        
            const saveBtn = document.getElementById('save-advanced-editor-btn');
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            newSaveBtn.addEventListener('click', () => {
                saveEditedMessage(timestampToEdit); 
            });
        
            editorModal.classList.add('visible');
        }

export function parseEditedContent(text) {
            const trimmedText = text.trim();
        
            
            if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
                try {
                    const parsed = JSON.parse(trimmedText);
                    
                    if (parsed.type) {
                        return parsed;
                    }
                } catch (e) { /* 解析失败，继续往下走 */ }
            }
            
            
            if (runtime.STICKER_REGEX.test(trimmedText)) {
                
                return { type: 'sticker', content: trimmedText };
            }
        
            
            return { type: 'text', content: trimmedText };
        }

export async function saveEditedMessage(timestamp, simpleContent = null) {
    if (!timestamp) return;

    const chat = runtime.state.chats[runtime.state.activeChatId];
    const messageIndex = chat.history.findIndex(m => m.timestamp === timestamp);
    if (messageIndex === -1) return;
    
    
    const originalMessage = chat.history[messageIndex];

    let newMessages = [];

    
    const blocks = simpleContent !== null 
        ? [simpleContent] 
        : Array.from(document.querySelectorAll('#message-editor-container textarea')).map(ta => ta.value);

    for (const rawContent of blocks) {
        if (!rawContent.trim()) continue;

        
        const parsedResult = parseEditedContent(rawContent.trim());
        
        
        
        const newMessage = {
            role: originalMessage.role,
            senderName: originalMessage.senderName,
            timestamp: originalMessage.timestamp 
        };

        
        
        switch (parsedResult.type) {
            case 'text':
                newMessage.type = 'text';
                newMessage.content = parsedResult.content;
                break;
            case 'offline_text':
                newMessage.type = 'offline_text';
                if (parsedResult.content) {
                    newMessage.content = parsedResult.content;
                } else { 
                    newMessage.dialogue = parsedResult.dialogue;
                    newMessage.description = parsedResult.description;
                }
                break;
            case 'quote_reply':
                newMessage.type = 'quote_reply';
                newMessage.content = parsedResult.reply_content;
                const originalQuotedMsg = chat.history.find(m => m.timestamp === parsedResult.target_timestamp);
                if (originalQuotedMsg) {
                    let originalSenderName = originalQuotedMsg.senderName;
                    if (originalQuotedMsg.role === 'user') {
                        originalSenderName = runtime.state.qzoneSettings.nickname || '{{user}}';
                    }
                    newMessage.quote = {
                        timestamp: parsedResult.target_timestamp,
                        senderName: originalSenderName,
                        content: String(originalQuotedMsg.content || '')
                    };
                } else {
                    newMessage.quote = {
                        timestamp: parsedResult.target_timestamp,
                        senderName: '未知用户',
                        content: '原始消息已删除或不存在'
                    };
                }
                break;
            case 'voice_message':

            case 'ai_image':
            case 'user_photo':
                newMessage.type = parsedResult.type;
                newMessage.content = parsedResult.content || parsedResult.description;
                if (parsedResult.meaning) newMessage.meaning = parsedResult.meaning;
                break;
case 'sticker': { // 使用花括号创建独立作用域，让逻辑更清晰
                        newMessage.type = 'sticker';
                        let found = false; // 标记是否已成功处理

                        // 优先级 1: 如果编辑器提供了 meaning (表情含义)
                        if (parsedResult.meaning) {
                            // 在用户的表情库 (state.userStickers) 中查找这个含义对应的表情
                            const sticker = runtime.state.userStickers.find(s => s.name === parsedResult.meaning);
                            if (sticker) {
                                // 找到了，就把 url 存到 content，含义存到 meaning
                                newMessage.content = sticker.url;
                                newMessage.meaning = sticker.name;
                                console.log("导演/编辑模式保存(Sticker): 使用了 meaning 查找");
                                found = true;
                            } else {
                                // 提供了含义但没找到，就当作普通文本处理
                                newMessage.type = 'text'; // 把消息类型改成文本
                                newMessage.content = `[表情: ${parsedResult.meaning}]`;
                                console.warn("导演/编辑模式保存(Sticker): 提供了 meaning 但未找到对应表情:", parsedResult.meaning);
                                found = true; // 标记为已处理 (已转为文本)
                            }
                        }

                        // 优先级 2: 如果编辑器提供了 url (并且上面没有通过 meaning 处理)
                        // 或者用户手动同时提供了 url 和 meaning
                        if (!found && parsedResult.url) {
                            newMessage.content = parsedResult.url; // url 存到 content
                            // 尝试根据 url 反查表情库里的含义
                            const stickerByURL = runtime.state.userStickers.find(s => s.url === parsedResult.url);
                            // 如果用户也提供了 meaning，优先用用户的，除非它和反查结果冲突
                            if (parsedResult.meaning && (!stickerByURL || stickerByURL.name === parsedResult.meaning)) {
                                 newMessage.meaning = parsedResult.meaning;
                            } else if (stickerByURL) { // 如果没提供 meaning 或冲突了，用反查到的
                                 newMessage.meaning = stickerByURL.name;
                            } else { // 实在找不到，就用“未知表情”
                                 newMessage.meaning = '未知表情';
                            }
                            console.log("导演/编辑模式保存(Sticker): 使用了 URL，最终 meaning:", newMessage.meaning);
                            found = true;
                        }

                        // 优先级 3: 如果只提供了 content，并且看起来像个图片链接 (兼容用户直接粘贴链接的情况)
                        if (!found && parsedResult.content && typeof parsedResult.content === 'string' && runtime.STICKER_REGEX.test(parsedResult.content)) {
                            newMessage.content = parsedResult.content; // content 就是 url
                            // 再次尝试根据 url 反查含义
                            const sticker = runtime.state.userStickers.find(s => s.url === parsedResult.content);
                            newMessage.meaning = sticker ? sticker.name : '未知表情';
                            console.log("导演/编辑模式保存(Sticker): 将 content 视为 URL，查找到 meaning:", newMessage.meaning);
                            found = true;
                        }

                        // 如果以上都没处理成功
                        if (!found) {
                            console.error("导演/编辑模式保存(Sticker): 指令无效或缺少必要字段 (meaning/url/content):", parsedResult);
                            continue; // 跳过这条无效的消息，不添加到历史记录
                        }
                        break; // sticker 处理结束
                    } // 结束 sticker 的独立作用域
            case 'transfer':
                newMessage.type = 'transfer';
                newMessage.amount = parsedResult.amount;
                newMessage.note = parsedResult.note;
                break;
            case 'share_link':
                newMessage.type = 'share_link';
                newMessage.title = parsedResult.title;
                newMessage.description = parsedResult.description;
                newMessage.source_name = parsedResult.source_name;
                newMessage.content = parsedResult.content;
                break;
            default:
                
                Object.assign(newMessage, parsedResult);
                break;
        }
        
        newMessages.push(newMessage);
    }
    
    if (newMessages.length === 0) {
        document.getElementById('message-editor-modal').classList.remove('visible');
        return;
    }

    
    
    chat.history.splice(messageIndex, 1, ...newMessages);
    
    
    let reassignTimestamp = timestamp;
    for (let i = messageIndex; i < chat.history.length; i++) {
        chat.history[i].timestamp = reassignTimestamp;
        reassignTimestamp++; 
    }
    
    await runtime.db.chats.put(chat);
    document.getElementById('message-editor-modal').classList.remove('visible');
    renderChatInterface(runtime.state.activeChatId);
    await showCustomAlert("Success", "Message updated.");
}

export function createAiResponseEditorBlock(initialContent = '') {
    const block = document.createElement('div');
    block.className = 'ai-response-editor-block';

    
    const templates = {
        text: { type: 'text', content: '在这里输入文本...' },
        sticker: { type: 'sticker', url: 'https://...', meaning: '表情含义' },
        image: { type: 'ai_image', description: '在这里输入图片描述...' },
        voice: { type: 'voice_message', content: '在这里输入语音内容...' },
        transfer: { type: 'transfer', amount: 5.20, note: '一点心意' },
        offline: { type: 'offline_text', content: '「在这里输入对话内容」\\n(在这里输入动作或环境描写)' },
        quote: { type: 'quote_reply', target_timestamp: 1234567890, reply_content: '在这里输入回复内容' }
    };

    block.innerHTML = `
        <button class="delete-block-btn" title="删除此条动作">×</button>
        <textarea>${initialContent}</textarea>
        <div class="format-helpers">
            <button class="format-btn" data-template='${JSON.stringify(templates.text)}'>the text</button>
            <button class="format-btn" data-template='${JSON.stringify(templates.sticker)}'>Sticker</button>
            <button class="format-btn" data-template='${JSON.stringify(templates.image)}'>Images</button>
            <button class="format-btn" data-template='${JSON.stringify(templates.voice)}'>Voice</button>
            <button class="format-btn" data-template='${JSON.stringify(templates.transfer)}'>Transfer</button>
            <button class="format-btn" data-template='${JSON.stringify(templates.offline)}'>Offline roleplay</button>
            <!-- 【核心修改2】在这里添加新的“引用”按钮 -->
            <button class="format-btn" data-template='${JSON.stringify(templates.quote)}'>Quote</button>
        </div>
    `;

    
    block.querySelector('.delete-block-btn').addEventListener('click', () => {
        block.remove();
    });

    
    block.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const templateStr = btn.dataset.template;
            const textarea = block.querySelector('textarea');
            if (templateStr && textarea) {
                try {
                    const templateObj = JSON.parse(templateStr);
                    
                    textarea.value = JSON.stringify(templateObj, null, 2);
                    textarea.focus();
                } catch(e) { console.error("解析格式模板失败:", e); }
            }
        });
    });

    return block;
}

export async function saveEditedAiResponse() {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat) return;
        
            
            const editorContainer = document.getElementById('ai-response-editor-container');
            const editorTextareas = editorContainer.querySelectorAll('textarea');
            const editedRawBlocks = Array.from(editorTextareas).map(ta => ta.value.trim()).filter(Boolean);
        
            
            if (editedRawBlocks.length === 0) {
                chat.history = chat.history.filter(msg => !runtime.lastResponseTimestamps.includes(msg.timestamp));
                await runtime.db.chats.put(chat);
                renderChatInterface(runtime.state.activeChatId);
                renderChatList();
                document.getElementById('ai-response-editor-modal').classList.remove('visible');
                runtime.lastRawAiResponse = '';
                runtime.lastResponseTimestamps = [];
                return;
            }
        
            
            let newMessagesArray = [];
            for (const rawContent of editedRawBlocks) {
                try {
                    const parsedObject = JSON.parse(rawContent);
                    newMessagesArray.push(parsedObject);
                } catch (e) {
                    console.warn("跳过一个无法解析为JSON的编辑块:", rawContent);
                }
            }
        
            
            chat.history = chat.history.filter(msg => !runtime.lastResponseTimestamps.includes(msg.timestamp));
        
            
            let newTimestamps = [];
            let messageTimestamp = Date.now();
            
            for (const msgData of newMessagesArray) {
                 if (!msgData || typeof msgData !== 'object' || !msgData.type) {
                    console.warn("在导演模式保存时，发现无效的指令对象，已跳过:", msgData);
                    continue;
                }
        
                let aiMessage = null;
                const baseMessage = { role: 'assistant', senderName: msgData.name || chat.originalName, timestamp: messageTimestamp++ };
        
                switch (msgData.type) {
                    case 'text':
                        aiMessage = { ...baseMessage, content: String(msgData.content || msgData.message) };
                        break;
case 'sticker': { // 保留花括号，让作用域更清晰
            let found = false; // 用于标记是否成功处理了表情数据

            // 优先级 1: 检查 msgData 是否直接提供了 url 和 meaning
            if (msgData.url && msgData.meaning) {
                aiMessage = {
                    ...baseMessage,
                    type: 'sticker',
                    content: msgData.url, // 改用 msgData
                    meaning: msgData.meaning // 改用 msgData
                };
                console.log("导演模式保存(Sticker): 使用了编辑器提供的完整JSON (url + meaning)");
                found = true;
            }
            // 优先级 2: 检查 msgData 是否提供了 meaning (然后尝试查找 URL)
            else if (msgData.meaning) {
                const sticker = runtime.state.userStickers.find(s => s.name === msgData.meaning); // 改用 msgData
                if (sticker) {
                    aiMessage = { ...baseMessage, type: 'sticker', content: sticker.url, meaning: sticker.name };
                    console.log("导演模式保存(Sticker): 使用了 meaning 查找");
                    found = true;
                } else {
                    // 如果提供了 meaning 但找不到表情，就当作普通文本处理
                    aiMessage = { ...baseMessage, type: 'text', content: `[表情: ${msgData.meaning}]` }; // 改用 msgData
                    console.warn("导演模式保存(Sticker): 提供了 meaning 但未找到对应表情:", msgData.meaning); // 改用 msgData
                    found = true; // 仍然标记为已处理 (已转为文本)
                }
            }
            // 优先级 3: 检查 msgData 是否提供了 url (然后尝试查找 meaning)
            else if (msgData.url) { // 改用 msgData
                aiMessage = { ...baseMessage, type: 'sticker', content: msgData.url }; // 改用 msgData
                const stickerByURL = runtime.state.userStickers.find(s => s.url === msgData.url); // 改用 msgData
                aiMessage.meaning = stickerByURL ? stickerByURL.name : '未知表情';
                console.log("导演模式保存(Sticker): 使用了 URL，最终 meaning:", aiMessage.meaning);
                found = true;
            }
            // 优先级 4: 检查 msgData 是否只提供了看起来像 URL 的 content
            else if (msgData.content && typeof msgData.content === 'string' && runtime.STICKER_REGEX.test(msgData.content)) { // 改用 msgData
                 aiMessage = { ...baseMessage, type: 'sticker', content: msgData.content }; // 改用 msgData
                 const stickerByContentUrl = runtime.state.userStickers.find(s => s.url === msgData.content); // 改用 msgData
                 aiMessage.meaning = stickerByContentUrl ? stickerByContentUrl.name : '未知表情';
                 console.log("导演模式保存(Sticker): 将 content 视为 URL，查找到 meaning:", aiMessage.meaning);
                 found = true;
            }


            // 如果以上所有情况都没处理成功
            if (!found) {
                console.error("导演模式保存(Sticker): 指令无效或缺少必要字段 (meaning/url/content):", msgData); // 改用 msgData
                continue; // 跳过这个无效的消息块
            }
            break; // 结束 sticker 的 case
        } // 结束 sticker 代码块
                    case 'ai_image':
                        aiMessage = { ...baseMessage, type: 'ai_image', content: msgData.description };
                        break;
                    case 'voice_message':
                        aiMessage = { ...baseMessage, type: 'voice_message', content: msgData.content };
                        break;
                    case 'transfer':
                        aiMessage = { ...baseMessage, type: 'transfer', amount: msgData.amount, note: msgData.note, receiverName: msgData.receiver || '我' };
                        break;
                    case 'waimai_request':
                        aiMessage = { 
                            ...baseMessage, type: 'waimai_request',
                            productInfo: msgData.productInfo, amount: msgData.amount,
                            status: 'pending', countdownEndTime: Date.now() + 15 * 60 * 1000,
                        };
                        break;
                    case 'offline_text':
                           aiMessage = { ...baseMessage, ...msgData };
                        break;
                    
                    case 'gomoku_move': {
                        const gameState = runtime.gomokuState[chat.id];
                        if (gameState) {
                            
                            const lastAiMoveIndex = gameState.history.findLastIndex(move => move.player === 2);
                            
                            if (lastAiMoveIndex > -1) {
                                const move_to_undo = gameState.history[lastAiMoveIndex];
                                
                                
                                gameState.board[move_to_undo.y][move_to_undo.x] = 0;
                                
                                
                                gameState.history.splice(lastAiMoveIndex, 1);
                                
                                console.log(`导演模式悔棋：已撤销AI在 (${move_to_undo.x}, ${move_to_undo.y}) 的棋步。`);
                            }
                        }

                        
                        const x = parseInt(msgData.x);
                        const y = parseInt(msgData.y);
                        if (!isNaN(x) && !isNaN(y)) {
                            handleAiGomokuMove({ x: x, y: y }, true);
                        } else {
                            console.warn("导演模式保存了一个无效的五子棋移动指令:", msgData);
                        }
                        continue;
                    }
                    case 'update_thoughts': { 
    if (!chat.isGroup) {
        if (msgData.heartfelt_voice) {
            chat.heartfeltVoice = String(msgData.heartfelt_voice);
        }
        if (msgData.random_jottings) {
            chat.randomJottings = String(msgData.random_jottings);
        }
        if (!Array.isArray(chat.thoughtsHistory)) {
            chat.thoughtsHistory = [];
        }
        chat.thoughtsHistory.push({
            heartfeltVoice: chat.heartfeltVoice,
            randomJottings: chat.randomJottings,
            timestamp: Date.now()
        });
        if (chat.thoughtsHistory.length > 50) {
            chat.thoughtsHistory.shift();
        }

        
        
        const thoughtForMemory = `[这是你上一轮的内心独白和思考]
- 心声: ${chat.heartfeltVoice}
- 散记: ${chat.randomJottings}`;
        
        
        const hiddenThoughtMessage = {
            role: 'system',
            content: thoughtForMemory,
            timestamp: Date.now(),
            isHidden: true 
        };

        
        
        
    }
    continue;
                    }
                    
                    
                    case 'quote_reply': {
                        
                        const originalQuotedMsg = chat.history.find(m => m.timestamp === msgData.target_timestamp);
                        let quoteContext = null;

                        if (originalQuotedMsg) {
                            
                            let originalSenderName = originalQuotedMsg.senderName;
                            if (originalQuotedMsg.role === 'user') {
                                originalSenderName = chat.isGroup ? (chat.settings.myNickname || '我') : (runtime.state.qzoneSettings.nickname || '{{user}}');
                            }
                            
                            quoteContext = {
                                timestamp: msgData.target_timestamp,
                                senderName: originalSenderName,
                                content: String(originalQuotedMsg.content || '')
                            };
                        } else {
                            
                            quoteContext = {
                                timestamp: msgData.target_timestamp,
                                senderName: '未知用户',
                                content: '原始消息已删除或不存在'
                            };
                        }
                        
                        
                        aiMessage = { 
                            ...baseMessage, 
                            content: msgData.reply_content,
                            quote: quoteContext
                        };
                        break; 
                    }
                    default:
                         console.warn("在导演模式保存时，遇到了未知的AI指令类型:", msgData.type);
                         break;
                }
        
                if (aiMessage) {
                    chat.history.push(aiMessage);
                    newTimestamps.push(aiMessage.timestamp);
                }
            }
        
            
            await runtime.db.chats.put(chat);
            renderChatInterface(runtime.state.activeChatId);
            renderChatList();
            document.getElementById('ai-response-editor-modal').classList.remove('visible');
            
            
            runtime.lastRawAiResponse = editedRawBlocks.join('\n\n');
            runtime.lastResponseTimestamps = newTimestamps;
            
            
            await showCustomAlert("Director Mode", "Changes saved.");
        }

export async function handleRecallClick() {
            if (!runtime.activeMessageTimestamp) return;
        
            const RECALL_TIME_LIMIT_MS = 2 * 60 * 1000; 
            const messageTime = runtime.activeMessageTimestamp;
            const now = Date.now();
        
            
            if (now - messageTime > RECALL_TIME_LIMIT_MS) {
                hideMessageActions();
                await showCustomAlert("Operation Failed", "Messages can only be recalled within two minutes.");
                return;
            }
            
            
            await recallMessage(messageTime, true);
            hideMessageActions();
        }

export function openAiResponseEditor() {
            if (!runtime.lastRawAiResponse) {
                alert("Generate an AI reply before editing it.");
                return;
            }
        
            const editorModal = document.getElementById('ai-response-editor-modal');
            const editorContainer = document.getElementById('ai-response-editor-container');
            editorContainer.innerHTML = ''; 
        
            
            const jsonMatches = runtime.lastRawAiResponse.match(/{[^{}]*}/g);
            
            if (jsonMatches) {
                jsonMatches.forEach(jsonString => {
                    try {
                        
                        const parsedObject = JSON.parse(jsonString);
                        const formattedJson = JSON.stringify(parsedObject, null, 2);
                        const block = createAiResponseEditorBlock(formattedJson);
                        editorContainer.appendChild(block);
                    } catch (e) {
                        
                        const block = createAiResponseEditorBlock(jsonString);
                        editorContainer.appendChild(block);
                        console.warn("在导演模式中发现一个无效的JSON片段:", jsonString);
                    }
                });
            } else {
                
                const block = createAiResponseEditorBlock(runtime.lastRawAiResponse);
                editorContainer.appendChild(block);
            }
            
            editorModal.classList.add('visible');
        }

export function bindChatEditorEvents() {
  if (runtime.state.globalSettings.enableBackgroundActivity) {
            startBackgroundSimulation();
            console.log("后台活动模拟已自动启动。");
        }

document.querySelectorAll('input[name="theme-select"]').forEach(radio => {
            radio.addEventListener('change', updateSettingsPreview);
        });

controls.fontSizeSlider = document.getElementById('font-size-slider')

controls.fontSizeSlider.addEventListener('input', () => {
            
            document.getElementById('font-size-value').textContent = `${controls.fontSizeSlider.value}px`;
            
            updateSettingsPreview();
        });

controls.customCssInputForPreview = document.getElementById('custom-css-input')

controls.customCssInputForPreview.addEventListener('input', updateSettingsPreview);

document.getElementById('reset-theme-btn').addEventListener('click', () => {
            document.getElementById('theme-default').checked = true;
            updateSettingsPreview();
        });

document.getElementById('reset-custom-css-btn').addEventListener('click', () => {
            document.getElementById('custom-css-input').value = '';
            updateSettingsPreview();
        });

document.getElementById('lyrics-vertical-pos').addEventListener('change', updateSettingsPreview);

document.getElementById('lyrics-horizontal-pos').addEventListener('change', updateSettingsPreview);

document.getElementById('lyrics-offset-input').addEventListener('input', updateSettingsPreview);

document.querySelectorAll('input[name="visibility"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const groupsContainer = document.getElementById('post-visibility-groups');
                if (this.value === 'include' || this.value === 'exclude') {
                    groupsContainer.style.display = 'block';
                } else {
                    groupsContainer.style.display = 'none';
                }
            });
        });

document.getElementById('manage-groups-btn').addEventListener('click', openGroupManager);

document.getElementById('close-group-manager-btn').addEventListener('click', () => {
            document.getElementById('group-management-modal').classList.remove('visible');
            
            const chatSettingsBtn = document.getElementById('chat-settings-btn');
            if (document.getElementById('chat-settings-modal').classList.contains('visible')) {
               chatSettingsBtn.click(); 
            }
        });

document.getElementById('add-new-group-btn').addEventListener('click', addNewGroup);

document.getElementById('existing-groups-list').addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-group-btn')) {
                const groupId = parseInt(e.target.dataset.id);
                deleteGroup(groupId);
            }
        });

document.getElementById('cancel-message-action-btn').addEventListener('click', hideMessageActions);

document.getElementById('edit-message-btn').addEventListener('click', openAdvancedMessageEditor);

document.getElementById('copy-message-btn').addEventListener('click', copyMessageContent);

document.getElementById('recall-message-btn').addEventListener('click', handleRecallClick);

document.getElementById('select-message-btn').addEventListener('click', () => {
            
            const timestampToSelect = runtime.activeMessageTimestamp; 
            hideMessageActions();
            
            if (timestampToSelect) {
                enterSelectionMode(timestampToSelect);
            }
        });

document.getElementById('chat-messages').addEventListener('click', (e) => {
            
            const bubble = e.target.closest('.message-bubble');
            if (!bubble) return; 
        
            
            if (bubble.classList.contains('ai') && 
                bubble.classList.contains('is-transfer') && 
                bubble.dataset.status === 'pending') {
                
                
                const timestamp = parseInt(bubble.dataset.timestamp);
                if (!isNaN(timestamp)) {
                    showTransferActionModal(timestamp);
                }
            }
        });

document.getElementById('transfer-action-accept').addEventListener('click', () => handleUserTransferResponse('accepted'));

document.getElementById('transfer-action-decline').addEventListener('click', () => handleUserTransferResponse('declined'));

document.getElementById('transfer-action-cancel').addEventListener('click', hideTransferActionModal);

document.getElementById('edit-post-btn').addEventListener('click', openPostEditor);

document.getElementById('copy-post-btn').addEventListener('click', copyPostContent);

document.getElementById('cancel-post-action-btn').addEventListener('click', hidePostActions);

document.getElementById('cancel-contact-picker-btn').addEventListener('click', () => {
            showScreen('chat-list-screen');
        });

document.getElementById('contact-picker-list').addEventListener('click', (e) => {
            const item = e.target.closest('.contact-picker-item');
            if (!item) return;
        
            const contactId = item.dataset.contactId;
            item.classList.toggle('selected');
            
            if (runtime.selectedContacts.has(contactId)) {
                runtime.selectedContacts.delete(contactId);
            } else {
                runtime.selectedContacts.add(contactId);
            }
            updateContactPickerConfirmButton();
        });

document.getElementById('manage-members-btn').addEventListener('click', () => {
            
            
            
            openMemberManagementScreen();
        });

document.getElementById('back-from-member-management').addEventListener('click', () => {
        
            showScreen('chat-interface-screen');    
            document.getElementById('chat-settings-btn').click();
        });

document.getElementById('member-management-list').addEventListener('click', (e) => {
            
            if (e.target.classList.contains('remove-member-btn')) {
                removeMemberFromGroup(e.target.dataset.memberId);
            }
        });

document.getElementById('add-existing-contact-btn').addEventListener('click', async () => {
            
            
            const confirmBtn = document.getElementById('confirm-contact-picker-btn');
            
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            newConfirmBtn.addEventListener('click', handleAddMembersToGroup);
            
            await openContactPickerForAddMember();
        });

document.getElementById('create-new-member-btn').addEventListener('click', createNewMemberInGroup);

document.getElementById('video-call-btn').addEventListener('click', handleInitiateCall);

document.getElementById('group-video-call-btn').addEventListener('click', handleInitiateCall);

document.getElementById('hang-up-btn').addEventListener('click', endVideoCall);

document.getElementById('cancel-call-btn').addEventListener('click', () => {
            runtime.videoCallState.isAwaitingResponse = false;
            showScreen('chat-interface-screen');
        });

document.getElementById('join-call-btn').addEventListener('click', handleUserJoinCall);

document.getElementById('decline-call-btn').addEventListener('click', async () => {
            hideIncomingCallModal();
            const chat = runtime.state.chats[runtime.videoCallState.activeChatId];
            if (!chat) return;
            
            
            if (runtime.videoCallState.isGroupCall) {
                runtime.videoCallState.isUserParticipating = false; 
                
                
                const systemNote = {
                    role: 'system',
                    content: `[系统提示：用户拒绝了通话邀请，但你们可以自己开始。请你们各自决策是否加入。]`,
                    timestamp: Date.now(),
                    isHidden: true
                };
                chat.history.push(systemNote);
                await runtime.db.chats.put(chat);
                
                
                
                await triggerAiResponse(); 
                
            } else { 
                const declineMessage = { role: 'user', content: '我拒绝了你的视频通话请求。', timestamp: Date.now() };
                chat.history.push(declineMessage);
                await runtime.db.chats.put(chat);
                
                
                showScreen('chat-interface-screen');
                appendMessage(declineMessage, chat);
                
                
                triggerAiResponse();
            }
            
            
            runtime.videoCallState.isAwaitingResponse = false;
        });

document.getElementById('accept-call-btn').addEventListener('click', async () => {
            hideIncomingCallModal();
            
            runtime.videoCallState.initiator = 'ai';
            runtime.videoCallState.isUserParticipating = true;
            runtime.videoCallState.activeChatId = runtime.state.activeChatId;
            
            
            if (runtime.videoCallState.isGroupCall) {
                
                const chat = runtime.state.chats[runtime.videoCallState.activeChatId];
                const requester = chat.members.find(m => m.name === runtime.videoCallState.callRequester);
                if (requester) {
                    
                    runtime.videoCallState.participants = [requester];
                } else {
                    runtime.videoCallState.participants = []; 
                }
            }
            
            
            startVideoCall();
        });

document.getElementById('user-speak-btn').addEventListener('click', async () => {
            if (!runtime.videoCallState.isActive) return;
        
            
            const userAvatar = document.querySelector('.participant-avatar-wrapper[data-participant-id="user"] .participant-avatar');
            if (userAvatar) {
                userAvatar.classList.add('speaking');
            }
        
            const userInput = await showCustomPrompt("You said", "Enter your message…");
            
            
            if (userAvatar) {
                userAvatar.classList.remove('speaking');
            }
        
            if (userInput && userInput.trim()) {
                triggerAiInCallAction(userInput.trim());
            }
        });
}
