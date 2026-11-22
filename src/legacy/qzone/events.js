import { openPhotoViewer, renderAlbumList, renderAlbumPhotosScreen } from '../album/album.js'
import { applyCustomFont, resetToDefaultFont } from '../appearance/fonts.js'
import { toggleTheme } from '../appearance/theme.js'
import { showCallTranscript } from '../calls/calls.js'
import { renderCallHistoryScreen } from '../chat/attachments.js'
import { renderChatInterface } from '../chat/conversation.js'
import { renderChatList } from '../chat/list.js'
import { exitSelectionMode, sendLocationShare } from '../chat/messages.js'
import { openShareLinkModal, sendUserLinkShare } from '../chat/sharing.js'
import { showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { displayFilteredFavorites } from './favorites.js'
import { closeQzoneStickerPanel, renderQzoneScreen, resetCreatePostModal, saveQzoneSettings, sendQzoneStickerComment } from './feed.js'
import { switchToChatListView } from '../app/screen-effects.js'
import { showScreen } from '../../app/routes'
import { controls } from '../runtime/state.js'
import { runtime } from '../runtime/state.js'

export function bindQzonePostEditor() {
  document.getElementById('selection-erase-btn').addEventListener('click', async () => {
            if (runtime.selectedMessages.size === 0) return;
            const confirmed = await showCustomConfirm(
                "Delete Messages Permanently", 
                `Permanently delete ${runtime.selectedMessages.size} selected messages from the chat history?`, 
                { confirmButtonClass: 'btn-danger', confirmText: '确认抹除' }
            );
            if (confirmed) {
                const chat = runtime.state.chats[runtime.state.activeChatId];
                
                
                chat.history = chat.history.filter(msg => !runtime.selectedMessages.has(msg.timestamp));
                
                
                await runtime.db.chats.put(chat);
                
                
                renderChatInterface(runtime.state.activeChatId);
                renderChatList();
            }
        });

controls.fontUrlInput = document.getElementById('font-url-input')

controls.fontUrlInput.addEventListener('input', () => applyCustomFont(controls.fontUrlInput.value.trim(), true));

document.getElementById('save-font-btn').addEventListener('click', async () => {
                        const newFontUrl = controls.fontUrlInput.value.trim();
                        if (!newFontUrl) { alert("Enter a valid font URL."); return; }
                        applyCustomFont(newFontUrl, false);
                        runtime.state.globalSettings.fontUrl = newFontUrl;
                        await runtime.db.globalSettings.put(runtime.state.globalSettings);
                        alert("Font saved and applied.");
                    });

document.getElementById('reset-font-btn').addEventListener('click', resetToDefaultFont);

document.querySelectorAll('#chat-list-bottom-nav .nav-item').forEach(item => { item.addEventListener('click', () => switchToChatListView(item.dataset.view)); });

document.getElementById('qzone-back-btn').addEventListener('click', () => switchToChatListView('messages-view'));

document.getElementById('qzone-nickname').addEventListener('click', async () => { const newNickname = await showCustomPrompt("Edit Display Name", "Enter a new display name", runtime.state.qzoneSettings.nickname); if (newNickname && newNickname.trim()) { runtime.state.qzoneSettings.nickname = newNickname.trim(); await saveQzoneSettings(); renderQzoneScreen(); } });

document.getElementById('qzone-avatar-container').addEventListener('click', () => document.getElementById('qzone-avatar-input').click());

document.getElementById('qzone-banner-container').addEventListener('click', () => document.getElementById('qzone-banner-input').click());

document.getElementById('qzone-avatar-input').addEventListener('change', async (event) => { const file = event.target.files[0]; if (file) { const dataUrl = await new Promise(res => { const reader = new FileReader(); reader.onload = () => res(reader.result); reader.readAsDataURL(file); }); runtime.state.qzoneSettings.avatar = dataUrl; await saveQzoneSettings(); renderQzoneScreen(); } event.target.value = null; });

document.getElementById('qzone-banner-input').addEventListener('change', async (event) => { const file = event.target.files[0]; if (file) { const dataUrl = await new Promise(res => { const reader = new FileReader(); reader.onload = () => res(reader.result); reader.readAsDataURL(file); }); runtime.state.qzoneSettings.banner = dataUrl; await saveQzoneSettings(); renderQzoneScreen(); } event.target.value = null; });

document.getElementById('create-shuoshuo-btn').addEventListener('click', async () => {
            
            resetCreatePostModal();
            const modal = document.getElementById('create-post-modal');
            
            
            modal.dataset.mode = 'shuoshuo';
            
            
            modal.querySelector('.post-mode-switcher').style.display = 'none';
            modal.querySelector('#image-mode-content').style.display = 'none';
            modal.querySelector('#text-image-mode-content').style.display = 'none';
            
            
            modal.querySelector('#post-public-text').placeholder = "Share an update…";
            
            
            const visibilityGroupsContainer = document.getElementById('post-visibility-groups');
            visibilityGroupsContainer.innerHTML = '';
            const groups = await runtime.db.qzoneGroups.toArray();
            if (groups.length > 0) {
                groups.forEach(group => {
                    const label = document.createElement('label');
                    label.style.display = 'block';
                    label.innerHTML = `<input type="checkbox" name="visibility_group" value="${group.id}"> ${group.name}`;
                    visibilityGroupsContainer.appendChild(label);
                });
            } else {
                visibilityGroupsContainer.innerHTML = "<p style=\"color: var(--text-secondary);\">No groups available.</p>";
            }
            modal.classList.add('visible');
        });

document.getElementById('create-post-btn').addEventListener('click', async () => {
            
            resetCreatePostModal();
            const modal = document.getElementById('create-post-modal');
            
            
            modal.dataset.mode = 'complex';
            
        
        modal.querySelector('.post-mode-switcher').style.display = 'flex';
        
        modal.querySelector('#image-mode-content').classList.add('active');
        
        modal.querySelector('#text-image-mode-content').classList.remove('active');
            
            
            modal.querySelector('#post-public-text').placeholder = "Share an update… (optional public text)";
        
            
            const visibilityGroupsContainer = document.getElementById('post-visibility-groups');
            visibilityGroupsContainer.innerHTML = '';
            const groups = await runtime.db.qzoneGroups.toArray();
            if (groups.length > 0) {
                groups.forEach(group => {
                    const label = document.createElement('label');
                    label.style.display = 'block';
                    label.innerHTML = `<input type="checkbox" name="visibility_group" value="${group.id}"> ${group.name}`;
                    visibilityGroupsContainer.appendChild(label);
                });
            } else {
                visibilityGroupsContainer.innerHTML = "<p style=\"color: var(--text-secondary);\">No groups available.</p>";
            }
            modal.classList.add('visible');
        });

document.getElementById('open-album-btn').addEventListener('click', async () => { await renderAlbumList(); showScreen('album-screen'); });

document.getElementById('album-back-btn').addEventListener('click', () => { showScreen('chat-list-screen'); switchToChatListView('qzone-screen'); });

document.getElementById('album-photos-back-btn').addEventListener('click', () => {
            runtime.state.activeAlbumId = null;
            showScreen('album-screen');
        });

document.getElementById('album-upload-photo-btn').addEventListener('click', () => document.getElementById('album-photo-input').click());

document.getElementById('album-photo-input').addEventListener('change', async (event) => {
            if (!runtime.state.activeAlbumId) return;
            const files = event.target.files;
            if (!files.length) return;
        
            const album = await runtime.db.qzoneAlbums.get(runtime.state.activeAlbumId);
            
            for (const file of files) {
                const dataUrl = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
                await runtime.db.qzonePhotos.add({ albumId: runtime.state.activeAlbumId, url: dataUrl, createdAt: Date.now() });
            }
        
            const photoCount = await runtime.db.qzonePhotos.where('albumId').equals(runtime.state.activeAlbumId).count();
            const updateData = { photoCount };
            
            if (!album.photoCount || album.coverUrl.includes('placeholder')) {
                const firstPhoto = await runtime.db.qzonePhotos.where('albumId').equals(runtime.state.activeAlbumId).first();
                if(firstPhoto) updateData.coverUrl = firstPhoto.url;
            }
        
            await runtime.db.qzoneAlbums.update(runtime.state.activeAlbumId, updateData);
            await renderAlbumPhotosScreen();
            await renderAlbumList();
            
            event.target.value = null;
            alert("Photo uploaded.");
        });

document.getElementById('photos-grid-page').addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.photo-delete-btn');
            const photoThumb = e.target.closest('.photo-thumb');
        
            if (deleteBtn) {
                e.stopPropagation(); 
                const photoId = parseInt(deleteBtn.dataset.photoId);
                const confirmed = await showCustomConfirm(
                    "Delete Photo",
                    "Permanently delete this photo?",
                    { confirmButtonClass: 'btn-danger' }
                );
        
                if (confirmed) {
                    const deletedPhoto = await runtime.db.qzonePhotos.get(photoId);
                    if (!deletedPhoto) return;
                    
                    await runtime.db.qzonePhotos.delete(photoId);
        
                    const album = await runtime.db.qzoneAlbums.get(runtime.state.activeAlbumId);
                    const photoCount = (album.photoCount || 1) - 1;
                    const updateData = { photoCount };
                    
                    if (album.coverUrl === deletedPhoto.url) {
                        const nextPhoto = await runtime.db.qzonePhotos.where('albumId').equals(runtime.state.activeAlbumId).first();
                        updateData.coverUrl = nextPhoto ? nextPhoto.url : 'https://i.postimg.cc/pT2xKzPz/album-cover-placeholder.png';
                    }
                    
                    await runtime.db.qzoneAlbums.update(runtime.state.activeAlbumId, updateData);
                    await renderAlbumPhotosScreen();
                    await renderAlbumList();
                    alert("Photo deleted.");
                }
            } 
            else if (photoThumb) {
                
                openPhotoViewer(photoThumb.src);
            }
        });
}

