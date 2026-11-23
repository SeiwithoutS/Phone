import { controls, runtime } from '../runtime/state.js'
import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { renderChatList } from './list.js'
import { hideMessageActions } from './editor.js'
import { appendMessage } from './conversation.js'
import { handleDeleteAnnouncement, handlePinAnnouncement, showAnnouncementBoard } from './groups.js'

export function bindAnnouncementEvents() {
  controls.activeAnnouncementId = null
  const board = document.getElementById('announcement-board-modal')
  const actions = document.getElementById('announcement-actions-modal')
  document.getElementById('publish-to-announcement-btn').addEventListener('click', publishToAnnouncementBoard)
  document.getElementById('show-announcement-board-btn').addEventListener('click', showAnnouncementBoard)
  document.getElementById('close-announcement-board-btn').addEventListener('click', () => board.classList.remove('visible'))
  document.getElementById('announcement-board-content').addEventListener('click', event => {
    const id = event.target.closest('.announcement-item-actions')?.dataset.annoId
    if (id) showAnnouncementActions(id)
  })
  document.getElementById('announcement-action-pin').addEventListener('click', handlePinAnnouncement)
  document.getElementById('announcement-action-delete').addEventListener('click', handleDeleteAnnouncement)
  document.getElementById('announcement-action-cancel').addEventListener('click', () => actions.classList.remove('visible'))
}

function showAnnouncementActions(annoId) {
            controls.activeAnnouncementId = annoId;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const announcement = chat.announcements.find(a => a.id === annoId);
            if (!announcement) return;
        
            const pinButton = document.getElementById('announcement-action-pin');
            
            pinButton.textContent = announcement.isPinned ? "Unpin" : "Pin Announcement";
        
            document.getElementById('announcement-actions-modal').classList.add('visible');
        }

async function publishToAnnouncementBoard() {
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
