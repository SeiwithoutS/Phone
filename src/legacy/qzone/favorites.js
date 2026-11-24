import { escapeHtml, imageSource } from '../../runtime/files'
import { getDisplayNameByOriginalName } from '../chat/groups.js'
import { parseMarkdown } from '../rendering/markup.js'
import { runtime } from '../runtime/state.js'

export function displayFilteredFavorites(items) {
            const listEl = document.getElementById('favorites-list');
            listEl.innerHTML = '';
        
            if (items.length === 0) {
                const searchTerm = document.getElementById('favorites-search-input').value;
                const message = searchTerm ? '未找到相关收藏' : '你的收藏夹是空的，<br>快去动态或聊天中收藏喜欢的内容吧！';
                listEl.innerHTML = `<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">${message}</p>`;
                return;
            }
        
            for (const item of items) {
                const card = document.createElement('div');
                card.className = 'favorite-item-card';
                card.dataset.favid = item.id;
        
                let headerHtml = '', contentHtml = '', sourceText = '', footerHtml = '';
        
                if (item.type === 'qzone_post') {
                    const post = item.content;
                    sourceText = '来自动态';
                    let authorAvatar = runtime.defaultAvatar, authorNickname = '未知用户';
        
                    if (post.authorId === 'user') {
                        authorAvatar = runtime.state.qzoneSettings.avatar;
                        authorNickname = runtime.state.qzoneSettings.nickname;
                    } else if (runtime.state.chats[post.authorId]) {
                        authorAvatar = runtime.state.chats[post.authorId].settings.aiAvatar;
                        authorNickname = runtime.state.chats[post.authorId].name;
                    }
        
                    headerHtml = `<img src="${authorAvatar}" class="avatar"><div class="info"><div class="name">${authorNickname}</div></div>`;
                    
                    const publicTextHtml = post.publicText ? `<div class="post-content">${post.publicText.replace(/\n/g, '<br>')}</div>` : '';
                    if (post.type === 'shuoshuo') {
                        contentHtml = `<div class="post-content">${post.content.replace(/\n/g, '<br>')}</div>`;
                    } else if (post.type === 'image_post' && post.imageUrl) {
    const postImageUrl = runtime.state.globalSettings.enableAiDrawing && post.image_prompt ? `https://image.pollinations.ai/prompt/${post.image_prompt}` : 'https://i.postimg.cc/KYr2qRCK/1.jpg';
    contentHtml = publicTextHtml ? `${publicTextHtml}<div style="margin-top:10px;"><img src="${postImageUrl}" class="chat-image"></div>` : `<img src="${postImageUrl}" class="chat-image">`;
} else if (post.type === 'text_image') {
    const postImageUrl = runtime.state.globalSettings.enableAiDrawing && post.image_prompt ? `https://image.pollinations.ai/prompt/${post.image_prompt}` : 'https://i.postimg.cc/KYr2qRCK/1.jpg';
    contentHtml = publicTextHtml ? `${publicTextHtml}<div style="margin-top:10px;"><img src="${postImageUrl}" class="chat-image" style="cursor: pointer;" data-hidden-text="${post.hiddenContent}"></div>` : `<img src="${postImageUrl}" class="chat-image" style="cursor: pointer;" data-hidden-text="${post.hiddenContent}">`;
                    }
        
                    
                    
                    
                    let likesHtml = '';
                    
                    if (post.likes && post.likes.length > 0) {
                        
                        likesHtml = `
                            <div class="post-likes-section">
                                <svg class="like-icon" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                <span>${post.likes.join('、')} 觉得很赞</span>
                            </div>`;
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
                        innerCommentContent = comment.text;
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
          
        
                    
                    footerHtml = `${likesHtml}${commentsHtml}`;
                    
                    
        
        } else if (item.type === 'chat_message') {
            const msg = item.content;
            const chat = runtime.state.chats[item.chatId];
            if (!chat) continue; 
        
            sourceText = `来自与 ${chat.name} 的聊天`;
            const isUser = msg.role === 'user';
            let senderName, senderAvatar;
        
            if (isUser) {
                
                senderName = chat.isGroup ? (chat.settings.myNickname || '我') : '我';
                senderAvatar = chat.settings.myAvatar || (chat.isGroup ? runtime.defaultMyGroupAvatar : runtime.defaultAvatar);
            } else { 
                 if (chat.isGroup) {
                    
                    
                    const member = chat.members.find(m => m.originalName === msg.senderName);
                    
                    
                    senderName = msg.senderName;
                    
                    senderAvatar = member ? member.avatar : runtime.defaultGroupMemberAvatar;
                } else {
                    
                    senderName = chat.name;
                    senderAvatar = chat.settings.aiAvatar || runtime.defaultAvatar;
                }
            }
        
            
            headerHtml = `<img src="${senderAvatar}" class="avatar"><div class="info"><div class="name">${senderName}</div></div>`;
            
            if (typeof msg.content === 'string' && runtime.STICKER_REGEX.test(msg.content)) {
                contentHtml = `<img src="${msg.content}" class="sticker-image" style="max-width: 80px; max-height: 80px;">`;
            } else if (Array.isArray(msg.content) && msg.content[0]?.type === 'image_url') {
                contentHtml = `<img src="${msg.content[0].image_url.url}" class="chat-image">`;
            } else {
                contentHtml = String(msg.content || '').replace(/\n/g, '<br>');
            }
        }
                      
        else if (item.type === 'char_diary') {
            const diary = item.content;
            sourceText = `来自 ${escapeHtml(String(diary.characterName ?? ''))} 的日记`;

            const charChat = runtime.state.chats[diary.characterId];
            const authorAvatar = charChat ? charChat.settings.aiAvatar : runtime.defaultAvatar;
            
            headerHtml = `<img src="${escapeHtml(imageSource(String(authorAvatar ?? '')))}" class="avatar"><div class="info"><div class="name">${escapeHtml(String(diary.characterName ?? ''))}</div></div>`;
            
            
            const fullDiaryContent = diary.content || '';
            
            const formattedContent = parseMarkdown(escapeHtml(String(fullDiaryContent))).replace(/\n/g, '<br>');

            
            contentHtml = `
                <span class="diary-title">${escapeHtml(String(diary.title ?? ''))}</span>
                <div class="fav-card-content-full">${formattedContent}</div>
            `;
        }  
      
    else if (item.type === 'char_browser_article') {
        const article = item.content;
        sourceText = `来自 ${article.characterName} 的浏览记录`;

        const charChat = runtime.state.chats[article.characterId];
        const authorAvatar = charChat ? charChat.settings.aiAvatar : runtime.defaultAvatar;
        
        headerHtml = `<img src="${authorAvatar}" class="avatar"><div class="info"><div class="name">${article.characterName}</div></div>`;
        
        
        contentHtml = `
            <span class="diary-title">${article.title}</span>
            <div class="memo-content-preview">${(article.content || '').replace(/\n/g, '<br>')}</div>
        `;
    }

else if (item.type === 'char_memo') {
    const memo = item.content;
    sourceText = `来自 ${memo.characterName} 的备忘录`;

    const charChat = runtime.state.chats[memo.characterId];
    const authorAvatar = charChat ? charChat.settings.aiAvatar : runtime.defaultAvatar;
    
    headerHtml = `<img src="${authorAvatar}" class="avatar"><div class="info"><div class="name">${memo.characterName}</div></div>`;
    
    
    contentHtml = `
        <span class="memo-title">${memo.title}</span>
        <div class="memo-content-preview">${memo.content.replace(/\n/g, '<br>')}</div>
    `;
}

                
                card.innerHTML = `
                    <div class="fav-card-header">${headerHtml}<div class="source">${sourceText}</div></div>
                    <div class="fav-card-content">${contentHtml}</div>
                    ${footerHtml}`; 
                    
                listEl.appendChild(card);
            }
        }

export async function renderFavoritesScreen() {
                    
                    runtime.allFavoriteItems = await runtime.db.favorites.orderBy('timestamp').reverse().toArray();
                    
                    
                    const searchInput = document.getElementById('favorites-search-input');
                    const clearBtn = document.getElementById('favorites-search-clear-btn');
                    searchInput.value = '';
                    clearBtn.style.display = 'none';
        
                    
                    displayFilteredFavorites(runtime.allFavoriteItems);
                }
