import { maySendImages } from '../../features/api/image-input'
import { runtime } from '../runtime/state.js'
import { showCustomConfirm, showCustomAlert, showCustomPrompt } from '../dialogs/dialogs.js'
import { requestContextCompletion } from '../../features/api/completion'
import { getGeminiResponseText } from '../api/client.js'
import { handleIconChange } from '../appearance/icons.js'

export async function handleLocalGroupAvatarUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
        
            
            const base64Url = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        
            
            await showCustomAlert("Please wait…", "Asking the AI to name the group avatar…");
        
            try {
                
                const description = maySendImages()
                    ? await getAvatarDescriptionFromApi(base64Url)
                    : (await showCustomPrompt("Name Avatar", "Enter a name for this group avatar"))?.trim();
                if (!description) return;
        
                
                const chat = runtime.state.chats[runtime.state.activeChatId];
                if (!chat.settings.groupAvatarLibrary) {
                    chat.settings.groupAvatarLibrary = [];
                }
                chat.settings.groupAvatarLibrary.push({ name: description, url: base64Url });
                
                
                await runtime.db.chats.put(chat);
                renderGroupAvatarLibrary();
                await showCustomAlert("Upload Complete", `Saved the group avatar “${description}”.`);
        
            } catch (error) {
                console.error("本地群头像上传及识别失败:", error);
                await showCustomAlert("Operation Failed", `Could not name the avatar. Check that the API connection supports vision. Error: ${error.message}`);
            } finally {
                
                event.target.value = null;
            }
        }

export async function handleLocalAvatarUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
        
            
            const base64Url = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        
            
            await showCustomAlert("Please wait…", "Asking the AI to name the avatar…");
        
            try {
                
                const description = maySendImages()
                    ? await getAvatarDescriptionFromApi(base64Url)
                    : (await showCustomPrompt("Name Avatar", "Enter a name for this avatar"))?.trim();
                if (!description) return;
        
                
                const chat = runtime.state.chats[runtime.state.activeChatId];
                if (!chat.settings.aiAvatarLibrary) {
                    chat.settings.aiAvatarLibrary = [];
                }
                chat.settings.aiAvatarLibrary.push({ name: description, url: base64Url });
                
                
                await runtime.db.chats.put(chat);
                renderAiAvatarLibrary();
                await showCustomAlert("Upload Complete", `Saved the avatar “${description}”.`);
        
            } catch (error) {
                console.error("本地头像上传及识别失败:", error);
                await showCustomAlert("Operation Failed", `Could not name the avatar. Check that the API connection supports vision. Error: ${error.message}`);
            } finally {
                
                event.target.value = null;
            }
        }

