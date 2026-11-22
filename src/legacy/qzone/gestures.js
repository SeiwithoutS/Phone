import { createMessageElement } from '../chat/conversation.js'
import { getDisplayNameByOriginalName } from '../chat/groups.js'
import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { clearQzoneReplyContext, closeQzoneStickerPanel, openQzoneStickerPanel, openRepostModal, renderQzonePosts, showPostActions, updateSinglePostInDOM } from './feed.js'
import { runtime } from '../runtime/state.js'

export function resetAllSwipes(exceptThisOne = null) {
            document.querySelectorAll('.qzone-post-container').forEach(container => {
                if (container !== exceptThisOne) {
                    container.querySelector('.qzone-post-item').classList.remove('swiped');
                }
            });
        }

export async function handlePostClick(e) {
            e.stopPropagation();
            const target = e.target;
        
            
const deleteBtn = target.closest('.comment-delete-btn');
if (deleteBtn) {
    const postContainer = deleteBtn.closest('.qzone-post-container');
    const postId = parseInt(postContainer.dataset.postId);
    const commentIndex = parseInt(deleteBtn.dataset.commentIndex);
    if (isNaN(postId) || isNaN(commentIndex)) return;

    const post = runtime.qzonePostsCache.find(p => p.id === postId);
    if (!post || !post.comments || !post.comments[commentIndex]) return;
    
    
    
    const deletedComment = post.comments[commentIndex];
    
    const confirmed = await showCustomConfirm("Delete Comment", "Delete this comment?", { confirmButtonClass: 'btn-danger' });
    if (confirmed) {
        
        post.comments.splice(commentIndex, 1);
        await runtime.db.qzonePosts.update(postId, { comments: post.comments });
        
        
        
        
        if (deletedComment && deletedComment.commenterName === runtime.state.qzoneSettings.nickname) {
            console.log("用户删除了自己的评论，开始清理AI记忆...");

            
            const aiToNotifyIds = new Set();
            if (post.authorId !== 'user') {
                aiToNotifyIds.add(post.authorId);
            }
            if (deletedComment.replyTo) {
                const repliedToChat = Object.values(runtime.state.chats).find(c => c.originalName === deletedComment.replyTo);
                if (repliedToChat) {
                    aiToNotifyIds.add(repliedToChat.id);
                }
            }

            
            const postSummary = (post.publicText || post.content || '').substring(0, 30);
            const userNickname = runtime.state.qzoneSettings.nickname;
            let notificationText;
            const stickerMatch = runtime.state.userStickers.find(s => s.url === deletedComment.text);

            if (stickerMatch) {
                 notificationText = `用户'${userNickname}'刚刚在你的动态“${postSummary}”下，发送了一个表情评论，意思是：“${stickerMatch.name}”。`;
            } else if (deletedComment.replyTo) {
                 const repliedToDisplayName = getDisplayNameByOriginalName(deletedComment.replyTo);
                 notificationText = `用户'${userNickname}'刚刚在你的动态“${postSummary}”下，回复了'${repliedToDisplayName}'的评论，内容是：“${deletedComment.text}”。`;
            } else {
                 notificationText = `用户'${userNickname}'刚刚评论了你的动态“${postSummary}”，内容是：“${deletedComment.text}”。`;
            }
            const fullSystemContent = `[系统提示：${notificationText}请你对此作出回应。]`;

            
            for (const aiId of aiToNotifyIds) {
                const chat = runtime.state.chats[aiId];
                if (chat) {
                    const originalLength = chat.history.length;
                    
                    chat.history = chat.history.filter(msg => 
                        !(msg.isHidden && msg.role === 'system' && msg.content === fullSystemContent)
                    );
                    
                    if (chat.history.length < originalLength) {
                        console.log(`在角色 "${chat.name}" 的记忆中清除了1条关于已删除评论的通知。`);
                        await runtime.db.chats.put(chat);
                    }
                }
            }
        }
        

        await updateSinglePostInDOM(postId); 
    }
    
    return; 
}
            
            
            const stickerBtn = target.closest('.comment-sticker-btn');
            if (stickerBtn) {
                const postContainer = stickerBtn.closest('.qzone-post-container');
                if (!postContainer) return;
                const postId = parseInt(postContainer.dataset.postId);
                if (runtime.qzoneStickerPanelState.isOpen && runtime.qzoneStickerPanelState.activePostId === postId) {
                    closeQzoneStickerPanel();
                } else {
                    openQzoneStickerPanel(postId, stickerBtn);
                }
                return; 
            }
            const commentItem = target.closest('.comment-item');
            if (commentItem) {
                const postId = parseInt(commentItem.dataset.postId);
                const commenterOriginalName = commentItem.dataset.commenterOriginalName;
                const commenterDisplayName = commentItem.dataset.commenterDisplayName;
        
                if (!commenterOriginalName || !commenterDisplayName || commenterOriginalName === runtime.state.qzoneSettings.nickname) {
                    clearQzoneReplyContext(commentItem.closest('.qzone-post-container'));
                    return;
                }
                runtime.currentQzoneReplyContext = { postId, replyToName: commenterOriginalName, replyToDisplayName: commenterDisplayName };
                const postContainer = commentItem.closest('.qzone-post-container');
                const commentInput = postContainer.querySelector('.comment-input');
                commentInput.placeholder = `Replying to ${commenterDisplayName}:`;
                commentInput.focus();
                return; 
            }
            if (target.classList.contains('post-actions-btn')) {
                const container = target.closest('.qzone-post-container');
                if (container && container.dataset.postId) showPostActions(parseInt(container.dataset.postId));
                return;
            }
            if (target.tagName === 'IMG' && target.dataset.hiddenText) {
                showCustomAlert("Image Content", target.dataset.hiddenText.replace(/<br>/g, '\n'));
                return;
            }
        
            
            const postContainer = target.closest('.qzone-post-container');
            if (!postContainer) return;
            const postId = parseInt(postContainer.dataset.postId);
            if (isNaN(postId)) return;
        
            if (target.closest('.qzone-post-delete-action')) {
                const confirmed = await showCustomConfirm("Delete Post", "Permanently delete this post?", { confirmButtonClass: 'btn-danger' });
                if (confirmed) {
                    postContainer.style.transition = 'all 0.3s ease';
                    postContainer.style.transform = 'scale(0.8)';
                    postContainer.style.opacity = '0';
                    setTimeout(async () => {
                         await runtime.db.qzonePosts.delete(postId);
                         const notificationIdentifier = `(ID: ${postId})`;
                         for (const chatId in runtime.state.chats) {
                             const chat = runtime.state.chats[chatId];
                             const originalHistoryLength = chat.history.length;
                             chat.history = chat.history.filter(msg => !(msg.role === 'system' && msg.content.includes(notificationIdentifier)));
                             if (chat.history.length < originalHistoryLength) await runtime.db.chats.put(chat);
                         }
                         await renderQzonePosts(); 
                         alert("Post deleted.");
                    }, 300);
                }
                return;
            }
        
            const icon = target.closest('.action-icon');
            if (icon) {
                if (icon.classList.contains('repost')) { openRepostModal(postId); return; }
                if (icon.classList.contains('like')) {
                    const post = runtime.qzonePostsCache.find(p => p.id === postId);
                    if (!post) return;
                    if (!post.likes) post.likes = [];
                    const userOriginalName = runtime.state.qzoneSettings.nickname;
                    const userLikeIndex = post.likes.indexOf(userOriginalName);
                    if (userLikeIndex > -1) {
                        post.likes.splice(userLikeIndex, 1);
                    } else {
                        post.likes.push(userOriginalName);
                        icon.classList.add('animate-like');
                        icon.addEventListener('animationend', () => icon.classList.remove('animate-like'), { once: true });
                    }
                    await runtime.db.qzonePosts.update(postId, { likes: post.likes });
                    await updateSinglePostInDOM(postId); 
                }
                if (icon.classList.contains('favorite')) {
                    const existingFavorite = await runtime.db.favorites.where({ type: 'qzone_post', 'content.id': postId }).first();
                    if (existingFavorite) {
                        await runtime.db.favorites.delete(existingFavorite.id);
                        await showCustomAlert("Notice", "Removed from Favorites");
                    } else {
                        const postToSave = await runtime.db.qzonePosts.get(postId);
                        if (postToSave) {
                            await runtime.db.favorites.add({ type: 'qzone_post', content: postToSave, timestamp: Date.now() });
                            await showCustomAlert("Notice", "Added to Favorites");
                        }
                    }
                    await updateSinglePostInDOM(postId); 
                }
                return;
            }
        
            const sendBtn = target.closest('.comment-send-btn');
            if (sendBtn) {
                const commentInput = postContainer.querySelector('.comment-input');
                const commentText = commentInput.value.trim();
                if (!commentText) return alert("Enter a comment.");
                
                const post = runtime.qzonePostsCache.find(p => p.id === postId);
                if (!post) return;
        
                if (!post.comments) post.comments = [];
                
                const newComment = {
                    commenterName: runtime.state.qzoneSettings.nickname,
                    text: commentText,
                    timestamp: Date.now(),
                    replyTo: (runtime.currentQzoneReplyContext && runtime.currentQzoneReplyContext.postId === postId) ? runtime.currentQzoneReplyContext.replyToName : null
                };
                
                post.comments.push(newComment);
                await runtime.db.qzonePosts.update(postId, { comments: post.comments });
                
                let postSummary = (post.publicText || post.content || '').substring(0, 30);
                const userNickname = runtime.state.qzoneSettings.nickname;
                const notifiedAiIds = new Set();
                if (post.authorId !== 'user') notifiedAiIds.add(post.authorId);
                if (newComment.replyTo && newComment.replyTo !== userNickname) {
                    const repliedToChat = Object.values(runtime.state.chats).find(c => c.originalName === newComment.replyTo);
                    if (repliedToChat) notifiedAiIds.add(repliedToChat.id);
                }
                for (const aiId of notifiedAiIds) {
                    const chat = runtime.state.chats[aiId];
                    if (chat && !chat.isGroup) {
                        const stickerMatch = runtime.state.userStickers.find(s => s.url === commentText);
                        let notificationText = stickerMatch ? `用户'${userNickname}'刚刚在你的动态“${postSummary}”下，发送了一个表情评论，意思是：“${stickerMatch.name}”。`
                            : newComment.replyTo ? `用户'${userNickname}'刚刚在你的动态“${postSummary}”下，回复了'${runtime.currentQzoneReplyContext.replyToDisplayName}'的评论，内容是：“${commentText}”。`
                            : `用户'${userNickname}'刚刚评论了你的动态“${postSummary}”，内容是：“${commentText}”。`;
                        const historyMessage = { 
                            role: 'system', 
                            content: `[系统提示：${notificationText}请你对此作出回应。]`, 
                            timestamp: Date.now(), 
                            isHidden: true 
                        };
                        chat.history.push(historyMessage);
                        await runtime.db.chats.put(chat);
                    }
                }
                
                commentInput.value = '';
                clearQzoneReplyContext(postContainer); 
                await updateSinglePostInDOM(postId); 
                return;
            }
        }

export async function openSharedHistoryViewer(timestamp) { // <-- 标记为 async 函数
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const message = chat.history.find(m => m.timestamp === timestamp);
 
            if (!message || message.type !== 'share_card' || !message.payload) {
                console.error("无法找到或消息类型/内容不匹配的分享记录:", timestamp);
     
                await showCustomAlert("Could Not Open", "The shared item is missing or damaged.");
                return;
            }

            const viewerModal = document.getElementById('shared-history-viewer-modal');
            const viewerTitle = document.getElementById('shared-history-viewer-title');
            const viewerContent = document.getElementById('shared-history-viewer-content');

            viewerTitle.textContent = message.payload.title;
            viewerContent.innerHTML = ''; 

   
            const fragment = document.createDocumentFragment();
            const sourceChat = Object.values(runtime.state.chats).find(c => c.name === message.payload.sourceChatName) || chat;


            for (const sharedMsg of message.payload.sharedHistory) {
 
                const bubbleEl = await createMessageElement(sharedMsg, sourceChat);
                if (bubbleEl) {
                    fragment.appendChild(bubbleEl); 
                }
            }

       
            viewerContent.appendChild(fragment);
       
            viewerModal.classList.add('visible');
        }
