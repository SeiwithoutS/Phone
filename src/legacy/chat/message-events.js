import { playTtsAudio, toggleVoiceTranscript } from '../calls/audio.js'
import { endPoll, handlePacketClick, handleUserVote, handleWaimaiResponse, showPollResults, showTransferActionModal, showWaimaiDetails } from './attachments.js'
import { scrollToOriginalMessage } from './conversation.js'
import { showCustomAlert } from '../dialogs/dialogs.js'
import { openSharedHistoryViewer } from '../qzone/gestures.js'
import { showGiftReceipt } from '../shopping/store.js'
import { runtime } from '../runtime/state.js'
import { escapeHtml } from '../../runtime/files'

export function bindChatMessageActions() {
  document.getElementById('chat-messages').addEventListener('click', async (e) => {
    
const voiceBody = e.target.closest('.voice-message-body[data-text]');
if (voiceBody) {
    
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return; 

    
    toggleVoiceTranscript(voiceBody);

    
    const bubble = voiceBody.closest('.message-bubble');
    const transcriptEl = bubble ? bubble.querySelector('.voice-transcript') : null;

    
    if (voiceBody.dataset.voiceId && transcriptEl && transcriptEl.style.display === 'block') {

        
        if (chat.isGroup) {
            console.log("这是一条群聊语音消息，已禁止发起TTS请求。");
            return; 
        }
        if (chat.settings.enableTts === false) {
            console.log(`“${chat.name}”的TTS功能已关闭，已禁止发起TTS请求。`);
            return; 
        }

        
        playTtsAudio(voiceBody);
    }

    return; 
}
            
            const detailsBtn = e.target.closest('.waimai-details-btn');
            if (detailsBtn) {
                const bubble = detailsBtn.closest('.message-bubble');
                if (bubble) {
                    const timestamp = parseInt(bubble.dataset.timestamp);
                    if (!isNaN(timestamp)) {
                        showWaimaiDetails(timestamp); 
                        return; 
                    }
                }
            }
            
            
            
            const choiceBtn = e.target.closest('.waimai-user-actions button');
            if (choiceBtn) {
                const bubble = choiceBtn.closest('.message-bubble');
                if (bubble) {
                    const timestamp = parseInt(bubble.dataset.timestamp);
                    const choice = choiceBtn.dataset.choice; 
                    if (!isNaN(timestamp) && choice) {
                        await handleWaimaiResponse(timestamp, choice); 
                        return; 
                    }
                }
            }
        
            
            const deletedPostPlaceholder = e.target.closest('.post-deleted-placeholder');
            if (deletedPostPlaceholder) {
                const postId = parseInt(deletedPostPlaceholder.dataset.postId);
                if (!isNaN(postId)) {
                    const post = await runtime.db.qzonePosts.get(postId);
                    if (post) {
                        let originalContent = '';
                        const authorName = post.authorId === 'user' ? runtime.state.qzoneSettings.nickname : (runtime.state.chats[post.authorId]?.name || '未知作者');
                        
                        if(post.type === 'shuoshuo'){
                            originalContent = post.content;
                        } else {
                            originalContent = post.publicText || '';
                            if(post.imageUrl) originalContent += `\n[图片]`;
                            if(post.hiddenContent) originalContent += `\n[文字图内容: ${post.hiddenContent}]`;
                        }
                        
                        showCustomAlert(
                            `Deleted post by ${authorName}`, 
                            originalContent.replace(/\n/g, '<br>')
                        );
                    } else {
                        showCustomAlert("Notice", "The original post was permanently removed.");
                    }
                }
                return;
            }
        
            const aiImage = e.target.closest('.ai-generated-image');
            if (aiImage) {
                const description = aiImage.dataset.description;
                if (description) showCustomAlert("Photo Description", description);
                return;
            }
        
            const quoteBlock = e.target.closest('.quoted-message');
            if (quoteBlock && quoteBlock.dataset.originalTimestamp) {
                const originalTimestamp = parseInt(quoteBlock.dataset.originalTimestamp);
                if (!isNaN(originalTimestamp)) {
                    scrollToOriginalMessage(originalTimestamp);
                }
            }
            
            const giftCard = e.target.closest('.gift-card');
            if (giftCard) {
                const bubble = giftCard.closest('.message-bubble');
                if (bubble) {
                    showGiftReceipt(parseInt(bubble.dataset.timestamp));
                }
            }
        
            const packetCard = e.target.closest('.red-packet-card');
            if (packetCard) {
                const messageBubble = packetCard.closest('.message-bubble');
                if (messageBubble && messageBubble.dataset.timestamp) {
                    const timestamp = parseInt(messageBubble.dataset.timestamp);
                    handlePacketClick(timestamp);
                }
            }
            
            const pollCard = e.target.closest('.poll-card');
            if (pollCard) {
                const timestamp = parseInt(pollCard.dataset.pollTimestamp);
                if (isNaN(timestamp)) return;
                
                const optionItem = e.target.closest('.poll-option-item');
                if (optionItem && !pollCard.classList.contains('closed')) {
                    handleUserVote(timestamp, optionItem.dataset.option);
                    return;
                }
                
                const actionBtn = e.target.closest('.poll-action-btn');
                if (actionBtn) {
                    if (pollCard.classList.contains('closed')) {
                        showPollResults(timestamp);
                    } else {
                        endPoll(timestamp);
                    }
                    return;
                }
        
                if (pollCard.classList.contains('closed')) {
                    showPollResults(timestamp);
                }
            }
        

        
            const placeholder = e.target.closest('.recalled-message-placeholder');
            if (placeholder) {
                const chat = runtime.state.chats[runtime.state.activeChatId];
                const wrapper = placeholder.closest('.message-wrapper');
                if (chat && wrapper) {
                    const timestamp = parseInt(wrapper.dataset.timestamp);
                    const recalledMsg = chat.history.find(m => m.timestamp === timestamp);
                    
                    if (recalledMsg?.recalledData) {
                        const { originalType, originalContent, originalMeaning } = recalledMsg.recalledData;
                        const content = escapeHtml(typeof originalContent === 'string' ? originalContent : JSON.stringify(originalContent) ?? '');
                        const labels = { text: 'Original message', user_photo: 'Photo description', ai_image: 'Image description',
                            text_image: 'Image description', voice_message: 'Voice message' };
                        const label = Object.hasOwn(labels, originalType) ? labels[originalType] : String(originalType || 'message').replaceAll('_', ' ');
                        let details = `${escapeHtml(label)}: “${content}”`;
                        if (originalType === 'sticker') details = `Sticker: ${escapeHtml(String(originalMeaning || 'No description'))}\nURL: ${content}`;
                        if (originalType === 'transfer') details = 'A transfer message was recalled.';
                        showCustomAlert('Recalled message', details);
                    }
                }
                return;
            }
        
            const linkCard = e.target.closest('[data-kind="share_card"]');
            if (linkCard && linkCard.closest('.message-bubble.is-link-share')) {
                const timestamp = parseInt(linkCard.dataset.timestamp);
                openSharedHistoryViewer(timestamp);
            }
        
            const bubble = e.target.closest('.message-bubble');
            if (bubble && bubble.classList.contains('ai') && bubble.classList.contains('is-transfer') && bubble.dataset.status === 'pending') {
                const timestamp = parseInt(bubble.dataset.timestamp);
                if (!isNaN(timestamp)) {
                    showTransferActionModal(timestamp);
                }
            }
        });
}
