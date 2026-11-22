import { handleDeleteAnnouncement, handlePinAnnouncement, showAnnouncementBoard } from './groups.js'
import { publishToAnnouncementBoard, showAnnouncementActions } from './announcement-events.js'
import { controls } from '../runtime/state.js'
import { runtime } from '../runtime/state.js'

export function bindChatMentions() {
  document.getElementById('qzone-posts-list').addEventListener('focusout', (e) => {
                if (e.target.matches('.comment-input')) {
                    const postContainer = e.target.closest('.qzone-post-container');
                    if (postContainer) {
                        const popup = postContainer.querySelector('.at-mention-popup');
                        if (popup) {
                            setTimeout(() => { popup.style.display = 'none'; }, 200);
                        }
                    }
                }
            });

controls.chatInputForMention = document.getElementById('chat-input')

controls.chatMentionPopup = document.getElementById('chat-at-mention-popup')

controls.chatInputForMention.addEventListener('input', () => {
            
            if (!runtime.state.activeChatId || !runtime.state.chats[runtime.state.activeChatId].isGroup) {
                controls.chatMentionPopup.style.display = 'none';
                return;
            }
            
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const value = controls.chatInputForMention.value;
            const atMatch = value.match(/@([\p{L}\w]*)$/u);
        
            if (atMatch) {
                
                const myNickname = chat.settings.myNickname || '我';
                const namesToMention = chat.members
                    .map(member => member.groupNickname)
                    .filter(name => name !== myNickname);
        
                controls.chatMentionPopup.innerHTML = '';
                if (namesToMention.length > 0) {
                    const searchTerm = atMatch[1];
                    
                    namesToMention.forEach(name => {
                        if (name.toLowerCase().includes(searchTerm.toLowerCase())) {
                            const item = document.createElement('div');
                            item.className = 'at-mention-item';
                            item.textContent = name;
                            
                            item.addEventListener('mousedown', (e) => {
                                e.preventDefault();
                                const newText = value.substring(0, atMatch.index) + `@${name} `;
                                controls.chatInputForMention.value = newText;
                                controls.chatMentionPopup.style.display = 'none';
                                controls.chatInputForMention.focus();
                            });
                            controls.chatMentionPopup.appendChild(item);
                        }
                    });
                    
                    controls.chatMentionPopup.style.display = controls.chatMentionPopup.children.length > 0 ? 'block' : 'none';
                } else {
                    controls.chatMentionPopup.style.display = 'none';
                }
            } else {
                controls.chatMentionPopup.style.display = 'none';
            }
        });

controls.chatInputForMention.addEventListener('blur', () => {
            setTimeout(() => { controls.chatMentionPopup.style.display = 'none'; }, 200);
        });

document.getElementById('publish-to-announcement-btn').addEventListener('click', publishToAnnouncementBoard);

document.getElementById('show-announcement-board-btn').addEventListener('click', showAnnouncementBoard);

document.getElementById('close-announcement-board-btn').addEventListener('click', () => {
            document.getElementById('announcement-board-modal').classList.remove('visible');
        });

document.getElementById('announcement-board-content').addEventListener('click', (e) => {
            if (e.target.classList.contains('announcement-item-actions')) {
                const annoId = e.target.dataset.annoId;
                if (annoId) {
                    showAnnouncementActions(annoId);
                }
            }
        });

document.getElementById('announcement-action-pin').addEventListener('click', handlePinAnnouncement);

document.getElementById('announcement-action-delete').addEventListener('click', handleDeleteAnnouncement);

document.getElementById('announcement-action-cancel').addEventListener('click', () => {
            document.getElementById('announcement-actions-modal').classList.remove('visible');
        });

document.getElementById('reset-global-css-btn').addEventListener('click', () => {
                        document.getElementById('global-css-input').value = '';
                        
                        
                    });
}
