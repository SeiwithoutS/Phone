import { preferences } from '../storage/preferences.js'
import { updateBackButtonUnreadCount } from '../backup/backup.js'
import { createCountdownCard, startAllCountdownTimers } from '../chat/attachments.js'
import { getDisplayNameByOriginalName } from '../chat/groups.js'
import { addLongPressListener, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { hideLoader, showLoader } from '../dialogs/dialogs.js'
import { parseMarkdown } from '../rendering/markup.js'
import { runtime } from '../runtime/state.js'

export function renderQzoneScreen() {
                    if (runtime.state && runtime.state.qzoneSettings) {
                        const settings = runtime.state.qzoneSettings;
                        document.getElementById('qzone-nickname').textContent = settings.nickname;
                        document.getElementById('qzone-avatar-img').src = settings.avatar;
                        document.getElementById('qzone-banner-img').src = settings.banner;
                    }
                }

export async function saveQzoneSettings() {
                    if (runtime.db && runtime.state.qzoneSettings) {
                        await runtime.db.qzoneSettings.put(runtime.state.qzoneSettings);
                    }
                }

export function formatPostTimestamp(timestamp) {
                    if (!timestamp) return '';
                    const now = new Date();
                    const date = new Date(timestamp);
                    const diffSeconds = Math.floor((now - date) / 1000);
                    const diffMinutes = Math.floor(diffSeconds / 60);
                    const diffHours = Math.floor(diffMinutes / 60);
                    if (diffMinutes < 1) return '刚刚';
                    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
                    if (diffHours < 24) return `${diffHours}小时前`;
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    if (now.getFullYear() === year) {
                        return `${month}-${day} ${hours}:${minutes}`;
                    } else {
                        return `${year}-${month}-${day} ${hours}:${minutes}`;
                    }
                }

export async function createOrUpdatePostElement(post) { 
            const existingPostContainer = document.querySelector(`.qzone-post-container[data-post-id="${post.id}"]`);
            const isUpdating = !!existingPostContainer;
            
            const postContainer = isUpdating ? existingPostContainer : document.createElement('div');
            if (!isUpdating) {
                postContainer.className = 'qzone-post-container';
                postContainer.dataset.postId = post.id;
            }
        
            const postEl = isUpdating ? postContainer.querySelector('.qzone-post-item') : document.createElement('div');
            if (!isUpdating) {
                postEl.className = 'qzone-post-item';
            }
        
            let authorAvatar = '', authorNickname = '', commentAvatar = runtime.state.qzoneSettings.avatar; 
        
            
            if (post.authorId === 'user') {
                authorAvatar = runtime.state.qzoneSettings.avatar;
                authorNickname = runtime.state.qzoneSettings.nickname;
            } else if (runtime.state.chats[post.authorId]) {
                const authorChat = runtime.state.chats[post.authorId];
                authorAvatar = authorChat.settings.aiAvatar || runtime.defaultAvatar;
                authorNickname = authorChat.name;
            } else if (String(post.authorId).startsWith('npc_')) {
                
                const npcId = parseInt(String(post.authorId).replace('npc_', ''));
                if (!isNaN(npcId)) {
                    const npc = await runtime.db.npcs.get(npcId);
                    if (npc) {
                        authorAvatar = npc.avatar || runtime.defaultGroupMemberAvatar;
                        authorNickname = npc.name;
                    } else {
                        authorNickname = post.authorOriginalName || '未知NPC';
                        authorAvatar = runtime.defaultGroupMemberAvatar;
                    }
                }
            } else {
                
                authorNickname = getDisplayNameByOriginalName(post.authorOriginalName);
                authorAvatar = runtime.defaultAvatar;
            }
            
        
function renderOriginalPostContent(targetPost) {
            let innerContentHtml = '';
            const publicTextHtml = targetPost.publicText ? `<div class="post-content">${parseMarkdown(targetPost.publicText).replace(/\n/g, '<br>')}</div>` : '';

            if (targetPost.type === 'shuoshuo') {
                innerContentHtml = `<div class="post-content" style="margin-bottom: 10px;">${parseMarkdown(targetPost.content).replace(/\n/g, '<br>')}</div>`;
            } else if (targetPost.type === 'image_post' && targetPost.imageUrl) {
                
                innerContentHtml = publicTextHtml ? `${publicTextHtml}<div style="margin-top:10px;"><img src="${targetPost.imageUrl}" class="chat-image"></div>` : `<img src="${targetPost.imageUrl}" class="chat-image">`;
            } else if (targetPost.type === 'text_image') {
                
                const postImageUrl = runtime.state.globalSettings.enableAiDrawing && targetPost.image_prompt ? `https://image.pollinations.ai/prompt/${targetPost.image_prompt}` : 'https://i.postimg.cc/KYr2qRCK/1.jpg';
                innerContentHtml = publicTextHtml ? `${publicTextHtml}<div style="margin-top:10px;"><img src="${postImageUrl}" class="chat-image" style="cursor: pointer;" data-hidden-text="${targetPost.hiddenContent}"></div>` : `<img src="${postImageUrl}" class="chat-image" style="cursor: pointer;" data-hidden-text="${targetPost.hiddenContent}">`;
            }

            else if (targetPost.type === 'naiimag') {
                // NovelAI图片动态渲染（支持多图布局，最多2张）
                const imageUrls = targetPost.imageUrls || (targetPost.imageUrl ? [targetPost.imageUrl] : []);
                
                if (imageUrls.length > 0) {
                    const imageCount = imageUrls.length;
                    let imagesHtml = '';
                    
                    // 使用统一的多图布局（包括单张图片）
                    imagesHtml = `<div class="post-images-grid grid-${imageCount}">`;
                    imageUrls.forEach((url, index) => {
                        imagesHtml += `<img src="${url}" class="naiimag-image" alt="图片${index + 1}" loading="lazy" onerror="this.src='https://i.postimg.cc/KYr2qRCK/1.jpg'; this.alt='图片加载失败';">`;
                    });
                    imagesHtml += '</div>';
                    
                    innerContentHtml = publicTextHtml ? `${publicTextHtml}${imagesHtml}` : imagesHtml;
                }
            }
            return innerContentHtml;
        }
        
            let mainContentHtml;
        
            if (post.type === 'repost') {
                const repostCommentHtml = post.repostComment ? `<div class="post-content">${post.repostComment.replace(/\n/g, '<br>')}</div>` : '';
                let originalAuthorAvatar = runtime.defaultAvatar;
                let originalAuthorNickname = '原作者';
                if (post.originalPost.authorId === 'user') {
                    originalAuthorAvatar = runtime.state.qzoneSettings.avatar;
                    originalAuthorNickname = runtime.state.qzoneSettings.nickname;
                } else {
                    const originalAuthorChat = runtime.state.chats[post.originalPost.authorId];
                    if (originalAuthorChat) {
                        originalAuthorAvatar = originalAuthorChat.settings.aiAvatar || runtime.defaultAvatar;
                    }
                    originalAuthorNickname = getDisplayNameByOriginalName(post.originalPost.authorOriginalName);
                }
                mainContentHtml = `
                    ${repostCommentHtml}
                    <div class="reposted-content-wrapper">
                        <div class="post-header">
                            <img src="${originalAuthorAvatar}" class="post-avatar">
                            <div class="post-info">
                                <span class="post-nickname">@${originalAuthorNickname}</span>
                                <span class="post-timestamp">${formatPostTimestamp(post.originalPost.timestamp)}</span>
                            </div>
                        </div>
                        <div class="post-main-content">${renderOriginalPostContent(post.originalPost)}</div>
                    </div>
                `;
            } else {
                mainContentHtml = `<div class="post-main-content">${renderOriginalPostContent(post)}</div>`;
            }
        
            let likesHtml = '';
            if (post.likes && post.likes.length > 0) {
                const displayLikes = post.likes.map(name => getDisplayNameByOriginalName(name)).join('、');
                likesHtml = `<div class="post-likes-section"><svg class="like-icon" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span>${displayLikes} 觉得很赞</span></div>`;
            }
        
        
            let commentsHtml = '';
            if (post.comments && post.comments.length > 0) {
                commentsHtml = '<div class="post-comments-container">';
                post.comments.forEach((comment, index) => {
                    
                    if (typeof comment === 'object' && comment !== null && comment.commenterName) {
                        const commenterOriginalName = comment.commenterName;
                        
                        const commenterDisplayName = getDisplayNameByOriginalName(commenterOriginalName);
                        
                        let innerCommentContent;
                        if (runtime.STICKER_REGEX.test(comment.text)) {
                            innerCommentContent = `<img src="${comment.text}" class="comment-sticker" alt="sticker">`;
                        } else {
                            innerCommentContent = parseMarkdown(comment.text);
                        }
        
                        let commentLineHtml = '';
                        
                        if (comment.replyTo) {
                            const repliedToDisplayName = getDisplayNameByOriginalName(comment.replyTo);
                            commentLineHtml = `<span class="commenter-name">${commenterDisplayName}</span> Response <span class="commenter-name">${repliedToDisplayName}</span>: ${innerCommentContent}`;
                        } else {
                            commentLineHtml = `<span class="commenter-name">${commenterDisplayName}</span>: ${innerCommentContent}`;
                        }
                        
                        commentsHtml += `<div class="comment-item" data-post-id="${post.id}" data-commenter-original-name="${commenterOriginalName}" data-commenter-display-name="${commenterDisplayName}">
                                            <div class="comment-text">${commentLineHtml}</div>
                                            <span class="comment-delete-btn" data-comment-index="${index}">×</span>
                                         </div>`;
        
                    } else {
                        
                        commentsHtml += `<div class="legacy-comment-item">
                                            <span class="comment-text">${String(comment)}</span>
                                         </div>`;
                    }
                });
                commentsHtml += '</div>';
            }
          
        
            const userOriginalName = runtime.state.qzoneSettings.nickname;
            const isLikedByUser = post.likes && post.likes.includes(userOriginalName);
            const isFavoritedByUser = runtime.state.favoritedPostIds && runtime.state.favoritedPostIds.has(post.id); 
        
            let repostIconHtml = '';
            if (post.type !== 'repost') {
                repostIconHtml = `
                    <span class="action-icon repost">
                        <svg viewBox="0 0 24 24"><path d="M17 2.1l4 4-4 4 M3 11.5v-3a4 4 0 0 1 4-4h13 M7 21.9l-4-4 4-4 M21 12.5v3a4 4 0 0 1-4 4H4"></path></svg>
                    </span>`;
            }
            
            postEl.innerHTML = `
                <div class="post-header">
                    <img src="${authorAvatar}" class="post-avatar" data-author-id="${post.authorId}">
                    <div class="post-info">
                        <span class="post-nickname">${authorNickname}</span>
                        <span class="post-timestamp">${formatPostTimestamp(post.timestamp)}</span>
                    </div>
                    <div class="post-actions-btn">…</div>
                </div>
                ${mainContentHtml}
                <div class="post-feedback-icons">
                    ${repostIconHtml}
                    <span class="action-icon like ${isLikedByUser ? 'active' : ''}"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></span>
                    <span class="action-icon favorite ${isFavoritedByUser ? 'active' : ''}"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></span>
                </div>
                ${likesHtml}
                ${commentsHtml}
                <div class="post-footer">
                    <div class="comment-section">
                        <img src="${commentAvatar}" class="comment-avatar">
                        <input type="text" class="comment-input" placeholder="Write a comment…">
                        <button class="comment-sticker-btn">
        <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14 Q 12 16 16 14"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
        </svg>
        </button>
                        <div class="at-mention-popup"></div>
                    </div>
                    <button class="comment-send-btn">Send</button>
                </div>
            `;
        
            if (!isUpdating) {
                const deleteAction = document.createElement('div');
                deleteAction.className = 'qzone-post-delete-action';
                deleteAction.innerHTML = "<span>Delete</span>";
                postContainer.appendChild(postEl);
                postContainer.appendChild(deleteAction);
            }
            
            return postContainer;
        }

export async function updateSinglePostInDOM(postId) {
            const postData = await runtime.db.qzonePosts.get(postId);
            if (!postData) {
                
                const postContainer = document.querySelector(`.qzone-post-container[data-post-id="${postId}"]`);
                if (postContainer) {
                    postContainer.remove();
                }
                return;
            }
        
            
            const cacheIndex = runtime.qzonePostsCache.findIndex(p => p.id === postId);
            if (cacheIndex > -1) {
                runtime.qzonePostsCache[cacheIndex] = postData;
            }
            
            
            const favorites = await runtime.db.favorites.where('type').equals('qzone_post').toArray();
            runtime.state.favoritedPostIds = new Set(favorites.map(fav => fav.content.id));
        
            
           await createOrUpdatePostElement(postData);
        }

export async function renderQzonePosts() {
    const postsListEl = document.getElementById('qzone-posts-list');
    if (!postsListEl) return;

    const [postsFromDb, favorites] = await Promise.all([
        runtime.db.qzonePosts.orderBy('timestamp').reverse().filter(post => !post.isDeleted).toArray(),
        runtime.db.favorites.where('type').equals('qzone_post').toArray()
    ]);
    runtime.qzonePostsCache = postsFromDb;
    runtime.state.favoritedPostIds = new Set(favorites.map(fav => fav.content.id));

    postsListEl.innerHTML = '';
    runtime.qzonePostsRenderCount = 0; 

    if (runtime.qzonePostsCache.length === 0) {
        postsListEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 30px 0;\">Create a post to start the feed.</p>";
        return;
    }

    
    loadMoreQzonePosts();
}

export async function loadMoreQzonePosts() {
    if (runtime.isLoadingMorePosts) return;
    runtime.isLoadingMorePosts = true;

    const postsListEl = document.getElementById('qzone-posts-list');
    if (!postsListEl) {
        runtime.isLoadingMorePosts = false;
        return;
    }

    showLoader(postsListEl, 'bottom'); 

    
    setTimeout(async () => {
        hideLoader(postsListEl); 

        const nextSliceStart = runtime.qzonePostsRenderCount;
        const nextSliceEnd = runtime.qzonePostsRenderCount + runtime.QZONE_RENDER_WINDOW;
        const postsToAppend = runtime.qzonePostsCache.slice(nextSliceStart, nextSliceEnd);

        const fragment = document.createDocumentFragment();
for (const post of postsToAppend) {
                    const postElement = await createOrUpdatePostElement(post); 
                    fragment.appendChild(postElement);
                }
        postsListEl.appendChild(fragment);

        runtime.qzonePostsRenderCount += postsToAppend.length;

        runtime.isLoadingMorePosts = false;
    }, 500);
}

export function openQzoneStickerPanel(postId, buttonElement) {
            const panel = runtime.qzoneStickerPanelState.panelEl;
            const grid = runtime.qzoneStickerPanelState.gridEl;
        
            
            grid.innerHTML = '';
            if (runtime.state.userStickers.length === 0) {
                grid.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); grid-column: 1 / -1; padding-top: 20px;\">Add stickers to the chat's<br>sticker panel first.</p>";
            } else {
                runtime.state.userStickers.forEach(sticker => {
                    const item = document.createElement('div');
                    item.className = 'sticker-item';
                    item.style.backgroundImage = `url(${sticker.url})`;
                    item.title = sticker.name;
                    grid.appendChild(item);
                });
            }
        
            
        
            
            const btnRect = buttonElement.getBoundingClientRect();
            const phoneScreenRect = document.getElementById('phone-screen').getBoundingClientRect();
            
            panel.style.display = 'flex'; 
            const panelRect = panel.getBoundingClientRect();
            const panelHeight = panelRect.height;
            const panelWidth = panelRect.width;
        
            
            panel.style.top = `${btnRect.top - panelHeight - 5 - phoneScreenRect.top}px`;
        
            
            const desiredLeftPosition = btnRect.left - phoneScreenRect.left;
        
            
            if (desiredLeftPosition + panelWidth > phoneScreenRect.width) {
                
                panel.style.left = 'auto';
                panel.style.right = '5px';
            } else {
                
                panel.style.left = `${desiredLeftPosition}px`;
                panel.style.right = 'auto';
            }
            
            
        
            
            runtime.qzoneStickerPanelState.isOpen = true;
            runtime.qzoneStickerPanelState.activePostId = postId;
        }

