import { triggerAiResponse } from './ai.js'
import { cleanupWaimaiTimers } from './attachments.js'
import { appendMessage, renderChatInterface } from './conversation.js'
import { hideMessageActions } from './editor.js'
import { getDisplayNameInGroup } from './groups.js'
import { renderChatList } from './list.js'
import { showCustomPrompt } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export async function sendSticker(sticker) {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return;
    const session = chat.conversationId;
    const message = { role: 'user', type: 'sticker', content: sticker.url, meaning: sticker.name, timestamp: Date.now() };
    const history = await runtime.db.transaction('rw', runtime.db.chats, async tx => {
        const current = await tx.chats.get(chat.id);
        if (!current || current.conversationId !== session) return;
        const updated = [...(current.history ?? []), message];
        await tx.chats.update(chat.id, { history: updated });
        return updated;
    });
    if (!history || chat.conversationId !== session) return;
    chat.history = history;
    if (runtime.state.activeChatId === chat.id) {
        appendMessage(message, chat);
        document.getElementById('sticker-panel').classList.remove('visible');
    }
    renderChatList();
}

export async function sendUserTransfer() { if (!runtime.state.activeChatId) return; const amountInput = document.getElementById('transfer-amount'); const noteInput = document.getElementById('transfer-note'); const amount = parseFloat(amountInput.value); const note = noteInput.value.trim(); if (isNaN(amount) || amount < 0) { alert("Enter an amount greater than zero."); return; } const chat = runtime.state.chats[runtime.state.activeChatId]; const senderName = chat.isGroup ? (chat.settings.myNickname || '我') : '我'; const receiverName = chat.isGroup ? '群聊' : chat.name; const msg = { role: 'user', type: 'transfer', amount: amount, note: note, senderName, receiverName, timestamp: Date.now() }; chat.history.push(msg); await runtime.db.chats.put(chat); appendMessage(msg, chat); renderChatList(); document.getElementById('transfer-modal').classList.remove('visible'); amountInput.value = ''; noteInput.value = ''; }

export async function sendWaimaiOrderForAI() {
    if (!runtime.state.activeChatId) return;
    
    const productInfoInput = document.getElementById('waimai-product-info');
    const amountInput = document.getElementById('waimai-amount');
    
    const productInfo = productInfoInput.value.trim();
    const amount = parseFloat(amountInput.value);

    if (!productInfo || isNaN(amount) || amount <= 0) {
        alert("Enter valid item details and an amount.");
        return;
    }

    const chat = runtime.state.chats[runtime.state.activeChatId];
    const now = Date.now();
    const myNickname = chat.isGroup ? (chat.settings.myNickname || '我') : '我';

    
    const visibleMessage = {
        role: 'user',
        senderName: myNickname, 
        type: 'waimai_order',
        productInfo: productInfo,
        amount: amount,
        timestamp: now
    };
    chat.history.push(visibleMessage);

    
    const hiddenMessage = {
        role: 'system',
        content: `[系统提示：用户(${myNickname})为你点了一份外卖作为【礼物】。外卖内容是“${productInfo}”，价值${amount}元。这不是一个代付请求，而是用户已经为你支付了。请你对此表示感谢。]`,
        timestamp: now + 1,
        isHidden: true
    };
    chat.history.push(hiddenMessage);

    
    await runtime.db.chats.put(chat);
    appendMessage(visibleMessage, chat);
    renderChatList();

    
    productInfoInput.value = '';
    amountInput.value = '';
    document.getElementById('waimai-request-modal').classList.remove('visible');

    
    
}

export async function sendLocationShare() {
            if (!runtime.state.activeChatId) return;
        
            
            const locationName = await showCustomPrompt("Share Location", "Where are you now?", "");
        
            
            if (!locationName || !locationName.trim()) return; 
        
            
            
            const hardcodedImageUrl = 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1756262526935_qdqqd_4uque3.jpeg';
        
            const chat = runtime.state.chats[runtime.state.activeChatId];
            
            
            const msg = {
                role: 'user',
                type: 'location_share',
                content: locationName.trim(),
                imageUrl: hardcodedImageUrl, 
                timestamp: Date.now()
            };
            
            
            chat.history.push(msg);
            await runtime.db.chats.put(chat);
            appendMessage(msg, chat);
            renderChatList();
        }

export function enterSelectionMode(initialMsgTimestamp) { if (runtime.isSelectionMode) return; runtime.isSelectionMode = true; document.getElementById('chat-interface-screen').classList.add('selection-mode'); toggleMessageSelection(initialMsgTimestamp); }

