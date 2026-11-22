import { appendMessage } from './conversation.js'
import { renderChatList } from './list.js'
import { exitSelectionMode } from './messages.js'
import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { captureScreenshot } from '../../runtime/dependencies'
import { runtime } from '../runtime/state.js'
import { handleEditStatusClick } from '../calls/calls.js'
import { updateMusicProgressBar } from '../music/lyrics.js'
import { deleteTrack, handleChangeAlbumArt, playSong, updatePlayerUI } from '../music/player.js'
import { handleManualLrcImport } from '../music/search.js'

export function openShareLinkModal() {
            if (!runtime.state.activeChatId) return;
        
            
            document.getElementById('link-title-input').value = '';
            document.getElementById('link-description-input').value = '';
            document.getElementById('link-source-input').value = '';
            document.getElementById('link-content-input').value = '';
        
            
            document.getElementById('share-link-modal').classList.add('visible');
        }

export async function sendUserLinkShare() {
            if (!runtime.state.activeChatId) return;
        
            const title = document.getElementById('link-title-input').value.trim();
            if (!title) {
                alert("Enter a title.");
                return;
            }
        
            const description = document.getElementById('link-description-input').value.trim();
            const sourceName = document.getElementById('link-source-input').value.trim();
            const content = document.getElementById('link-content-input').value.trim();
        
            const chat = runtime.state.chats[runtime.state.activeChatId];
            
            
            const linkMessage = {
                role: 'user', 
                type: 'share_link',
                timestamp: Date.now(),
                title: title,
                description: description,
                source_name: sourceName,
                content: content,
                
                thumbnail_url: null 
            };
        
            
            chat.history.push(linkMessage);
            await runtime.db.chats.put(chat);
        
            
            appendMessage(linkMessage, chat);
            renderChatList();
        
            
            document.getElementById('share-link-modal').classList.remove('visible');
        }

export function filterVisiblePostsForAI(allPosts, viewerChat) {
    if (!viewerChat || !viewerChat.id) return [];

    const viewerGroupId = viewerChat.groupId;
    const viewerId = viewerChat.id; 

    return allPosts.filter(post => {
        
        if (post.authorId === 'user') {
            if (post.visibleGroupIds && post.visibleGroupIds.length > 0) {
                return viewerGroupId && post.visibleGroupIds.includes(viewerGroupId);
            }
            return true;
        }
        
        

        
        if (String(post.authorId).startsWith('npc_')) {
            
            if (Array.isArray(post.visibleTo)) {
                return post.visibleTo.includes(viewerId);
            }
            
            return false;
        }

        

        
        const authorChat = runtime.state.chats[post.authorId];
        if (!authorChat) {
            return false;
        }
        const authorGroupId = authorChat.groupId;

        const inSameGroup = authorGroupId && viewerGroupId && authorGroupId === viewerGroupId;
        const bothUnGrouped = !authorGroupId && !viewerGroupId;

        return inSameGroup || bothUnGrouped;
    });
}

export async function openShareTargetPicker() {
            const modal = document.getElementById('share-target-modal');
            const listEl = document.getElementById('share-target-list');
            listEl.innerHTML = '';
        
            
            const chats = Object.values(runtime.state.chats);
        
            chats.forEach(chat => {
                
                const item = document.createElement('div');
                item.className = 'contact-picker-item'; 
                item.innerHTML = `
                    <input type="checkbox" class="share-target-checkbox" data-chat-id="${chat.id}" style="margin-right: 15px;">
                    <img src="${chat.isGroup ? chat.settings.groupAvatar : chat.settings.aiAvatar || runtime.defaultAvatar}" class="avatar">
                    <span class="name">${chat.name}</span>
                `;
                listEl.appendChild(item);
            });
            
            modal.classList.add('visible');
        }

export function closeMusicPlayerWithAnimation(callback) {
            const overlay = document.getElementById('music-player-overlay');
            if (!overlay.classList.contains('visible')) {
                if (callback) callback();
                return;
            }
            overlay.classList.remove('visible');
            setTimeout(() => {
                document.getElementById('music-playlist-panel').classList.remove('visible');
                if (callback) callback();
            }, 400); 
        }

