import { triggerAiResponse } from './ai.js'
import { addPollOptionInput, handlePaymentButtonClick, openCreatePollModal, sendDirectRedPacket, sendGroupRedPacket, sendPoll, triggerAiFriendApplication } from './attachments.js'
import { appendMessage, renderChatInterface } from './conversation.js'
import { renderChatList } from './list.js'
import { exitSelectionMode, messageDeletionMode, messagesSelectedForDeletion } from './messages.js'
import { deleteMessages, getActiveChat } from '../../features/chat/sessions'
import { replyTimestamp } from '../../features/chat/reply-turns'
import { showScreen } from '../../app/routes'
import { showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { closePersonaEditor, closePersonaLibrary, deletePersonaPreset, hidePresetActions, openPersonaEditorForCreate, openPersonaEditorForEdit, openPersonaLibrary, savePersonaPreset } from '../personas/personas.js'
import { renderMemoriesScreen } from '../qzone/feed.js'
import { renderStickerPanel } from '../stickers/stickers.js'
import { importStickers, loadStickers, readStickerFile } from '../../features/stickers/library'
import { switchToChatListView } from '../app/screen-effects.js'
import { controls } from '../runtime/state.js'
import { runtime } from '../runtime/state.js'
import { fileDataUrl, imageSource } from '../../runtime/files'
import { maySendImages } from '../../features/api/image-input'

export function bindChatAttachmentEvents() {
  document.getElementById('upload-sticker-btn').addEventListener('click', () => document.getElementById('sticker-upload-input').click());

document.getElementById('sticker-upload-input').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
        const sticker = await readStickerFile(file);
        const name = await showCustomPrompt('Name sticker', 'Enter a name for this sticker', sticker.name);
        if (name === null) return;
        if (!name.trim()) throw new Error('Enter a sticker name.');
        const categories = await runtime.db.stickerCategories.toArray();
        const category = categories.find(item => String(item.id) === String(runtime.activeStickerCategoryId));
        await importStickers(runtime.db, [{ ...sticker, name: name.trim() }], category?.id ?? null);
        await loadStickers(runtime.db);
        if (runtime.activeStickerCategoryId === 'assigned') runtime.activeStickerCategoryId = 'all';
        await renderStickerPanel();
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('upload-image-btn').addEventListener('click', () => document.getElementById('image-upload-input').click());

document.getElementById('image-upload-input').addEventListener('change', async event => {
    const file = event.target.files[0];
    const chat = runtime.state.chats[runtime.state.activeChatId];
    const session = chat?.conversationId;
    event.target.value = '';
    if (!file || !chat) return;
    try {
        const url = imageSource(await fileDataUrl(file));
        if (!url) throw new Error('Choose a supported image.');
        const description = maySendImages() ? '' : await showCustomPrompt('Describe the photo', 'Enter a short description for the AI');
        if (description === null || runtime.state.activeChatId !== chat.id || chat.conversationId !== session) return;
        const msg = { role: 'user', content: [{ type: 'image_url', image_url: { url } }], imageDescription: description.trim().slice(0, 500), timestamp: Date.now() };
        const history = [...chat.history, msg];
        if (!await runtime.db.chats.update(chat.id, { history })) return;
        chat.history = history;
        appendMessage(msg, chat);
        renderChatList();
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('voice-message-btn').addEventListener('click', async () => {
    if (!runtime.state.activeChatId) return;

    const text = await showCustomPrompt("Send Voice Message", "Enter your message");
    if (text && text.trim()) {
        const chat = runtime.state.chats[runtime.state.activeChatId];
        
        
        const msg = {
            role: 'user',
            type: 'voice_message', 
            content: text.trim(),
            timestamp: Date.now()
        };
        
        chat.history.push(msg);
        await runtime.db.chats.put(chat);
        appendMessage(msg, chat);
        renderChatList();
    }
});

document.getElementById('send-photo-btn').addEventListener('click', async () => { if (!runtime.state.activeChatId) return; const description = await showCustomPrompt("Send Photo", "Describe the photo you want to send"); if (description && description.trim()) { const chat = runtime.state.chats[runtime.state.activeChatId]; const msg = { role: 'user', type: 'user_photo', content: description.trim(), timestamp: Date.now() }; chat.history.push(msg); await runtime.db.chats.put(chat); appendMessage(msg, chat); renderChatList(); } });

controls.waimaiModal = document.getElementById('waimai-request-modal')

document.getElementById('send-waimai-request-btn').addEventListener('click', () => {
    controls.waimaiModal.classList.add('visible');
});

controls.waimaiModal.addEventListener('click', (e) => {
    
    if (e.target === controls.waimaiModal) {
        controls.waimaiModal.classList.remove('visible');
    }
});

document.getElementById('waimai-order-for-ai-btn').addEventListener('click', () => {
    const chatId = runtime.state.activeChatId;
    if (!chatId) return;
    controls.waimaiModal.classList.remove('visible');
    showScreen('market-screen', { from: 'chat', chatId, food: true });
});

document.getElementById('waimai-confirm-btn').addEventListener('click', async () => {
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
    
    const msg = {
        role: 'user',
        senderName: myNickname, 
        type: 'waimai_request',
        productInfo: productInfo,
        amount: amount,
        status: 'pending',
        countdownEndTime: now + 15 * 60 * 1000,
        timestamp: now
    };

    chat.history.push(msg);
    await runtime.db.chats.put(chat);
    appendMessage(msg, chat);
    renderChatList();

    productInfoInput.value = '';
    amountInput.value = '';
    controls.waimaiModal.classList.remove('visible');
});

document.getElementById('open-persona-library-btn').addEventListener('click', openPersonaLibrary);

document.getElementById('close-persona-library-btn').addEventListener('click', closePersonaLibrary);

document.getElementById('add-persona-preset-btn').addEventListener('click', openPersonaEditorForCreate);

document.getElementById('cancel-persona-editor-btn').addEventListener('click', closePersonaEditor);

document.getElementById('save-persona-preset-btn').addEventListener('click', savePersonaPreset);

document.getElementById('preset-action-edit').addEventListener('click', openPersonaEditorForEdit);

document.getElementById('preset-action-delete').addEventListener('click', deletePersonaPreset);

document.getElementById('preset-action-cancel').addEventListener('click', hidePresetActions);

document.getElementById('selection-cancel-btn').addEventListener('click', exitSelectionMode);

async function removeSelection(event, notify) {
    const button = event.currentTarget;
    const chat = getActiveChat();
    if (!chat || button.disabled || button.getAttribute('aria-busy') === 'true') return;
    const messages = messagesSelectedForDeletion(chat);
    if (!messages.length) return;
    const error = document.getElementById('qq-delete-error');
    error.textContent = '';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
        const mode = messageDeletionMode();
        if (!mode) {
            const confirmed = await showCustomConfirm('Delete messages',
                `Delete ${messages.length} selected messages${notify ? ' and notify the AI' : ''}?`,
                { confirmButtonClass: 'btn-danger' });
            if (!confirmed) return;
        }
        let notice;
        if (notify) {
            const polls = messages.filter(message => message.type === 'poll')
                .map(message => `"${message.question}" (timestamp: ${message.timestamp})`);
            const details = polls.length ? ' This includes these polls: ' + polls.join(', ') + '.' : '';
            notice = {
                role: 'system', isHidden: true, timestamp: replyTimestamp(chat.history),
                content: '[System notice: The user deleted some earlier messages.' + details +
                    ' Continue as if the deleted messages never existed. Adjust what you recall and how you act, and do not mention them again.]',
            };
        }
        await deleteMessages(chat, messages, notice, mode === 'range');
    } catch (failure) {
        error.textContent = failure.message || 'Could not delete the selected messages.';
    } finally {
        button.removeAttribute('aria-busy');
        if (runtime.isSelectionMode) button.disabled = messagesSelectedForDeletion(chat).length === 0;
    }
}

document.getElementById('selection-erase-btn').addEventListener('click', event => void removeSelection(event, false));
document.getElementById('selection-soft-delete-btn').addEventListener('click', event => void removeSelection(event, true));
}

export function bindGroupAttachments() {
  document.querySelector('.nav-item[data-view="memories-view"]')?.addEventListener('click', () => {
            
            if (runtime.isFavoritesSelectionMode) {
                document.getElementById('favorites-edit-btn').click(); 
            }
            switchToChatListView('memories-view');
            renderMemoriesScreen(); 
        });

document.getElementById('memories-back-btn').addEventListener('click', () => switchToChatListView('messages-view'));

document.getElementById('confirm-create-countdown-btn').addEventListener('click', async () => {
            const title = document.getElementById('countdown-title-input').value.trim();
            const dateValue = document.getElementById('countdown-date-input').value;
            
            if (!title || !dateValue) {
                alert("Enter a title and date for the countdown.");
                return;
            }
        
            const targetDate = new Date(dateValue);
            if (isNaN(targetDate) || targetDate <= new Date()) {
                alert("Choose a valid future date.");
                return;
            }
        
            
            const newCountdown = {
                authorId: 'user', 
                description: title,
                timestamp: Date.now(),
                type: 'countdown',
                targetDate: targetDate.getTime()
            };
              
            
            await runtime.db.memories.add(newCountdown);
            document.getElementById('create-countdown-modal').classList.remove('visible');
            renderMemoriesScreen();
        });

document.getElementById('block-chat-btn').addEventListener('click', async () => {
            if (!runtime.state.activeChatId || runtime.state.chats[runtime.state.activeChatId].isGroup) return;
        
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const confirmed = await showCustomConfirm(
                "Block Character", 
                `Block “${chat.name}”? You can send messages again after unblocking the character or accepting a new friend request.`,
                { confirmButtonClass: 'btn-danger' }
            );
        
            if (confirmed) {
                chat.relationship.status = 'blocked_by_user';
                chat.relationship.blockedTimestamp = Date.now();
        
                
                const hiddenMessage = {
                    role: 'system',
                    content: `[System notice: The user blocked you. You cannot initiate or respond to messages until they unblock you.]`,
                    timestamp: Date.now() + 1,
                    isHidden: true
                };
                chat.history.push(hiddenMessage);
                  
        
                await runtime.db.chats.put(chat);
                
                
                document.getElementById('chat-settings-modal').classList.remove('visible');
                renderChatInterface(runtime.state.activeChatId);
                
                renderChatList();
            }
        });

document.getElementById('chat-lock-overlay').addEventListener('click', async (e) => {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat) return;
        
            if (e.target.id === 'force-apply-check-btn') {
                alert("Asking the character whether to send a friend request…");
                await triggerAiFriendApplication(chat.id);
                renderChatInterface(chat.id); 
                return;
            }
        
            if (e.target.id === 'unblock-btn') {
                chat.relationship.status = 'friend';
                chat.relationship.blockedTimestamp = null;
        
                
                const hiddenMessage = {
                    role: 'system',
                    content: `[System notice: The user unblocked you. You can talk again.]`,
                    timestamp: Date.now(),
                    isHidden: true
                };
                chat.history.push(hiddenMessage);
                  
        
                await runtime.db.chats.put(chat);
                renderChatInterface(chat.id);
                renderChatList();
                triggerAiResponse(); 
            }
        else if (e.target.id === 'accept-friend-btn') {
                
                
        
                
                chat.relationship.status = 'friend';
                chat.relationship.applicationReason = '';
        
                
                const systemMessage = {
                    role: 'system',
                    type: 'pat_message', 
                    content: `你通过了“${chat.name}”的好友请求`,
                    timestamp: Date.now()
                };
                chat.history.push(systemMessage);
        
                
                const welcomeMessage = {
                    role: 'assistant',
                    senderName: chat.name,
                    content: '太好了！我们又可以聊天啦！',
                    timestamp: Date.now() + 1 
                };
                chat.history.push(welcomeMessage);
        
                
                await runtime.db.chats.put(chat);
        
                
                renderChatInterface(chat.id);
                renderChatList();
            }
            else if (e.target.id === 'reject-friend-btn') {
                chat.relationship.status = 'blocked_by_user';
                chat.relationship.blockedTimestamp = Date.now();
                chat.relationship.applicationReason = '';
                await runtime.db.chats.put(chat);
                renderChatInterface(chat.id);
            }
            
            else if (e.target.id === 'apply-friend-btn') {
                const reason = await showCustomPrompt(
                    "Send Friend Request", 
                    `Enter a message for “${chat.name}”`,
                    "我们和好吧！"
                );
                
                if (reason !== null) {
                    
                    chat.relationship.status = 'pending_ai_approval';
                    chat.relationship.applicationReason = reason;
                    await runtime.db.chats.put(chat);
        
                    
                    renderChatInterface(chat.id);
                    renderChatList();
                    
                    
                    triggerAiResponse();
                }
            }
        });

document.getElementById('transfer-btn').addEventListener('click', handlePaymentButtonClick);

document.getElementById('cancel-red-packet-btn').addEventListener('click', () => {
            document.getElementById('red-packet-modal').classList.remove('visible');
        });

document.getElementById('send-group-packet-btn').addEventListener('click', sendGroupRedPacket);

document.getElementById('send-direct-packet-btn').addEventListener('click', sendDirectRedPacket);

controls.rpTabGroup = document.getElementById('rp-tab-group')

controls.rpTabDirect = document.getElementById('rp-tab-direct')

controls.rpContentGroup = document.getElementById('rp-content-group')

controls.rpContentDirect = document.getElementById('rp-content-direct')

controls.rpTabGroup.addEventListener('click', () => {
            controls.rpTabGroup.classList.add('active');
            controls.rpTabDirect.classList.remove('active');
            controls.rpContentGroup.style.display = 'block';
            controls.rpContentDirect.style.display = 'none';
        });

controls.rpTabDirect.addEventListener('click', () => {
            controls.rpTabDirect.classList.add('active');
            controls.rpTabGroup.classList.remove('active');
            controls.rpContentDirect.style.display = 'block';
            controls.rpContentGroup.style.display = 'none';
        });

document.getElementById('rp-group-amount').addEventListener('input', (e) => {
            const amount = parseFloat(e.target.value) || 0;
            document.getElementById('rp-group-total').textContent = `¥ ${amount.toFixed(2)}`;
        });

document.getElementById('rp-direct-amount').addEventListener('input', (e) => {
            const amount = parseFloat(e.target.value) || 0;
            document.getElementById('rp-direct-total').textContent = `¥ ${amount.toFixed(2)}`;
        });

document.getElementById('send-poll-btn').addEventListener('click', openCreatePollModal);

document.getElementById('add-poll-option-btn').addEventListener('click', addPollOptionInput);

document.getElementById('cancel-create-poll-btn').addEventListener('click', () => {
            document.getElementById('create-poll-modal').classList.remove('visible');
        });

document.getElementById('confirm-create-poll-btn').addEventListener('click', sendPoll);
}