export function closeQzoneStickerPanel() {
            
            if (runtime.qzoneStickerPanelState.isOpen) {
                
                runtime.qzoneStickerPanelState.panelEl.style.display = 'none';
                
                
                runtime.qzoneStickerPanelState.isOpen = false;
                runtime.qzoneStickerPanelState.activePostId = null;
            }
        }

export async function sendQzoneStickerComment(postId, sticker) {
            if (!sticker || !sticker.url) return;
        
            const post = await runtime.db.qzonePosts.get(postId);
            if (!post) {
                console.error("sendQzoneStickerComment: 找不到帖子:", postId);
                return;
            }
        
            if (!post.comments) {
                post.comments = [];
            }
            
            const newComment = {
                commenterName: runtime.state.qzoneSettings.nickname,
                text: sticker.url,
                meaning: sticker.name, 
                timestamp: Date.now()
            };
            
            post.comments.push(newComment);
        
            await runtime.db.qzonePosts.update(postId, { comments: post.comments });
        
            closeQzoneStickerPanel();
            await renderQzonePosts();
            
            const postSummary = (post.publicText || post.content || `[图片动态]`).substring(0, 30);
            
            
            for (const chatId in runtime.state.chats) {
                const chat = runtime.state.chats[chatId];
                if (!chat.isGroup) {
                    const intelligentPrompt = `[系统提示：'${runtime.state.qzoneSettings.nickname}' 在你的动态(ID: ${postId}, 内容摘要: “${postSummary}”)下发送了一个表情评论，意思是：“${sticker.name}”。请你对此作出回应。]`;
                    
                    const historyMessage = { 
                        role: 'system', 
                        content: intelligentPrompt, 
                        timestamp: Date.now(), 
                        isHidden: true 
                    };
                    chat.history.push(historyMessage);
                    await runtime.db.chats.put(chat);
                }
            }
            
        }