export function bindQzoneTabEvents() {
  document.getElementById('qzone-back-btn').addEventListener('click', () => switchToChatListView('messages-view'));

document.getElementById('favorites-back-btn').addEventListener('click', () => switchToChatListView('messages-view'));

controls.searchInput = document.getElementById('favorites-search-input')

controls.searchClearBtn = document.getElementById('favorites-search-clear-btn')

controls.searchInput.addEventListener('input', () => {
                        const searchTerm = controls.searchInput.value.trim().toLowerCase();
                        
                        
                        controls.searchClearBtn.style.display = searchTerm ? 'block' : 'none';
        
                        if (!searchTerm) {
                            displayFilteredFavorites(runtime.allFavoriteItems); 
                            return;
                        }
        
                        
                        const filteredItems = runtime.allFavoriteItems.filter(item => {
                            let contentToSearch = '';
                            let authorToSearch = '';
        
                            if (item.type === 'qzone_post') {
                                const post = item.content;
                                contentToSearch += (post.publicText || '') + ' ' + (post.content || '');
                                if (post.authorId === 'user') {
                                    authorToSearch = runtime.state.qzoneSettings.nickname;
                                } else if (runtime.state.chats[post.authorId]) {
                                    authorToSearch = runtime.state.chats[post.authorId].name;
                                }
                            } else if (item.type === 'chat_message') {
                                const msg = item.content;
                                if (typeof msg.content === 'string') {
                                    contentToSearch = msg.content;
                                }
                                const chat = runtime.state.chats[item.chatId];
                                if (chat) {
                                   if (msg.role === 'user') {
                                        authorToSearch = chat.isGroup ? (chat.settings.myNickname || '我') : '我';
                                   } else {
                                        authorToSearch = chat.isGroup ? msg.senderName : chat.name;
                                   }
                                }
                            }
                            
                            
                            return contentToSearch.toLowerCase().includes(searchTerm) || 
                                   authorToSearch.toLowerCase().includes(searchTerm);
                        });
        
                        displayFilteredFavorites(filteredItems);
                    });

controls.searchClearBtn.addEventListener('click', () => {
                        controls.searchInput.value = '';
                        controls.searchClearBtn.style.display = 'none';
                        displayFilteredFavorites(runtime.allFavoriteItems);
                        controls.searchInput.focus();
                    });

document.getElementById('selection-favorite-btn').addEventListener('click', async () => {
                        if (runtime.selectedMessages.size === 0) return;
                        const chat = runtime.state.chats[runtime.state.activeChatId];
                        if (!chat) return;
        
                        const favoritesToAdd = [];
                        const timestampsToFavorite = [...runtime.selectedMessages];
        
                        for (const timestamp of timestampsToFavorite) {
                            
                            const existing = await runtime.db.favorites.where('originalTimestamp').equals(timestamp).first();
                            
                            if (!existing) {
                                const messageToSave = chat.history.find(msg => msg.timestamp === timestamp);
                                if (messageToSave) {
                                    favoritesToAdd.push({
                                        type: 'chat_message',
                                        content: messageToSave,
                                        chatId: runtime.state.activeChatId,
                                        timestamp: Date.now(), 
                                        originalTimestamp: messageToSave.timestamp 
                                    });
                                }
                            }
                        }
        
                        if (favoritesToAdd.length > 0) {
                            await runtime.db.favorites.bulkAdd(favoritesToAdd);
                            runtime.allFavoriteItems = await runtime.db.favorites.orderBy('timestamp').reverse().toArray(); 
                            await showCustomAlert("Added to Favorites", `Added ${favoritesToAdd.length} messages to Favorites.`);
                        } else {
                            await showCustomAlert("Notice", "The selected messages are already in Favorites.");
                        }
                        
                        exitSelectionMode();
                    });

controls.favoritesEditBtn = document.getElementById('favorites-edit-btn')

controls.favoritesView = document.getElementById('favorites-view')

controls.favoritesActionBar = document.getElementById('favorites-action-bar')

controls.mainBottomNav = document.getElementById('chat-list-bottom-nav')

controls.favoritesList = document.getElementById('favorites-list')

controls.favoritesEditBtn.addEventListener('click', () => {
                        runtime.isFavoritesSelectionMode = !runtime.isFavoritesSelectionMode;
                        controls.favoritesView.classList.toggle('selection-mode', runtime.isFavoritesSelectionMode);
        
                        if (runtime.isFavoritesSelectionMode) {
                            
                            controls.favoritesEditBtn.textContent = "Done";
                            controls.favoritesActionBar.style.display = 'block'; 
                            controls.mainBottomNav.style.display = 'none'; 
                            controls.favoritesList.style.paddingBottom = '80px'; 
                        } else {
                            
                            controls.favoritesEditBtn.textContent = "Edit";
                            controls.favoritesActionBar.style.display = 'none'; 
                            controls.mainBottomNav.style.display = 'flex';  
                            controls.favoritesList.style.paddingBottom = ''; 
        
                            
                            runtime.selectedFavorites.clear();
                            document.querySelectorAll('.favorite-item-card.selected').forEach(card => card.classList.remove('selected'));
                            document.getElementById('favorites-delete-selected-btn').textContent = `Delete (0)`;
                        }
                    });

document.getElementById('favorites-list').addEventListener('click', (e) => {
            const target = e.target;
            const card = target.closest('.favorite-item-card');
        
            
            if (target.tagName === 'IMG' && target.dataset.hiddenText) {
                const hiddenText = target.dataset.hiddenText;
                showCustomAlert("Image Content", hiddenText.replace(/<br>/g, '\n'));
                return; 
            }
            
            
            if (!runtime.isFavoritesSelectionMode) return;
        
            
            if (!card) return;
        
            const favId = parseInt(card.dataset.favid);
            if (isNaN(favId)) return;
        
            
            if (runtime.selectedFavorites.has(favId)) {
                runtime.selectedFavorites.delete(favId);
                card.classList.remove('selected');
            } else {
                runtime.selectedFavorites.add(favId);
                card.classList.add('selected');
            }
            
            
            document.getElementById('favorites-delete-selected-btn').textContent = `Delete (${runtime.selectedFavorites.size})`;
        });

document.getElementById('favorites-delete-selected-btn').addEventListener('click', async () => {
            if (runtime.selectedFavorites.size === 0) return;
        
            const confirmed = await showCustomConfirm(
                "Confirm Delete", 
                `Remove ${runtime.selectedFavorites.size} selected items from Favorites?`, 
                { confirmButtonClass: 'btn-danger' }
            );
        
            if (confirmed) {
                const idsToDelete = [...runtime.selectedFavorites];
                await runtime.db.favorites.bulkDelete(idsToDelete);
                await showCustomAlert("Deleted", "Selected items removed.");
                
                
                runtime.allFavoriteItems = runtime.allFavoriteItems.filter(item => !idsToDelete.includes(item.id));
                
                
                displayFilteredFavorites(runtime.allFavoriteItems);
                
                
                controls.favoritesEditBtn.click(); 
            }
        });
}

