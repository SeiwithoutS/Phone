import { handleUserPat } from './attachments.js'
import { characterAvatar } from '../../features/characters/gallery'
import { escapeHtml } from '../../runtime/files'
import { openChat } from './conversation.js'
import { getDisplayNameInGroup, openContactPickerForGroupCreate } from './groups.js'
import { addLongPressListener, showCustomConfirm } from '../dialogs/dialogs.js'
import { hideLoader, showLoader } from '../dialogs/dialogs.js'
import { endListenTogetherSession } from '../music/player.js'
import { runtime } from '../runtime/state.js'
import { applyScopedCss } from '../appearance/theme.js'
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

            
            const renderVersion = chatListVersion;
            const isInitialLoad = runtime.chatListRenderCount === 0;

            
            const renderContent = () => {
                if (renderVersion !== chatListVersion) return;
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

let chatListVersion = 0;

export async function renderChatList() {
    const renderVersion = ++chatListVersion;
    runtime.isLoadingMoreChats = false;
    const query = document.getElementById('chat-list-filter')?.value.trim().toLowerCase();
    const chatListEl = document.getElementById('chat-list');
    const allChats = Object.values(runtime.state.chats).filter(chat => !query || [chat.name, chat.originalName].some(name => name?.toLowerCase().includes(query))).sort((a, b) => {
        const pinDiff = (b.isPinned || false) - (a.isPinned || false);
        if (pinDiff !== 0) return pinDiff;
        return (b.history.slice(-1)[0]?.timestamp || 0) - (a.history.slice(-1)[0]?.timestamp || 0);
    });
    
    const allGroups = await runtime.db.qzoneGroups.toArray();

    if (renderVersion !== chatListVersion) return;
    chatListEl.replaceChildren();
    if (allChats.length === 0) {
        runtime.sortedChatListItems = [];
        runtime.chatListRenderCount = 0;
        if (query) { chatListEl.textContent = "No matching chats."; return; }
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

        const status = !chat.isGroup && chat.settings.showCharacterStatus !== false ? chat.status?.text || 'Online' : '';
        const sender = lastMsgObj.senderName && chat.isGroup ? getDisplayNameInGroup(chat, lastMsgObj.senderName) + ': ' : '';
        const previews = { transfer: 'Bank transfer', waimai_order: 'Food delivery', gift: 'Gift', poll: 'Poll',
            voice_message: 'Voice message', user_photo: 'Photo', ai_image: 'Photo', sticker: 'Sticker', location_share: 'Location' };
        let preview = previews[lastMsgObj.type] || (typeof lastMsgObj.content === 'string' ? lastMsgObj.content : '');
        if (chat.relationship?.status === 'pending_user_approval') preview = chat.relationship.applicationReason || 'Contact request';
        if (chat.relationship?.status === 'blocked_by_ai') preview = 'Contact unavailable';
        const date = Number.isFinite(lastMsgObj.timestamp) ? new Date(lastMsgObj.timestamp) : undefined;
        const time = date ? (date.toDateString() === new Date().toDateString()
            ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString([], { month: 'short', day: 'numeric' })) : '';
        const item = document.createElement('div');
        item.className = 'chat-list-item';
        item.dataset.chatId = chat.id;
        if (chat.isPinned) {
            item.classList.add('pinned');
        }

        const avatar = escapeHtml(String((chat.isGroup ? chat.settings.groupAvatar : characterAvatar(chat)) || runtime.defaultAvatar));
        const avatarTag = chat.isGroup ? '' : ` data-qq-character-avatar="${escapeHtml(String(chat.id))}"`;
        const avatarFrameSrc = chat.isGroup ? '' : (chat.settings.aiAvatarFrame || '');
        let avatarHtml;
        if (avatarFrameSrc) {
            avatarHtml = `<div class="avatar-with-frame"><img src="${avatar}" class="avatar-img"${avatarTag}><img src="${escapeHtml(String(avatarFrameSrc))}" class="avatar-frame"></div>`;
        } else {
            avatarHtml = `<img src="${avatar}" class="avatar"${avatarTag}>`;
        }
        const hasFrameClass = avatarFrameSrc ? 'has-frame' : '';
        const avatarGroupHtml = `<div class="avatar-group ${hasFrameClass}">${avatarHtml}</div>`;

        item.innerHTML = `
            ${avatarGroupHtml}
            <div class="info">
                <div class="name-line">
                    <span class="name">${escapeHtml(String(chat.name))}</span>
                    ${chat.isGroup ? "<span class=\"group-tag\">Group Chats</span>" : ''}
                </div>
                <div class="last-msg">${escapeHtml((sender + preview).trim() || status || "No messages yet")}</div>
            </div>
            <div class="unread-count-wrapper">
                <time class="chat-list-time">${escapeHtml(time)}</time>
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
        
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.addEventListener('click', event => {
            if (!event.target.closest('.avatar-group')) void openChat(chat.id);
        });
        item.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                void openChat(chat.id);
            }
        });
    
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

document.getElementById('back-to-list-btn').addEventListener('click', () => { 
            
            applyScopedCss('', '#chat-messages', 'custom-bubble-style'); 
            applyScopedCss('', '#settings-preview-area', 'preview-bubble-style'); 
              
        
        exitSelectionMode(); runtime.state.activeChatId = null; showScreen('chat-list-screen'); });

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