export function openRepostModal(postId) {
            runtime.repostTargetId = postId;
            document.getElementById('repost-comment-input').value = ''; 
            document.getElementById('repost-modal').classList.add('visible');
        }

export function hideRepostModal() {
            document.getElementById('repost-modal').classList.remove('visible');
            runtime.repostTargetId = null;
        }

export async function handleConfirmRepost() {
            if (!runtime.repostTargetId) return;
        
            const comment = document.getElementById('repost-comment-input').value.trim();
            const originalPost = await runtime.db.qzonePosts.get(runtime.repostTargetId);
        
            if (!originalPost) {
                alert("The original post could not be found.");
                hideRepostModal();
                return;
            }
        
            const newPost = {
                type: 'repost', 
                timestamp: Date.now(),
                authorId: 'user', 
                repostComment: comment,
                originalPost: originalPost, 
                visibleGroupIds: null 
            };
        
            await runtime.db.qzonePosts.add(newPost);
            hideRepostModal();
            await renderQzonePosts();
            alert("Post shared.");
        }

export function resetCreatePostModal() {
                    document.getElementById('post-public-text').value = '';
                    document.getElementById('post-image-preview').src = '';
                    document.getElementById('post-image-description').value = '';
                    document.getElementById('post-image-preview-container').classList.remove('visible');
                    document.getElementById('post-image-desc-group').style.display = 'none';
                    document.getElementById('post-local-image-input').value = '';
                    document.getElementById('post-hidden-text').value = '';
                    document.getElementById('switch-to-image-mode').click();
                }