export function exitSelectionMode() {
            cleanupWaimaiTimers(); 
         if (!runtime.isSelectionMode) return; runtime.isSelectionMode = false; document.getElementById('chat-interface-screen').classList.remove('selection-mode'); runtime.selectedMessages.forEach(ts => { const bubble = document.querySelector(`.message-bubble[data-timestamp="${ts}"]`); if (bubble) bubble.classList.remove('selected'); }); runtime.selectedMessages.clear(); }

export function toggleMessageSelection(timestamp) {
            
            const elementToSelect = document.querySelector(
                `.message-bubble[data-timestamp="${timestamp}"]`
            );
        
            if (!elementToSelect) return;
        
            if (runtime.selectedMessages.has(timestamp)) {
                runtime.selectedMessages.delete(timestamp);
                elementToSelect.classList.remove('selected');
            } else {
                runtime.selectedMessages.add(timestamp);
                elementToSelect.classList.add('selected');
            }
            
            document.getElementById('selection-count').textContent = `${runtime.selectedMessages.size} selected`;
            
            if (runtime.selectedMessages.size === 0) {
                exitSelectionMode();
            }
        }

export function startReplyToMessage() {
            if (!runtime.activeMessageTimestamp) return;
        
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const message = chat.history.find(m => m.timestamp === runtime.activeMessageTimestamp);
            if (!message) return;
        
            
            let senderDisplayName;
            if (message.role === 'user') {
                senderDisplayName = chat.isGroup ? (chat.settings.myNickname || '我') : '我';
            } else { 
                if (chat.isGroup) {
                    
                    senderDisplayName = getDisplayNameInGroup(chat, message.senderName);
                } else {
                    
                    senderDisplayName = chat.name;
                }
            }
            
        
            const fullContent = String(message.content || '');
            let previewSnippet = '';
        
            if (typeof message.content === 'string' && runtime.STICKER_REGEX.test(message.content)) {
                previewSnippet = '[表情]';
            } else if (message.type === 'ai_image' || message.type === 'user_photo') {
                previewSnippet = '[图片]';
            } else if (message.type === 'voice_message') {
                previewSnippet = '[语音]';
            } else {
                previewSnippet = fullContent.substring(0, 50) + (fullContent.length > 50 ? '...' : '');
            }
        
            runtime.currentReplyContext = {
                timestamp: message.timestamp,
                senderName: senderDisplayName, 
                content: fullContent, 
            };
        
            const previewBar = document.getElementById('reply-preview-bar');
            previewBar.querySelector('.sender').textContent = `Replying to ${runtime.currentReplyContext.senderName}:`;
            previewBar.querySelector('.text').textContent = previewSnippet;
            previewBar.style.display = 'block';
        
            hideMessageActions();
            document.getElementById('chat-input').focus();
        }

export async function recallMessage(timestamp, isUserRecall) {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return;

    const messageIndex = chat.history.findIndex(m => m.timestamp === timestamp);
    if (messageIndex === -1) return;

    const messageToRecall = chat.history[messageIndex];

    const recalledData = {
        originalType: messageToRecall.type || 'text',
        originalContent: messageToRecall.content,
        originalMeaning: messageToRecall.meaning,
        originalQuote: messageToRecall.quote
    };
    
    messageToRecall.type = 'recalled_message';
    messageToRecall.content = isUserRecall ? '你撤回了一条消息' : '对方撤回了一条消息';
    messageToRecall.recalledData = recalledData;
    delete messageToRecall.meaning;
    delete messageToRecall.quote;

    
    if (isUserRecall) {
        
        const myNickname = chat.isGroup ? (chat.settings.myNickname || '我') : '我';
        
        
        let recalledContentText = '';
        if (recalledData.originalType === 'sticker') {
            recalledContentText = `[表情，含义: ${recalledData.originalMeaning || '未知'}]`;
        } else if (recalledData.originalType === 'ai_image' || recalledData.originalType === 'user_photo') {
            recalledContentText = `[图片，描述: ${recalledData.originalContent}]`;
        } else {
            recalledContentText = `“${String(recalledData.originalContent)}”`;
        }

        
        const hiddenMessageForAI = {
            role: 'system',
            content: `[系统提示：用户（${myNickname}）刚刚撤回了一条消息。撤回前的内容是：${recalledContentText}。请你对此作出回应，可以表现出好奇、开玩笑（比如'我截图了！'）、或者根据你的人设表示理解或疑惑。]`,
            timestamp: Date.now(),
            isHidden: true 
        };
        chat.history.push(hiddenMessageForAI);
    }
      

    await runtime.db.chats.put(chat);
    renderChatInterface(runtime.state.activeChatId);
    
    if (isUserRecall) {
        renderChatList();
        
        triggerAiResponse();
    }
}
