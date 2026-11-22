import { handleUserPat } from './attachments.js'
import { openChat } from './conversation.js'
import { getDisplayNameInGroup, openContactPickerForGroupCreate } from './groups.js'
import { addLongPressListener, showCustomConfirm, showChoiceModal, showCustomPrompt } from '../dialogs/dialogs.js'
import { hideLoader, showLoader } from '../dialogs/dialogs.js'
import { endListenTogetherSession } from '../music/player.js'
import { runtime } from '../runtime/state.js'
import { applyScopedCss } from '../appearance/theme.js'
import { handleCardImport } from './import.js'
import { exitSelectionMode } from './messages.js'
import { showScreen } from '../../app/routes'
import { controls } from '../runtime/state.js'

export function createChatGroupContainer(group) {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'chat-group-container';
            groupContainer.innerHTML = `
                <div class="chat-group-header">
                    <span class="arrow">▼</span>
                    <span class="group-name">${group.name}</span>
                </div>
                <div class="chat-group-content"></div>
            `;
            return groupContainer;
        }

export function loadMoreChats() {
            if (runtime.isLoadingMoreChats) return;

            const chatListEl = document.getElementById('chat-list');
            const scrollContainer = document.getElementById('messages-view');
            if (!chatListEl || !scrollContainer) return;
            if (runtime.chatListRenderCount >= runtime.sortedChatListItems.length) return;

            runtime.isLoadingMoreChats = true;

            
            const isInitialLoad = runtime.chatListRenderCount === 0;

            
            const renderContent = () => {
                hideLoader(chatListEl);

                const renderWindow = runtime.state.globalSettings.chatListRenderWindow || 30;
                const nextSliceStart = runtime.chatListRenderCount;
                const nextSliceEnd = runtime.chatListRenderCount + renderWindow;
                const itemsToAppend = runtime.sortedChatListItems.slice(nextSliceStart, nextSliceEnd);

                const fragment = document.createDocumentFragment();
                let currentGroupContent = chatListEl.querySelector('.chat-group-content:last-of-type');

                itemsToAppend.forEach(item => {
                    if (item.type === 'groupHeader') {
                        const groupContainer = createChatGroupContainer(item.group);
                        fragment.appendChild(groupContainer);
                        currentGroupContent = groupContainer.querySelector('.chat-group-content');
                    } else if (item.type === 'chatItem') {
                        const listItem = createChatListItem(item.chat);
                        if (item.chat.groupId && currentGroupContent) {
                            currentGroupContent.appendChild(listItem);
                        } else {
                            fragment.appendChild(listItem);
                            if (!item.chat.groupId) currentGroupContent = null;
                        }
                    }
                });

                chatListEl.appendChild(fragment);
                runtime.chatListRenderCount += itemsToAppend.length;

                chatListEl.querySelectorAll('.chat-group-header:not([data-has-listener="true"])').forEach(header => {
                    header.dataset.hasListener = "true";
                    header.addEventListener('click', () => {
                        header.classList.toggle('collapsed');
                        header.nextElementSibling.classList.toggle('collapsed');
                    });
                });

                runtime.isLoadingMoreChats = false;

                if (scrollContainer.scrollHeight <= scrollContainer.clientHeight && runtime.chatListRenderCount < runtime.sortedChatListItems.length) {
                    loadMoreChats();
                }
            };

            
            if (isInitialLoad) {
                
                renderContent();
            } else {
                
                showLoader(chatListEl, 'bottom');
                setTimeout(renderContent, 500);
            }
        }