export function updateUnreadIndicator(count) {
            runtime.unreadPostsCount = count;
            preferences.setItem('unreadPostsCount', count); 

            
            const navItem = document.querySelector('.nav-item[data-view="qzone-screen"]');
            
            if (!navItem) return;
            const targetSpan = navItem.querySelector('span'); 
            let indicator = navItem.querySelector('.unread-indicator');           

            if (count > 0) {
                if (!indicator) {
                    indicator = document.createElement('span');
                    indicator.className = 'unread-indicator';
                    targetSpan.style.position = 'relative'; 
                    targetSpan.appendChild(indicator); 
                }
                indicator.textContent = count > 99 ? '99+' : count;
                indicator.style.display = 'block';
            } else {
                if (indicator) {
                    indicator.style.display = 'none';
                }
            }

            
            updateBackButtonUnreadCount();
        }

export function showPostActions(postId) {
            runtime.activePostId = postId;
            document.getElementById('post-actions-modal').classList.add('visible');
        }

export function hidePostActions() {
            document.getElementById('post-actions-modal').classList.remove('visible');
            runtime.activePostId = null;
        }

export async function openPostEditor() {
            if (!runtime.activePostId) return;
        
            const postIdToEdit = runtime.activePostId;
            const post = await runtime.db.qzonePosts.get(postIdToEdit);
            if (!post) return;
        
            hidePostActions();
        
            
            let contentForEditing;
            if (post.type === 'shuoshuo') {
                contentForEditing = post.content;
            } else {
                
                const postObject = {
                    type: post.type,
                    publicText: post.publicText || '',
                };
                if (post.type === 'image_post') {
                    postObject.imageUrl = post.imageUrl;
                    postObject.imageDescription = post.imageDescription;
                } else if (post.type === 'text_image') {
                    postObject.hiddenContent = post.hiddenContent;
                }
                contentForEditing = JSON.stringify(postObject, null, 2);
            }
            
            
            const templates = {
                shuoshuo: "在这里输入说说的内容...", 
                image: { type: 'image_post', publicText: '', imageUrl: 'https://...', imageDescription: '' },
                text_image: { type: 'text_image', publicText: '', hiddenContent: '' }
            };
            
            const helpersHtml = `
                <div class="format-helpers">
                    <button class="format-btn" data-type="text">Posts</button>
                    <button class="format-btn" data-template='${JSON.stringify(templates.image)}'>Photo Post</button>
                    <button class="format-btn" data-template='${JSON.stringify(templates.text_image)}'>Text Image</button>
                </div>
            `;
        
            const newContent = await showCustomPrompt(
                "Edit Post",
                "Edit the message…",
                contentForEditing,
                'textarea',
                helpersHtml
            );
            
            
            
            setTimeout(() => {
                const shuoshuoBtn = document.querySelector('#custom-modal-body .format-btn[data-type="text"]');
                if(shuoshuoBtn) {
                    shuoshuoBtn.addEventListener('click', () => {
                        const input = document.getElementById('custom-prompt-input');
                        input.value = templates.shuoshuo;
                        input.focus();
                    });
                }
            }, 100);
        
            if (newContent !== null) {
                await saveEditedPost(postIdToEdit, newContent);
            }
        }

