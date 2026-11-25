import { postTransfer, transferCents, TransferError } from '../../features/bank/bank'
import { mutateConversation } from '../../features/chat/sessions'
import { triggerAiResponse } from './ai.js'
import { cleanupWaimaiTimers } from './attachments.js'
import { appendMessage, renderChatInterface } from './conversation.js'
import { hideMessageActions } from './editor.js'
import { getDisplayNameInGroup } from './groups.js'
import { renderChatList } from './list.js'
import { showCustomPrompt } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'
import { closeStickerPicker } from '../stickers/stickers.js'

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
        closeStickerPicker(true);
    }
    renderChatList();
}

export async function sendUserTransfer() {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return;
    const amountInput = document.getElementById('transfer-amount');
    const noteInput = document.getElementById('transfer-note');
    const confirm = document.getElementById('transfer-confirm-btn');
    if (confirm.disabled) return;
    const cents = transferCents(amountInput.value);
    if (!Number.isSafeInteger(cents) || cents <= 0) {
        alert('Enter a positive amount with at most two decimal places.');
        return;
    }
    const timestamp = Math.max(Date.now(), (chat.history.at(-1)?.timestamp || 0) + 1);
    const note = noteInput.value.trim();
    const id = crypto.randomUUID();
    const msg = {
        role: 'user', type: 'transfer', amount: cents / 100, note, timestamp,
        senderName: chat.settings.myNickname || 'You', receiverName: chat.name,
        ...(chat.isGroup ? {} : { bankTransferId: id, status: 'accepted' })
    };
    confirm.disabled = true;
    try {
        await mutateConversation(chat, async () => {
            if (chat.isGroup) await runtime.db.chats.update(chat.id, { history: [...chat.history, msg] });
            else await postTransfer(runtime.db, { id, from: 'user', to: chat.id, cents, note, timestamp }, chat, msg);
            chat.history.push(msg);
        });
        if (runtime.state.activeChatId === chat.id) appendMessage(msg, chat);
        void renderChatList();
        document.getElementById('transfer-modal').classList.remove('visible');
        amountInput.value = '';
        noteInput.value = '';
    } catch (error) {
        if (!(error instanceof TransferError)) console.error('Could not save transfer', error);
        alert(error instanceof Error ? error.message : 'Could not save transfer.');
    } finally {
        confirm.disabled = false;
    }
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

let deleteMode;
let rangeStart;
const deleteSelection = new Set();

function refreshSelection() {
    const removing = deleteMode ? deleteSelection : runtime.selectedMessages;
    const removeButton = document.getElementById('selection-erase-btn');
    document.getElementById('selection-count').textContent = removing.size + ' selected';
    removeButton.disabled = removing.size === 0 || removeButton.getAttribute('aria-busy') === 'true';
    removeButton.textContent = deleteMode ? 'Delete (' + removing.size + ')' : 'Delete Permanently';
    document.querySelectorAll('#chat-messages .qq-message-checkbox').forEach(checkbox => checkbox.syncSelection());
}

export function enterSelectionMode(initialMessage, mode) {
    if (runtime.isSelectionMode) return;
    runtime.isSelectionMode = true;
    deleteMode = mode;
    const screen = document.getElementById('chat-interface-screen');
    screen.classList.add('selection-mode');
    screen.classList.toggle('qq-delete-mode', Boolean(mode));
    document.getElementById('qq-delete-hint').textContent = mode === 'range'
        ? 'Tap the first bubble to delete from that point onward.' : 'Tap the bubbles you want to delete.';
    if (initialMessage !== undefined) toggleMessageSelection(initialMessage);
    refreshSelection();
}

export function exitSelectionMode() {
    cleanupWaimaiTimers();
    if (!runtime.isSelectionMode) return;
    runtime.isSelectionMode = false;
    document.getElementById('chat-interface-screen').classList.remove('selection-mode', 'qq-delete-mode');
    runtime.selectedMessages.clear();
    deleteSelection.clear();
    deleteMode = undefined;
    rangeStart = undefined;
    document.getElementById('qq-delete-error').textContent = '';
    refreshSelection();
}

function toggleMessageSelection(target) {
    const history = runtime.state.chats[runtime.state.activeChatId]?.history;
    const message = typeof target === 'number' ? history?.find(item => item.timestamp === target && !item.isHidden) : target;
    if (!message || !history?.includes(message)) return;
    if (deleteMode === 'range') {
        const repeated = rangeStart === message;
        rangeStart = repeated ? undefined : message;
        deleteSelection.clear();
        if (!repeated) {
            history.slice(history.indexOf(message)).filter(item => !item.isHidden && !item.isTemporary)
                .forEach(item => deleteSelection.add(item));
        }
    } else {
        const selected = deleteMode ? deleteSelection : runtime.selectedMessages;
        const key = deleteMode ? message : message.timestamp;
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
    }
    refreshSelection();
}

export function messagesSelectedForDeletion(chat) {
    if (deleteMode === 'range') {
        const start = chat.history.indexOf(rangeStart);
        return start >= 0 ? chat.history.slice(start) : [];
    }
    return chat.history.filter(message => deleteMode ? deleteSelection.has(message) : runtime.selectedMessages.has(message.timestamp));
}

export function messageDeletionMode() {
    return deleteMode;
}

export function bindMessageSelection(wrapper, bubble, message) {
    if (message.isHidden || message.isTemporary || message.timestamp == null) return;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'qq-message-checkbox';
    checkbox.setAttribute('aria-label', 'Select message');
    checkbox.syncSelection = () => {
        checkbox.checked = deleteMode ? deleteSelection.has(message) : runtime.selectedMessages.has(message.timestamp);
        bubble.classList.toggle('selected', checkbox.checked);
    };
    checkbox.syncSelection();
    checkbox.addEventListener('change', () => toggleMessageSelection(message));
    wrapper.prepend(checkbox);
    wrapper.addEventListener('click', event => {
        if (!runtime.isSelectionMode || event.target === checkbox) return;
        event.preventDefault();
        event.stopPropagation();
        toggleMessageSelection(message);
    }, true);
}

export function startReplyToMessage() {
            if (!runtime.activeMessageTimestamp) return;
        
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const message = chat.history.find(m => m.timestamp === runtime.activeMessageTimestamp);
            if (!message) return;
        
            
            let senderDisplayName;
            if (message.role === 'user') {
                senderDisplayName = chat.settings.myNickname || 'You';
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
                previewSnippet = '[Sticker]';
            } else if (message.type === 'ai_image' || message.type === 'user_photo') {
                previewSnippet = '[Image]';
            } else if (message.type === 'voice_message') {
                previewSnippet = '[Voice message]';
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
    messageToRecall.content = isUserRecall ? 'You recalled a message.' : 'The character recalled a message.';
    messageToRecall.recalledData = recalledData;
    delete messageToRecall.meaning;
    delete messageToRecall.quote;

    
    if (isUserRecall) {
        
        const myNickname = chat.isGroup ? (chat.settings.myNickname || '我') : '我';
        
        
        let recalledContentText = '';
        if (recalledData.originalType === 'sticker') {
            recalledContentText = `[Sticker meaning: ${recalledData.originalMeaning || 'unknown'}]`;
        } else if (recalledData.originalType === 'ai_image' || recalledData.originalType === 'user_photo') {
            recalledContentText = `[Image description: ${recalledData.originalContent}]`;
        } else {
            recalledContentText = `“${String(recalledData.originalContent)}”`;
        }

        
        const hiddenMessageForAI = {
            role: 'system',
            content: `[System notice: The user (${myNickname}) recalled a message. Its original content was ${recalledContentText}. React in character with curiosity, a joke such as "I took a screenshot!", understanding, or confusion.]`,
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