export function parseLRC(lrcContent) {
    if (!lrcContent) return [];
    const lines = String(lrcContent).split(/\r\n?|\n/);
    const lyrics = [];
    const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/g;
    for (const line of lines) {
        const text = line.replace(timeRegex, '').trim();
        if (!text) continue;
        timeRegex.lastIndex = 0;
        let match;
        while ((match = timeRegex.exec(line)) !== null) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
            const time = minutes * 60 + seconds + milliseconds / 1000;
            lyrics.push({ time, text });
        }
    }
    return lyrics.sort((a, b) => a.time - b.time);
}

export async function handleLongScreenshot() {
            if (runtime.selectedMessages.size === 0) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat) return;
        
            
            const screenshotBtn = document.getElementById('selection-screenshot-btn');
            const originalBtnText = screenshotBtn.textContent;
            screenshotBtn.textContent = "Generating...";
            screenshotBtn.disabled = true;
        
            
            const screenshotContainer = document.createElement('div');
            const phoneScreen = document.getElementById('phone-screen');
            screenshotContainer.style.width = phoneScreen.offsetWidth + 'px';
            screenshotContainer.style.position = 'absolute';
            screenshotContainer.style.top = '-9999px';
            screenshotContainer.style.left = '-9999px';
            screenshotContainer.style.display = 'flex';
            screenshotContainer.style.flexDirection = 'column';
            screenshotContainer.style.height = 'auto';
            
            const chatScreen = document.getElementById('chat-interface-screen');
            screenshotContainer.style.backgroundImage = chatScreen.style.backgroundImage;
            screenshotContainer.style.backgroundColor = chatScreen.style.backgroundColor || (document.getElementById('phone-screen').classList.contains('dark-mode') ? '#000000' : '#f0f2f5');
        
            const tempStyle = document.createElement('style');
            tempStyle.innerHTML = `
                .message-bubble.selected::after { display: none !important; }
                .cloned-header .default-controls { display: flex !important; justify-content: space-between; align-items: center; width: 100%; }
                .cloned-header .selection-controls { display: none !important; }
            `;
            document.head.appendChild(tempStyle);
        
            try {
                
                const header = chatScreen.querySelector('.header').cloneNode(true);
                header.classList.add('cloned-header');
                
                
                
                const messagesContainer = document.createElement('div');
                const originalMessagesContainer = document.getElementById('chat-messages');
        
                
                messagesContainer.style.display = 'flex';
                messagesContainer.style.flexDirection = 'column';
                messagesContainer.style.gap = '20px'; 
                messagesContainer.style.padding = '10px 15px 20px 15px'; 
                messagesContainer.style.width = '100%';
                messagesContainer.style.boxSizing = 'border-box';
        
                
                messagesContainer.dataset.theme = originalMessagesContainer.dataset.theme;
                messagesContainer.style.setProperty('--chat-font-size', originalMessagesContainer.style.getPropertyValue('--chat-font-size'));
                
        
                const inputArea = chatScreen.querySelector('#chat-input-area').cloneNode(true);
        
                const sortedTimestamps = [...runtime.selectedMessages].sort((a, b) => a - b);
                sortedTimestamps.forEach(timestamp => {
                    
                    const originalBubble = document.querySelector(`.message-bubble[data-timestamp="${timestamp}"]`);
                    if (originalBubble) {
                        const originalWrapper = originalBubble.closest('.message-wrapper');
                        if (originalWrapper) {
                            messagesContainer.appendChild(originalWrapper.cloneNode(true));
                        }
                    }
                });
        
                screenshotContainer.appendChild(header);
                screenshotContainer.appendChild(messagesContainer);
                screenshotContainer.appendChild(inputArea);
                document.body.appendChild(screenshotContainer);
                
                
                const images = Array.from(screenshotContainer.getElementsByTagName('img'));
                const imageLoadPromises = images.map(img => new Promise((resolve, reject) => {
                    if (img.src.startsWith('data:')) {
                        resolve();
                        return;
                    }
                    const newImg = new Image();
                    newImg.crossOrigin = 'anonymous';
                    newImg.onload = resolve;
                    newImg.onerror = resolve; 
                    newImg.src = img.src;
                }));
                
                await Promise.all(imageLoadPromises);
        
                
                const canvas = await captureScreenshot(screenshotContainer, {
                    allowTaint: true,
                    useCORS: true,
                    backgroundColor: null,
                    scale: window.devicePixelRatio || 2,
                });
        
                
                canvas.toBlob(function(blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `EPhone-长截图-${chat.name}-${Date.now()}.png`;
                    link.href = url;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 'image/png');
        
            } catch (error) {
                console.error('长截图生成失败:', error);
                await showCustomAlert("Generation Failed", "Could not generate the screenshot.");
            } finally {
                
                document.body.removeChild(screenshotContainer);
                document.head.removeChild(tempStyle);
                screenshotBtn.textContent = originalBtnText;
                screenshotBtn.disabled = false;
                exitSelectionMode(); 
            }
        }