export async function saveEditedPost(postId, newRawContent) {
            const post = await runtime.db.qzonePosts.get(postId);
            if (!post) return;
        
            const trimmedContent = newRawContent.trim();
            
            
            try {
                const parsed = JSON.parse(trimmedContent);
                
                post.type = parsed.type || 'image_post';
                post.publicText = parsed.publicText || '';
                post.imageUrl = parsed.imageUrl || '';
                post.imageDescription = parsed.imageDescription || '';
                post.hiddenContent = parsed.hiddenContent || '';
                post.content = ''; 
            } catch (e) {
                
                post.type = 'shuoshuo';
                post.content = trimmedContent;
                
                post.publicText = '';
                post.imageUrl = '';
                post.imageDescription = '';
                post.hiddenContent = '';
            }
            
            await runtime.db.qzonePosts.put(post);
            await renderQzonePosts(); 
            await showCustomAlert("Success", "Post updated.");
        }

export async function copyPostContent() {
            if (!runtime.activePostId) return;
            const post = await runtime.db.qzonePosts.get(runtime.activePostId);
            if (!post) return;
            
            let textToCopy = post.content || post.publicText || post.hiddenContent || post.imageDescription || "（无文字内容）";
            
            try {
                await navigator.clipboard.writeText(textToCopy);
                await showCustomAlert("Copied", "Post copied to the clipboard.");
            } catch (err) {
                await showCustomAlert("Copy Failed", "Could not access the clipboard.");
            }
            
            hidePostActions();
        }

