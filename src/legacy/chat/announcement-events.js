import { runtime } from '../runtime/state.js'
import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { renderChatList } from './list.js'
import { hideMessageActions } from './editor.js'
import { appendMessage } from './conversation.js'
import { controls } from '../runtime/state.js'
import { handleUserPat } from './attachments.js'

export function bindAnnouncementEvents() {
  document.getElementById('pat-btn').addEventListener('click', () => {
            
            if (runtime.state.activeChatId && !runtime.state.chats[runtime.state.activeChatId].isGroup) {
                const chat = runtime.state.chats[runtime.state.activeChatId];
                
                handleUserPat(chat.id, chat.originalName);
            }
        });

controls.activeAnnouncementId = null
}

export function showAnnouncementActions(annoId) {
            controls.activeAnnouncementId = annoId;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const announcement = chat.announcements.find(a => a.id === annoId);
            if (!announcement) return;
        
            const pinButton = document.getElementById('announcement-action-pin');
            
            pinButton.textContent = announcement.isPinned ? "Unpin" : "Pin Announcement";
        
            document.getElementById('announcement-actions-modal').classList.add('visible');
        }

export async function publishToAnnouncementBoard() {
            if (!runtime.activeMessageTimestamp) return;
        
            const timestampToPublish = runtime.activeMessageTimestamp;
            hideMessageActions(); 
        
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const message = chat.history.find(m => m.timestamp === timestampToPublish);
            if (!message) return;
        
            
            let contentPreview = String(message.content || '').substring(0, 50) + '...';
            if (message.type === 'ai_image') contentPreview = '[图片] ' + contentPreview;
        
            const confirmed = await showCustomConfirm(
                "Publish Announcement",
                `Publish this message to Announcements? “${contentPreview}”`,
                { confirmText: "确定发布" }
            );
        
            if (confirmed) {
                const myNickname = chat.settings.myNickname || '我';
        
                if (!Array.isArray(chat.announcements)) {
                    chat.announcements = [];
                }
        
                
                const newAnnouncement = {
                    id: 'anno_' + Date.now(), 
                    messageTimestamp: timestampToPublish,
                    publisher: myNickname,
                    publishedAt: Date.now(),
                    isPinned: false 
                };
        
                chat.announcements.push(newAnnouncement);
        
                const systemMessage = {
                    role: 'system',
                    type: 'pat_message',
                    content: `${myNickname} 发布了一条新公告`,
                    timestamp: Date.now()
                };
                chat.history.push(systemMessage);
        
                await runtime.db.chats.put(chat);
                appendMessage(systemMessage, chat);
                renderChatList();
        
                await showCustomAlert("Success", "Announcement published.");
            }
        }