export async function getAvatarDescriptionFromApi(base64Url) {
            if (!maySendImages()) throw new Error("Enable image input in API Connections to use AI vision.");
            
            const prompt = "请为这张图片起一个简洁的、适合作为头像库标签的名字。例如：“微笑自拍”、“阳光下的猫咪”、“蓝发动漫少女”。请直接回答名字，不要加任何多余的解释。";
            
            const response = await requestContextCompletion(undefined, { instructions: '', standalone: true,
                task: 'Avatar description', scope: 'avatar', request: [{ role: 'user', content: [
                    { type: 'text', text: prompt }, { type: 'image_url', image_url: { url: base64Url } },
                ] }] });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API 错误: ${errorData.error.message}`);
            }
        
            const data = await response.json();
            let description = getGeminiResponseText(data);
            
            
            return description.trim().replace(/["'“”‘’]/g, '');
        }

export async function addAvatarToLibraryFromURL() {
            const name = await showCustomPrompt("Add Avatar", "Enter a name for this avatar");
            if (!name || !name.trim()) return;
        
            const url = await showCustomPrompt("Add Avatar", "Enter the avatar image URL", "", "url");
            if (!url || !url.trim().startsWith('http')) {
                alert("Enter a valid image URL.");
                return;
            }
            
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat.settings.aiAvatarLibrary) {
                chat.settings.aiAvatarLibrary = [];
            }
        
            chat.settings.aiAvatarLibrary.push({ name: name.trim(), url: url.trim() });
            await runtime.db.chats.put(chat);
            renderAiAvatarLibrary();
        }

export function closeAiAvatarLibraryModal() {
            document.getElementById('ai-avatar-library-modal').classList.remove('visible');
        }

export function openMyAvatarLibraryModal() {
            if (!runtime.state.activeChatId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            document.getElementById('my-avatar-library-title').textContent = `Avatar Library for “${chat.settings.myNickname || 'Me'}”`;
            renderMyAvatarLibrary();
            document.getElementById('my-avatar-library-modal').classList.add('visible');
        }

export function renderMyAvatarLibrary() {
    const grid = document.getElementById('my-avatar-library-grid');
    grid.innerHTML = '';
    const chat = runtime.state.chats[runtime.state.activeChatId];
    const library = chat.settings.myAvatarLibrary || [];

    if (library.length === 0) {
        grid.innerHTML = "<p style=\"color: var(--text-secondary); grid-column: 1 / -1; text-align: center;\">Use Add to create the first avatar.</p>";
        return;
    }

    library.forEach((avatar, index) => {
        const item = document.createElement('div');
        item.className = 'sticker-item';
        item.title = avatar.name;

        
        item.innerHTML = `
            <div class="sticker-image-container" style="background-image: url(${avatar.url});"></div>
            <span class="sticker-name">${avatar.name}</span>
        `;
        

        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            const confirmed = await showCustomConfirm("Delete Avatar", `Remove “${avatar.name}” from your avatar library?`, { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                chat.settings.myAvatarLibrary.splice(index, 1);
                await runtime.db.chats.put(chat);
                renderMyAvatarLibrary();
            }
        };
        item.appendChild(deleteBtn);
        grid.appendChild(item);
    });
}

export async function addAvatarToMyLibraryFromURL() {
            const name = await showCustomPrompt("Add Avatar", "Enter a name for this avatar");
            if (!name || !name.trim()) return;
        
            const url = await showCustomPrompt("Add Avatar", "Enter the avatar image URL", "", "url");
            if (!url || !url.trim().startsWith('http')) {
                alert("Enter a valid image URL.");
                return;
            }
            
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat.settings.myAvatarLibrary) {
                chat.settings.myAvatarLibrary = [];
            }
        
            chat.settings.myAvatarLibrary.push({ name: name.trim(), url: url.trim() });
            await runtime.db.chats.put(chat);
            renderMyAvatarLibrary();
        }

export async function handleLocalMyAvatarUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
        
            const base64Url = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        
            const name = await showCustomPrompt("Name Avatar", "Enter a name for the new avatar");
            if (!name || !name.trim()) return;
        
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat.settings.myAvatarLibrary) {
                chat.settings.myAvatarLibrary = [];
            }
            chat.settings.myAvatarLibrary.push({ name: name.trim(), url: base64Url });
            
            await runtime.db.chats.put(chat);
            renderMyAvatarLibrary();
            event.target.value = null; 
        }

export async function handleBatchImportForMyAvatar(text) {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat) return;
        
            const lines = text.trim().split('\n');
            const newAvatars = [];
            const baseUrl = 'https://files.catbox.moe/';
            let errorCount = 0;
        
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.includes('http') || trimmedLine.includes('填入')) continue;
                
                let name = null, code = null;
                const noSpaceMatch = trimmedLine.match(/^([\u4e00-\u9fa5]+)([a-zA-Z0-9]+\..+)$/);
                
                if (noSpaceMatch) {
                    name = noSpaceMatch[1];
                    code = noSpaceMatch[2];
                } else {
                    const parts = trimmedLine.split(/\s+/);
                    if (parts.length >= 2) {
                        code = parts.pop();
                        name = parts.join(' ');
                    }
                }
        
                if (name && code && code.includes('.')) {
                    newAvatars.push({ name: name, url: baseUrl + code });
                } else {
                    errorCount++;
                }
            }
        
            if (errorCount > 0) await showCustomAlert("Partial Import", `Skipped ${errorCount} invalid lines.`);
            
            if (newAvatars.length > 0) {
                if (!chat.settings.myAvatarLibrary) chat.settings.myAvatarLibrary = [];
                chat.settings.myAvatarLibrary.push(...newAvatars);
                await runtime.db.chats.put(chat);
                renderMyAvatarLibrary();
                await showCustomAlert("Import Complete", `Imported ${newAvatars.length} avatars.`);
            } else if (errorCount === 0) {
                alert("No items to import.");
            }
        }

export function closeMyAvatarLibraryModal() {
            document.getElementById('my-avatar-library-modal').classList.remove('visible');
        }

export function openGroupAvatarLibraryModal() {
            if (!runtime.state.activeChatId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            document.getElementById('group-avatar-library-title').textContent = `Avatar Library for “${chat.name}”`;
            renderGroupAvatarLibrary();
            document.getElementById('group-avatar-library-modal').classList.add('visible');
        }

export function renderGroupAvatarLibrary() {
    const grid = document.getElementById('group-avatar-library-grid');
    grid.innerHTML = '';
    const chat = runtime.state.chats[runtime.state.activeChatId];
    const library = chat.settings.groupAvatarLibrary || [];

    if (library.length === 0) {
        grid.innerHTML = "<p style=\"color: var(--text-secondary); grid-column: 1 / -1; text-align: center;\">Use Add to create the first avatar.</p>";
        return;
    }

    library.forEach((avatar, index) => {
        const item = document.createElement('div');
        item.className = 'sticker-item';
        item.title = avatar.name;

        
        item.innerHTML = `
            <div class="sticker-image-container" style="background-image: url(${avatar.url});"></div>
            <span class="sticker-name">${avatar.name}</span>
        `;
        

        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            const confirmed = await showCustomConfirm("Delete Avatar", `Remove “${avatar.name}” from the avatar library?`, { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                chat.settings.groupAvatarLibrary.splice(index, 1);
                await runtime.db.chats.put(chat);
                renderGroupAvatarLibrary();
            }
        };
        item.appendChild(deleteBtn);
        grid.appendChild(item);
    });
}

export async function addAvatarToGroupLibraryFromUR() {
            const name = await showCustomPrompt("Add Avatar", "Enter a name for this avatar");
            if (!name || !name.trim()) return;
        
            const url = await showCustomPrompt("Add Avatar", "Enter the avatar image URL", "", "url");
            if (!url || !url.trim().startsWith('http')) {
                alert("Enter a valid image URL.");
                return;
            }
            
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat.settings.groupAvatarLibrary) {
                chat.settings.groupAvatarLibrary = [];
            }
        
            chat.settings.groupAvatarLibrary.push({ name: name.trim(), url: url.trim() });
            await runtime.db.chats.put(chat);
            renderGroupAvatarLibrary();
        }

export function closeGroupAvatarLibraryModal() {
            document.getElementById('group-avatar-library-modal').classList.remove('visible');
        }

export async function openBatchImportModal(type) {
            const placeholderText = `请按照以下格式粘贴，一行一个：\n\n焦虑 2a9wte.jpeg\n大惊失色 or8qf4.png\n没有灵感 njwujh.jpeg`;
            
            
            const pastedText = await showCustomPrompt(
                "Batch Import Avatars",
                placeholderText,
                '',
                'textarea' 
            );
        
            
            if (pastedText && pastedText.trim()) {
                await handleBatchImport(type, pastedText);
            }
        }

export async function handleBatchImport(type, text) {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat) return;
        
            const lines = text.trim().split('\n');
            const newAvatars = [];
            const baseUrl = 'https://files.catbox.moe/';
            let errorCount = 0;
        
            for (const line of lines) {
                const trimmedLine = line.trim();
        
                if (!trimmedLine || trimmedLine.includes('http') || trimmedLine.includes('填入')) {
                    continue; 
                }
        
                let name = null;
                let code = null;
        
                
                
                
                
        
                
                const noSpaceMatch = trimmedLine.match(/^([\u4e00-\u9fa5]+)([a-zA-Z0-9]+\..+)$/);
                
                if (noSpaceMatch) {
                    
                    name = noSpaceMatch[1];
                    code = noSpaceMatch[2];
                } else {
                    
                    const parts = trimmedLine.split(/\s+/);
                    if (parts.length >= 2) {
                        code = parts.pop();
                        name = parts.join(' ');
                    }
                }
        
                
                if (name && code && code.includes('.')) {
                    newAvatars.push({
                        name: name,
                        url: baseUrl + code
                    });
                } else {
                    errorCount++;
                    console.warn('批量导入格式错误，已跳过此行:', trimmedLine);
                }
            }
        
            if (errorCount > 0) {
                await showCustomAlert("Partial Import", `Skipped ${errorCount} invalid lines.`);
            }
        
            if (newAvatars.length > 0) {
                if (type === 'ai') {
                    if (!chat.settings.aiAvatarLibrary) chat.settings.aiAvatarLibrary = [];
                    chat.settings.aiAvatarLibrary.push(...newAvatars);
                    await runtime.db.chats.put(chat);
                    renderAiAvatarLibrary();
                } else if (type === 'group') {
                    if (!chat.settings.groupAvatarLibrary) chat.settings.groupAvatarLibrary = [];
                    chat.settings.groupAvatarLibrary.push(...newAvatars);
                    await runtime.db.chats.put(chat);
                    renderGroupAvatarLibrary();
                }
                await showCustomAlert("Import Complete", `Imported ${newAvatars.length} avatars.`);
            } else if (errorCount === 0) {
                alert("No items to import. Check the format of the pasted text.");
            }
        }

export async function addAvatarToGroupLibraryFromURL() {
            const name = await showCustomPrompt("Add Avatar", "Enter a name for this avatar");
            if (!name || !name.trim()) return;
        
            const url = await showCustomPrompt("Add Avatar", "Enter the avatar image URL", "", "url");
            if (!url || !url.trim().startsWith('http')) {
                alert("Enter a valid image URL.");
                return;
            }
            
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat.settings.groupAvatarLibrary) {
                chat.settings.groupAvatarLibrary = [];
            }
        
            chat.settings.groupAvatarLibrary.push({ name: name.trim(), url: url.trim() });
            await runtime.db.chats.put(chat);
            renderGroupAvatarLibrary();
        }

export function openAiAvatarLibraryModal() {
            if (!runtime.state.activeChatId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            document.getElementById('ai-avatar-library-title').textContent = `Avatar Library for “${chat.name}”`;
            renderAiAvatarLibrary();
            document.getElementById('ai-avatar-library-modal').classList.add('visible');
        }

export function renderAiAvatarLibrary() {
    const grid = document.getElementById('ai-avatar-library-grid');
    grid.innerHTML = '';
    const chat = runtime.state.chats[runtime.state.activeChatId];
    const library = chat.settings.aiAvatarLibrary || [];

    if (library.length === 0) {
        grid.innerHTML = "<p style=\"color: var(--text-secondary); grid-column: 1 / -1; text-align: center;\">Use Add to create the first avatar.</p>";
        return;
    }

    library.forEach((avatar, index) => {
        const item = document.createElement('div');
        item.className = 'sticker-item'; 
        item.title = avatar.name;

        
        
        item.innerHTML = `
            <div class="sticker-image-container" style="background-image: url(${avatar.url});"></div>
            <span class="sticker-name">${avatar.name}</span>
        `;
        

        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            const confirmed = await showCustomConfirm("Delete Avatar", `Remove “${avatar.name}” from the avatar library?`, { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                chat.settings.aiAvatarLibrary.splice(index, 1);
                await runtime.db.chats.put(chat);
                renderAiAvatarLibrary();
            }
        };
        item.appendChild(deleteBtn);
        grid.appendChild(item);
    });
}

export function bindAvatarLibraryEvents() {
  document.getElementById('manage-ai-avatar-library-btn').addEventListener('click', openAiAvatarLibraryModal);

document.getElementById('add-ai-avatar-batch-btn').addEventListener('click', () => openBatchImportModal('ai'));

document.getElementById('add-group-avatar-batch-btn').addEventListener('click', () => openBatchImportModal('group'));

document.getElementById('add-ai-avatar-url-btn').addEventListener('click', addAvatarToLibraryFromURL);

document.getElementById('add-ai-avatar-upload-btn').addEventListener('click', () => {
            document.getElementById('ai-avatar-upload-input').click();
        });

document.getElementById('ai-avatar-upload-input').addEventListener('change', handleLocalAvatarUpload);

document.getElementById('close-ai-avatar-library-btn').addEventListener('click', closeAiAvatarLibraryModal);

document.getElementById('manage-group-avatar-library-btn').addEventListener('click', openGroupAvatarLibraryModal);

document.getElementById('add-group-avatar-url-btn').addEventListener('click', addAvatarToGroupLibraryFromURL);

document.getElementById('add-group-avatar-upload-btn').addEventListener('click', () => {
            document.getElementById('group-avatar-upload-input').click();
        });

document.getElementById('group-avatar-upload-input').addEventListener('change', handleLocalGroupAvatarUpload);

document.getElementById('close-group-avatar-library-btn').addEventListener('click', closeGroupAvatarLibraryModal);

document.getElementById('icon-settings-grid').addEventListener('click', (e) => {
    if (e.target.classList.contains('change-icon-btn')) {
        const item = e.target.closest('.icon-setting-item');
        const iconId = item.dataset.iconId;
        if (iconId) {
            handleIconChange(iconId, 'ephone', item);
        }
    }
});
}