export function clearQzoneReplyContext(postContainer) {
            runtime.currentQzoneReplyContext = null;
            if (postContainer) {
                
                const input = postContainer.querySelector('.comment-input');
                if (input) {
                    input.placeholder = "Write a comment…";
                }
            }
        }

export async function renderMemoriesScreen() {
            const listEl = document.getElementById('memories-list');
            listEl.innerHTML = '';
            
            
            const allMemories = await runtime.db.memories.orderBy('timestamp').reverse().toArray();
            
            if (allMemories.length === 0) {
                listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No memories or countdowns yet.</p>";
                return;
            }
        
            
            allMemories.sort((a, b) => {
                const aIsActiveCountdown = a.type === 'countdown' && a.targetDate > Date.now();
                const bIsActiveCountdown = b.type === 'countdown' && b.targetDate > Date.now();
                if (aIsActiveCountdown && !bIsActiveCountdown) return -1; 
                if (!aIsActiveCountdown && bIsActiveCountdown) return 1;  
                if (aIsActiveCountdown && bIsActiveCountdown) return a.targetDate - b.targetDate; 
                return 0; 
            });
        
            
            allMemories.forEach(item => {
                let card;
                
                if (item.type === 'countdown' && item.targetDate > Date.now()) {
                    card = createCountdownCard(item);
                } 
                
                else {
                    card = createMemoryCard(item);
                }
                listEl.appendChild(card);
            });
            
            
            startAllCountdownTimers();
        }

