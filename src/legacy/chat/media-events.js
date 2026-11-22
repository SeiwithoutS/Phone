import { renderAlbumList } from '../album/album.js'
import { showCustomPrompt } from '../dialogs/dialogs.js'
import { renderQzonePosts, resetCreatePostModal } from '../qzone/feed.js'
import { controls } from '../runtime/state.js'
import { runtime } from '../runtime/state.js'

export function bindChatMediaEvents() {
  document.getElementById('create-album-btn-page').addEventListener('click', async () => { const albumName = await showCustomPrompt("Create Album", "Enter an album name"); if (albumName && albumName.trim()) { const newAlbum = { name: albumName.trim(), coverUrl: 'https://i.postimg.cc/pT2xKzPz/album-cover-placeholder.png', photoCount: 0, createdAt: Date.now() }; await runtime.db.qzoneAlbums.add(newAlbum); await renderAlbumList(); alert(`Album “${albumName}” created.`); } else if (albumName !== null) { alert("Enter an album name."); } });

document.getElementById('cancel-create-post-btn').addEventListener('click', () => document.getElementById('create-post-modal').classList.remove('visible'));

document.getElementById('post-upload-local-btn').addEventListener('click', () => document.getElementById('post-local-image-input').click());

document.getElementById('post-local-image-input').addEventListener('change', (event) => { const file = event.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => { document.getElementById('post-image-preview').src = e.target.result; document.getElementById('post-image-preview-container').classList.add('visible'); document.getElementById('post-image-desc-group').style.display = 'block'; }; reader.readAsDataURL(file); } });

document.getElementById('post-use-url-btn').addEventListener('click', async () => { const url = await showCustomPrompt("Image URL", "Enter an image URL", "", "url"); if (url) { document.getElementById('post-image-preview').src = url; document.getElementById('post-image-preview-container').classList.add('visible'); document.getElementById('post-image-desc-group').style.display = 'block'; } });

document.getElementById('post-remove-image-btn').addEventListener('click', () => resetCreatePostModal());

controls.imageModeBtn = document.getElementById('switch-to-image-mode')

controls.textImageModeBtn = document.getElementById('switch-to-text-image-mode')

controls.imageModeContent = document.getElementById('image-mode-content')

controls.textImageModeContent = document.getElementById('text-image-mode-content')

controls.imageModeBtn.addEventListener('click', () => { controls.imageModeBtn.classList.add('active'); controls.textImageModeBtn.classList.remove('active'); controls.imageModeContent.classList.add('active'); controls.textImageModeContent.classList.remove('active'); });

controls.textImageModeBtn.addEventListener('click', () => { controls.textImageModeBtn.classList.add('active'); controls.imageModeBtn.classList.remove('active'); controls.textImageModeContent.classList.add('active'); controls.imageModeContent.classList.remove('active'); });

document.getElementById('confirm-create-post-btn').addEventListener('click', async () => {
            const modal = document.getElementById('create-post-modal');
            const mode = modal.dataset.mode;
            
            
            const visibilityMode = document.querySelector('input[name="visibility"]:checked').value;
            let visibleGroupIds = null;
            
            if (visibilityMode === 'include') {
                visibleGroupIds = Array.from(document.querySelectorAll('input[name="visibility_group"]:checked')).map(cb => parseInt(cb.value));
            }
        
            let newPost = {};
            const basePostData = {
                timestamp: Date.now(),
                authorId: 'user',
                
                visibleGroupIds: visibleGroupIds,
            };
        
            
            if (mode === 'shuoshuo') {
                const content = document.getElementById('post-public-text').value.trim();
                if (!content) {
                    alert("Write something for this post.");
                    return;
                }
                newPost = {
                    ...basePostData,
                    type: 'shuoshuo',
                    content: content,
                };
        
            } else { 
                const publicText = document.getElementById('post-public-text').value.trim();
                const isImageModeActive = document.getElementById('image-mode-content').classList.contains('active');
        
                if (isImageModeActive) {
                    const imageUrl = document.getElementById('post-image-preview').src;
                    const imageDescription = document.getElementById('post-image-description').value.trim();
                    if (!imageUrl || !(imageUrl.startsWith('http') || imageUrl.startsWith('data:'))) {
                        alert("Add a photo before publishing.");
                        return;
                    }
                    if (!imageDescription) {
                        alert("Describe the image for the AI.");
                        return;
                    }
                    newPost = {
                        ...basePostData,
                        type: 'image_post',
                        publicText: publicText,
                        imageUrl: imageUrl,
                        imageDescription: imageDescription,
                    };
                } else { 
                    const hiddenText = document.getElementById('post-hidden-text').value.trim();
                    if (!hiddenText) {
                        alert("Enter a text image description.");
                        return;
                    }
                    newPost = {
                        ...basePostData,
                        type: 'text_image',
                        publicText: publicText,
                        hiddenContent: hiddenText,
                    };
                }
            }
        
            
            const newPostId = await runtime.db.qzonePosts.add(newPost);
            let postSummary = newPost.content || newPost.publicText || newPost.imageDescription || newPost.hiddenContent || "（无文字内容）";
            postSummary = postSummary.substring(0, 50) + (postSummary.length > 50 ? '...' : '');
        
            
            for (const chatId in runtime.state.chats) {
                const chat = runtime.state.chats[chatId];
                if (chat.isGroup) continue; 
        
                let shouldNotify = false;
                const postVisibleGroups = newPost.visibleGroupIds;
        
                
                if (!postVisibleGroups || postVisibleGroups.length === 0) {
                    shouldNotify = true;
                } 
                
                else if (chat.groupId && postVisibleGroups.includes(chat.groupId)) {
                    shouldNotify = true;
                }
        
                
                if (shouldNotify) {
        
        const historyMessage = {
            role: 'system',
            content: `[系统提示：用户刚刚发布了一条动态(ID: ${newPostId})，内容摘要是：“${postSummary}”。请你【结合自己的角色设定、世界观和你们的最近聊天内容】，对这条动态发表一条自然的评论。]`,
            timestamp: Date.now(),
            isHidden: true
        };
        
                    chat.history.push(historyMessage);
                    await runtime.db.chats.put(chat);
                }
            }
            
        
            await renderQzonePosts();
            modal.classList.remove('visible');
            alert("Post published.");
        });
}