export function bindChatSharing() {
  document.getElementById('chat-header-status').addEventListener('click', handleEditStatusClick);

document.getElementById('selection-share-btn').addEventListener('click', () => {
            if (runtime.selectedMessages.size > 0) {
                openShareTargetPicker(); 
            }
        });

document.getElementById('selection-screenshot-btn').addEventListener('click', handleLongScreenshot);

document.getElementById('confirm-share-target-btn').addEventListener('click', async () => {
            const sourceChat = runtime.state.chats[runtime.state.activeChatId];
            const selectedTargetIds = Array.from(document.querySelectorAll('.share-target-checkbox:checked'))
                                           .map(cb => cb.dataset.chatId);
        
            if (selectedTargetIds.length === 0) {
                alert("Select at least one chat to share with.");
                return;
            }
        
            
            const sharedHistory = [];
            const sortedTimestamps = [...runtime.selectedMessages].sort((a, b) => a - b);
            for (const timestamp of sortedTimestamps) {
                const msg = sourceChat.history.find(m => m.timestamp === timestamp);
                if (msg) {
                    sharedHistory.push(msg);
                }
            }
            
            
            const shareCardMessage = {
                role: 'user',
                senderName: sourceChat.isGroup ? (sourceChat.settings.myNickname || '我') : '我',
                type: 'share_card',
                timestamp: Date.now(),
                payload: {
                    sourceChatName: sourceChat.name,
                    title: `来自“${sourceChat.name}”的聊天记录`,
                    sharedHistory: sharedHistory
                }
            };
        
            
            for (const targetId of selectedTargetIds) {
                const targetChat = runtime.state.chats[targetId];
                if (targetChat) {
                    targetChat.history.push(shareCardMessage);
                    await runtime.db.chats.put(targetChat);
                }
            }
            
            
            document.getElementById('share-target-modal').classList.remove('visible');
            exitSelectionMode(); 
            await showCustomAlert("Shared", `Shared chat history with ${selectedTargetIds.length} conversations.`);
            renderChatList(); 
        });

document.getElementById('cancel-share-target-btn').addEventListener('click', () => {
            document.getElementById('share-target-modal').classList.remove('visible');
        });

document.getElementById('close-shared-history-viewer-btn').addEventListener('click', () => {
            document.getElementById('shared-history-viewer-modal').classList.remove('visible');
        });

runtime.audioPlayer.addEventListener('timeupdate', updateMusicProgressBar);

runtime.audioPlayer.addEventListener('pause', () => { 
            if(runtime.musicState.isActive) { 
                runtime.musicState.isPlaying = false; 
                updatePlayerUI(); 
            } 
        });

runtime.audioPlayer.addEventListener('play', () => { 
            if(runtime.musicState.isActive) { 
                runtime.musicState.isPlaying = true; 
                updatePlayerUI(); 
            } 
        });

document.getElementById('playlist-body').addEventListener('click', async (e) => {
    const target = e.target;
    
    
    const albumArtBtn = target.closest('.album-art-btn');
    if (albumArtBtn) {
        const index = parseInt(albumArtBtn.dataset.index);
        if (!isNaN(index)) {
            
            await handleChangeAlbumArt(index);
        }
        return; 
    }
    
    const lyricsBtn = target.closest('.lyrics-btn');
    if (lyricsBtn) {
        const index = parseInt(lyricsBtn.dataset.index);
        if (isNaN(index)) return;

        
        
        await handleManualLrcImport(index);

        return; 
    }

    
    const deleteBtn = target.closest('.delete-track-btn');
    if (deleteBtn) {
        const index = parseInt(deleteBtn.dataset.index);
        if (isNaN(index)) return;
        const track = runtime.musicState.playlist[index];
        const confirmed = await showCustomConfirm("Remove Track", `Remove “${track.name}” from the playlist?`);
        if (confirmed) {
            deleteTrack(index);
        }
        return;
    }

    
    const itemInfo = target.closest('.playlist-item-info');
    if (itemInfo) {
        const item = itemInfo.closest('.playlist-item');
        const index = Array.from(item.parentElement.children).indexOf(item);
        if (index > -1) {
            playSong(index);
        }
    }
});
}