export function createMemoryCard(memory) {
            const card = document.createElement('div');
            card.className = 'memory-card';
            const memoryDate = new Date(memory.timestamp);
            const dateString = `${memoryDate.getFullYear()}-${String(memoryDate.getMonth() + 1).padStart(2, '0')}-${String(memoryDate.getDate()).padStart(2, '0')} ${String(memoryDate.getHours()).padStart(2, '0')}:${String(memoryDate.getMinutes()).padStart(2, '0')}`;
            
            let titleHtml, contentHtml;
        
            if (memory.type === 'countdown' && memory.targetDate) {
                titleHtml = `[约定达成] ${memory.description}`;
                
                contentHtml = parseMarkdown(`在 ${new Date(memory.targetDate).toLocaleString()}，我们一起见证了这个约定。`).replace(/\n/g, '<br>');
            } else {
                let authorDisplayName = '我们的回忆';
                if (memory.authorId) {
                    const authorChat = runtime.state.chats[memory.authorId];
                    if (authorChat) {
                        authorDisplayName = authorChat.name; 
                    } else {
                        authorDisplayName = memory.authorName || '一位朋友'; 
                    }
                } else if (memory.authorName) {
                    authorDisplayName = memory.authorName; 
                }
        
                titleHtml = `${authorDisplayName} 的日记`;
                
                contentHtml = parseMarkdown(memory.description);
            }
        
            card.innerHTML = `
                <div class="header">
                    <div class="date">${dateString}</div>
                    <div class="author">${titleHtml}</div>
                </div>
                <div class="content">${contentHtml}</div>
            `;
            addLongPressListener(card, async () => {
                const confirmed = await showCustomConfirm("Delete Record", "Delete this entry?", { confirmButtonClass: 'btn-danger' });
                if (confirmed) {
                    await runtime.db.memories.delete(memory.id);
                    renderMemoriesScreen();
                }
            });
            return card;
        }