export function bindQzoneProfileEvents() {
  runtime.qzoneStickerPanelState.panelEl.addEventListener('click', async (e) => {
            const stickerItem = e.target.closest('.sticker-item');
            if (stickerItem && runtime.qzoneStickerPanelState.activePostId !== null) {
                
                const stickerUrl = stickerItem.style.backgroundImage.slice(5, -2);
                
                
                const stickerObject = runtime.state.userStickers.find(s => s.url === stickerUrl);
        
                if (stickerObject) {
                    
                    await sendQzoneStickerComment(runtime.qzoneStickerPanelState.activePostId, stickerObject);
                } else {
                    console.warn("在动态评论区点击了表情，但在表情库中未找到对象:", stickerUrl);
                }
            }
        });

document.addEventListener('click', (e) => {
            if (runtime.qzoneStickerPanelState.isOpen && 
                !runtime.qzoneStickerPanelState.panelEl.contains(e.target) && 
                !e.target.closest('.comment-sticker-btn')) {
                closeQzoneStickerPanel();
            }
        });

document.getElementById('share-link-btn').addEventListener('click', openShareLinkModal);

document.getElementById('cancel-share-link-btn').addEventListener('click', () => {
                document.getElementById('share-link-modal').classList.remove('visible');
            });

document.getElementById('confirm-share-link-btn').addEventListener('click', sendUserLinkShare);

document.getElementById('theme-toggle-switch').addEventListener('change', toggleTheme);

document.getElementById('share-location-btn').addEventListener('click', sendLocationShare);

document.getElementById('chat-list-title').addEventListener('click', renderCallHistoryScreen);

document.getElementById('call-history-back-btn').addEventListener('click', () => {
            
            showScreen('chat-list-screen');
        });

document.getElementById('call-history-list').addEventListener('click', (e) => {
            const card = e.target.closest('.call-record-card');
            if (card && card.dataset.recordId) {
                showCallTranscript(parseInt(card.dataset.recordId));
            }
        });

document.getElementById('close-call-transcript-btn').addEventListener('click', () => {
    document.getElementById('call-transcript-modal').classList.remove('visible');
});
}