export async function renderChatList() {
    const chatListEl = document.getElementById('chat-list');
    chatListEl.innerHTML = '';

    
    const allChats = Object.values(runtime.state.chats).sort((a, b) => {
        const pinDiff = (b.isPinned || false) - (a.isPinned || false);
        if (pinDiff !== 0) return pinDiff;
        return (b.history.slice(-1)[0]?.timestamp || 0) - (a.history.slice(-1)[0]?.timestamp || 0);
    });
    
    const allGroups = await runtime.db.qzoneGroups.toArray();

    if (allChats.length === 0) {
        chatListEl.innerHTML = "<p style=\"text-align:center; color: #8a8a8a; margin-top: 50px;\">Use the plus or group button to start a chat.</p>";
        return;
    }

    allGroups.forEach(group => {
        const latestChatInGroup = allChats.find(chat => chat.groupId === group.id);
        group.latestTimestamp = latestChatInGroup ? (latestChatInGroup.history.slice(-1)[0]?.timestamp || 0) : 0;
    });
    allGroups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
    
    
runtime.sortedChatListItems = []; 
    const processedChatIds = new Set();

  
    allChats.forEach(chat => {
        if (chat.isPinned) {
            runtime.sortedChatListItems.push({ type: 'chatItem', chat });
            processedChatIds.add(chat.id);
        }
    });

  
    allGroups.forEach(group => {
      
        const groupChats = allChats.filter(chat => 
            !chat.isPinned &&          
            !chat.isGroup &&           
            chat.groupId === group.id  
        );

       
        if (groupChats.length > 0) {
            runtime.sortedChatListItems.push({ type: 'groupHeader', group });
          
            groupChats.forEach(chat => {
                runtime.sortedChatListItems.push({ type: 'chatItem', chat });
                processedChatIds.add(chat.id);
            });
        }
    });


    allChats.forEach(chat => {
        if (!processedChatIds.has(chat.id)) {
            runtime.sortedChatListItems.push({ type: 'chatItem', chat });
            processedChatIds.add(chat.id);
        }
    });

    
    runtime.chatListRenderCount = 0;
    loadMoreChats(); 
}

export function appendLoadMoreChatsButton(container, sortedItems) {
            const button = document.createElement('button');
            button.id = 'load-more-chats-btn';
            button.textContent = "Load Older Chats";
            button.className = 'load-more-btn'; 
            
            
            button.addEventListener('click', () => loadMoreChats(sortedItems), { once: true });
            
            container.prepend(button); 
        }