export async function openClearPostsSelectorModal() {
    const modal = document.getElementById('clear-posts-modal');
    const listEl = document.getElementById('clear-posts-list');
    listEl.innerHTML = ''; 

    
    const options = [];

 
    options.push({ text: '清空所有动态 (危险)', value: 'all', isDanger: true });

    
    const myNickname = runtime.state.qzoneSettings.nickname || '我';
    options.push({ text: `仅清空 ${myNickname} 的动态 (用户)`, value: 'user' });

   
    Object.values(runtime.state.chats).forEach(chat => {
        if (!chat.isGroup) {
            options.push({ text: `仅清空 ${chat.name} 的动态 (角色)`, value: chat.id });
        }
    });
    

    try {
        const npcs = await runtime.db.npcs.toArray();
        if (npcs.length > 0) {
           
            options.push({ isSeparator: true, text: "NPC List" });
            
            npcs.forEach(npc => {
                options.push({
                    text: `仅清空 ${npc.name} 的动态 (NPC)`,
    
                    value: `npc_${npc.id}` 
                });
            });
        }
    } catch (e) {
        console.error("加载NPC列表失败:", e);
    }
  

 
    options.forEach(opt => {
      
        if (opt.isSeparator) {
            const separator = document.createElement('div');
            separator.textContent = opt.text;
            separator.style.cssText = `
                padding: 10px 18px 5px;
                font-size: 13px;
                font-weight: 500;
                color: var(--text-secondary);
                background-color: #f0f2f5;
                border-top: 1px solid var(--border-color);
                border-bottom: 1px solid var(--border-color);
                margin-top: 5px;
            `;
            listEl.appendChild(separator);
            return; 
        }
        
     
        const item = document.createElement('div');
        item.className = 'clear-posts-item';
        if (opt.isDanger) {
            item.classList.add('danger-option');
        }
        item.dataset.targetId = opt.value;
        item.innerHTML = `
            <div class="checkbox"></div>
            <span class="name">${opt.text}</span>
        `;
        listEl.appendChild(item);
    });
    
 
    modal.classList.add('visible');
}

export async function handleConfirmClearPosts() {
    const selectedItems = document.querySelectorAll('#clear-posts-list .clear-posts-item.selected');
    if (selectedItems.length === 0) {
        alert("Select at least one type of post to clear.");
        return;
    }

    const targetIds = Array.from(selectedItems).map(item => item.dataset.targetId);
    
 
    let targetNames = [];
    if (targetIds.includes('all')) {
        targetNames.push('所有动态');
    } else {
        if (targetIds.includes('user')) {
            targetNames.push(`“${runtime.state.qzoneSettings.nickname}”`);
        }
        targetIds.forEach(id => {
            const character = runtime.state.chats[id];
            if (character) {
                targetNames.push(`“${character.name}”`);
            }
        });
    }
    const confirmMessage = `此操作将永久删除 ${targetNames.join('、 ')} 的所有动态，且无法恢复！`;

    const confirmed = await showCustomConfirm(
        "Clear Posts?",
        confirmMessage,
        { confirmButtonClass: 'btn-danger', confirmText: "Confirm Clear" }
    );

    if (!confirmed) return;

    try {
        if (targetIds.includes('all')) {
            await runtime.db.qzonePosts.clear();
        } else {
          
            await runtime.db.qzonePosts.where('authorId').anyOf(targetIds).delete();
        }

      
        runtime.qzonePostsCache = await runtime.db.qzonePosts.orderBy('timestamp').reverse().toArray();
        runtime.qzonePostsRenderCount = 0;
        await renderQzonePosts();
        
        document.getElementById('clear-posts-modal').classList.remove('visible'); // 关闭选择器
        await showCustomAlert("Complete", "The selected posts were cleared.");

    } catch (error) {
        console.error("清空动态时出错:", error);
        await showCustomAlert("Operation Failed", `Could not clear posts: ${error.message}`);
    }
}