export function createChatListItem(chat) {
    
    try {
        const lastMsgObj = chat.history.filter(msg => !msg.isHidden).slice(-1)[0] || {};
        let lastMsgDisplay;

        if (!chat.isGroup && chat.relationship?.status === 'pending_user_approval') {
            lastMsgDisplay = `<span style="color: #ff8c00;">[好友申请] ${chat.relationship.applicationReason || '请求添加你为好友'}</span>`;
        } else if (!chat.isGroup && chat.relationship?.status === 'blocked_by_ai') {
            lastMsgDisplay = `<span style="color: #dc3545;">[你已被对方拉黑]</span>`;
        } else if (chat.isGroup) {
            if (lastMsgObj.type === 'pat_message') { lastMsgDisplay = `[系统消息] ${lastMsgObj.content}`; }
            else if (lastMsgObj.type === 'transfer') { lastMsgDisplay = '[转账]'; }
            else if (lastMsgObj.type === 'ai_image' || lastMsgObj.type === 'user_photo') { lastMsgDisplay = '[照片]'; }
            else if (lastMsgObj.type === 'voice_message') { lastMsgDisplay = '[语音]'; }
            else if (typeof lastMsgObj.content === 'string' && runtime.STICKER_REGEX.test(lastMsgObj.content)) { lastMsgDisplay = lastMsgObj.meaning ? `[表情: ${lastMsgObj.meaning}]` : '[表情]'; }
            else if (Array.isArray(lastMsgObj.content)) { lastMsgDisplay = `[图片]`; }
            else { lastMsgDisplay = String(lastMsgObj.content || '...').substring(0, 20); }

            if (lastMsgObj.senderName && lastMsgObj.type !== 'pat_message') {
                const senderDisplayName = getDisplayNameInGroup(chat, lastMsgObj.senderName);
                lastMsgDisplay = `${senderDisplayName}: ${lastMsgDisplay}`;
            }
        } else {
            const statusText = chat.status?.text || 'Online';
            lastMsgDisplay = `[${statusText}]`;
        }

        const item = document.createElement('div');
        item.className = 'chat-list-item';
        item.dataset.chatId = chat.id;
        if (chat.isPinned) {
            item.classList.add('pinned');
        }

        const avatar = chat.isGroup ? chat.settings.groupAvatar : chat.settings.aiAvatar;
        const avatarFrameSrc = chat.isGroup ? '' : (chat.settings.aiAvatarFrame || '');
        let avatarHtml;
        if (avatarFrameSrc) {
            avatarHtml = `<div class="avatar-with-frame"><img src="${avatar || runtime.defaultAvatar}" class="avatar-img"><img src="${avatarFrameSrc}" class="avatar-frame"></div>`;
        } else {
            avatarHtml = `<img src="${avatar || runtime.defaultAvatar}" class="avatar">`;
        }
        const hasFrameClass = avatarFrameSrc ? 'has-frame' : '';
        const avatarGroupHtml = `<div class="avatar-group ${hasFrameClass}">${avatarHtml}</div>`;

        item.innerHTML = `
            ${avatarGroupHtml}
            <div class="info">
                <div class="name-line">
                    <span class="name">${chat.name}</span>
                    ${chat.isGroup ? "<span class=\"group-tag\">Group Chats</span>" : ''}
                </div>
                <div class="last-msg" style="color: ${chat.isGroup ? 'var(--text-secondary)' : '#b5b5b5'}; font-style: italic;">${lastMsgDisplay}</div>
            </div>
            <div class="unread-count-wrapper">
                <span class="unread-count" style="display: none;">0</span>
            </div>
        `;
        
        const unreadCount = chat.unreadCount || 0;
        const unreadEl = item.querySelector('.unread-count');
        if (unreadCount > 0) {
            unreadEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
            unreadEl.style.display = 'inline-flex';
        } else {
            unreadEl.style.display = 'none';
        }
        
        const avatarGroupEl = item.querySelector('.avatar-group');
        if (avatarGroupEl) {
            avatarGroupEl.style.cursor = 'pointer';
            avatarGroupEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const nameToPat = chat.isGroup ? chat.name : chat.originalName;
                handleUserPat(chat.id, nameToPat);
            });
        }
        
        const infoEl = item.querySelector('.info');
        if (infoEl) {
            infoEl.addEventListener('click', () => openChat(chat.id));
        }
    
        addLongPressListener(item, async (e) => {
            const action = await showChatListActions(chat);
            switch (action) {
                case 'pin':
                    chat.isPinned = !chat.isPinned;
                    await runtime.db.chats.put(chat);
                    renderChatList();
                    break;
                case 'delete':
                    const deleteConfirmed = await showCustomConfirm("Delete Chat", `Permanently delete the chat with “${chat.name}”?`, { confirmButtonClass: 'btn-danger' });
                    if (deleteConfirmed) {
                        if (runtime.musicState.isActive && runtime.musicState.activeChatId === chat.id) {
                            await endListenTogetherSession(false);
                        }
                        delete runtime.state.chats[chat.id];
                        if (runtime.state.activeChatId === chat.id) runtime.state.activeChatId = null;
                        await runtime.db.chats.delete(chat.id);
                        renderChatList();
                    }
                    break;
                default:
                    break;
            }
        });
        return item;

    } catch (error) {
       
        console.error(`渲染聊天项 [${chat.name || '未知'}] (ID: ${chat.id}) 时出错:`, error);
        return null; 
    }
}

export function showChatListActions(chat) {
            return new Promise(resolve => {
                const modal = document.getElementById('chat-list-actions-modal');
                const pinBtn = document.getElementById('chat-list-action-pin');
                const deleteBtn = document.getElementById('chat-list-action-delete');
                const cancelBtn = document.getElementById('chat-list-action-cancel');
        
                
                pinBtn.textContent = chat.isPinned ? "Unpin" : "Pin chat";
        
                
                const newPinBtn = pinBtn.cloneNode(true);
                pinBtn.parentNode.replaceChild(newPinBtn, pinBtn);
                newPinBtn.onclick = () => { modal.classList.remove('visible'); resolve('pin'); };
        
                const newDeleteBtn = deleteBtn.cloneNode(true);
                deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                newDeleteBtn.onclick = () => { modal.classList.remove('visible'); resolve('delete'); };
        
                const newCancelBtn = cancelBtn.cloneNode(true);
                cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                newCancelBtn.onclick = () => { modal.classList.remove('visible'); resolve(null); };
        
                modal.classList.add('visible');
            });
        }

export function bindChatListActions() {
  document.getElementById('import-card-input').addEventListener('change', handleCardImport);

document.getElementById('back-to-list-btn').addEventListener('click', () => { 
               runtime.ruleCache = {};
            
            applyScopedCss('', '#chat-messages', 'custom-bubble-style'); 
            applyScopedCss('', '#settings-preview-area', 'preview-bubble-style'); 
              
        
        exitSelectionMode(); runtime.state.activeChatId = null; showScreen('chat-list-screen'); });

document.getElementById('add-chat-btn').addEventListener('click', async () => {
            
            const choice = await showChoiceModal('创建新聊天', [
                { text: "Create Manually", value: 'manual' },
                { text: "Import Character Card (.json or .png)", value: 'import_card' }
            ]);
        
            if (choice === 'manual') {
                
                const remarkName = await showCustomPrompt("Create Character (1 of 2)", "Enter a display name");
                if (!remarkName || !remarkName.trim()) return;
        
                const originalName = await showCustomPrompt("Create Character (2 of 2)", "Enter the character’s name used by the AI");
                if (!originalName || !originalName.trim()) return;
        

const newChatId = 'chat_' + Date.now();
const newChat = {
    id: newChatId,
    name: remarkName.trim(),
    originalName: originalName.trim(),
    isGroup: false,
    isPinned: false, 
    unreadCount: 0,  
    relationship: { status: 'friend', blockedTimestamp: null, applicationReason: '' },
    status: { text: 'Online', lastUpdate: Date.now(), isBusy: false },
    settings: {
        aiPersona: '',
        myPersona: '',
        myNickname: 'Me',
        maxMemory: 10,
        aiAvatar: runtime.defaultAvatar,
        myAvatar: runtime.defaultAvatar,
        background: '',
        theme: 'default',
        fontSize: 13,
        customCss: '',
        linkedWorldBookIds: [],
        aiAvatarLibrary: [],
        myAvatarLibrary: [],
        enableBackgroundActivity: true, 
        actionCooldownMinutes: 15,    
        enableTimePerception: true,     
        isOfflineMode: false,           
        offlineMinLength: 100,
        offlineMaxLength: 300,
        offlinePresetId: null,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone       
    },
    history: [],
    musicData: { totalTime: 0 },
    longTermMemory: [],
    thoughtsHistory: [] 
};
                await runtime.db.chats.put(newChat);
                runtime.state.chats[newChatId] = newChat;
                renderChatList();
                
            } else if (choice === 'import_card') {
                
                document.getElementById('import-card-input').click();
            }
        });

document.getElementById('add-group-chat-btn').addEventListener('click', openContactPickerForGroupCreate);
}

export function bindChatListScrolling() {
  controls.messagesView = document.getElementById('messages-view')

controls.messagesView.addEventListener('scroll', () => { 
    
    const { scrollTop, scrollHeight, clientHeight } = controls.messagesView;

    
    
    if (scrollHeight - scrollTop - clientHeight < clientHeight) {
        
        if (!runtime.isLoadingMoreChats) {
            
            loadMoreChats();
        }
    }
});
}
