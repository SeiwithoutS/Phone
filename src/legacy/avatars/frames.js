import { renderChatInterface } from '../chat/conversation.js'
import { showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'
import { controls } from '../runtime/state.js'

export async function populateFrameGrids(isForMember = false, memberAvatar = null, memberFrame = null) {
    const aiFrameGrid = document.getElementById('ai-frame-grid');
    const myFrameGrid = document.getElementById('my-frame-grid');
    const chat = runtime.state.chats[runtime.state.activeChatId];
    aiFrameGrid.innerHTML = '';
    myFrameGrid.innerHTML = '';

    
    const customFrames = await runtime.db.customAvatarFrames.toArray();
    
    const allFrames = [...runtime.avatarFrames, ...customFrames];

    document.querySelector('#avatar-frame-modal .frame-tabs').style.display = isForMember ? 'none' : 'flex';
    document.getElementById('ai-frame-content').style.display = 'block';
    document.getElementById('my-frame-content').style.display = 'none';
    document.getElementById('ai-frame-tab').classList.add('active');
    document.getElementById('my-frame-tab').classList.remove('active');

    if (isForMember) {
        allFrames.forEach(frame => {
            const item = createFrameItem(frame, 'my', memberAvatar);
            if (frame.url === memberFrame) {
                item.classList.add('selected');
            }
            aiFrameGrid.appendChild(item);
        });
    } else {
        const aiAvatarForPreview = chat.settings.aiAvatar || runtime.defaultAvatar;
        const myAvatarForPreview = chat.settings.myAvatar || (chat.isGroup ? runtime.defaultMyGroupAvatar : runtime.defaultAvatar);
        allFrames.forEach(frame => {
            const aiItem = createFrameItem(frame, 'ai', aiAvatarForPreview);
            if (frame.url === runtime.currentFrameSelection.ai) aiItem.classList.add('selected');
            aiFrameGrid.appendChild(aiItem);

            const myItem = createFrameItem(frame, 'my', myAvatarForPreview);
            if (frame.url === runtime.currentFrameSelection.my) myItem.classList.add('selected');
            myFrameGrid.appendChild(myItem);
        });
    }
}

export function createFrameItem(frame, type, previewAvatarSrc) {
    const item = document.createElement('div');
    item.className = 'frame-item';
    item.dataset.frameUrl = frame.url;
    item.title = frame.name;

    const isCustom = typeof frame.id === 'number';
    const deleteButtonHtml = isCustom ? `<button class="delete-btn" data-id="${frame.id}" style="display:block;">×</button>` : '';

    item.innerHTML = `
        ${deleteButtonHtml}
        <img src="${previewAvatarSrc}" class="preview-avatar">
        ${frame.url ? `<img src="${frame.url}" class="preview-frame">` : ''}
    `;

    
    item.addEventListener('click', (e) => {
        
        if (e.target.classList.contains('delete-btn')) {
            return;
        }

        
        if (runtime.isFrameManagementMode) {
            
            if (isCustom) {
                const frameId = parseInt(frame.id);
                item.classList.toggle('selected');
                if (runtime.selectedFrames.has(frameId)) {
                    runtime.selectedFrames.delete(frameId);
                } else {
                    runtime.selectedFrames.add(frameId);
                }
                updateDeleteFrameButton();
            }
        } else {
            
            runtime.currentFrameSelection[type] = frame.url;
            const grid = type === 'ai' ? document.getElementById('ai-frame-grid') : document.getElementById('my-frame-grid');
            grid.querySelectorAll('.frame-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
        }
    });
    
    return item;
}

export async function saveSelectedFrames() {
            if (!runtime.state.activeChatId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (runtime.editingFrameForMember) {
                const member = chat.members.find(m => m.id === runtime.editingMemberId);
                if (member) {
                    member.avatarFrame = runtime.currentFrameSelection.my;
                }
            } else {
                chat.settings.aiAvatarFrame = runtime.currentFrameSelection.ai;
                chat.settings.myAvatarFrame = runtime.currentFrameSelection.my;
            }
        
            await runtime.db.chats.put(chat);
        
            
            
            if (!runtime.editingFrameForMember && !chat.isGroup) {
                const characterId = chat.id; 
        
                
                for (const groupChat of Object.values(runtime.state.chats)) {
                    if (groupChat.isGroup && groupChat.members) {
                        
                        const memberToUpdate = groupChat.members.find(m => m.id === characterId);
        
                        
                        if (memberToUpdate) {
                            memberToUpdate.avatarFrame = chat.settings.aiAvatarFrame;
                            
                            await runtime.db.chats.put(groupChat);
                            console.log(`已同步角色 ${characterId} 的头像框到群聊 "${groupChat.name}"`);
                        }
                    }
                }
            }
            
        
            document.getElementById('avatar-frame-modal').classList.remove('visible');
            renderChatInterface(runtime.state.activeChatId);
            alert("Avatar frame saved and synced."); 
            runtime.editingFrameForMember = false;
        }

export function toggleFrameManagementMode() {
    runtime.isFrameManagementMode = !runtime.isFrameManagementMode;
    const manageBtn = document.getElementById('manage-frames-btn');
    const actionBar = document.getElementById('frame-action-bar');
    const selectAllCheckbox = document.getElementById('select-all-frames-checkbox');

    
    document.querySelectorAll('.frame-grid').forEach(grid => {
        grid.classList.toggle('management-mode', runtime.isFrameManagementMode);
    });
    
    if (runtime.isFrameManagementMode) {
        manageBtn.textContent = "Done";
        actionBar.style.display = 'flex';
        runtime.selectedFrames.clear();
        selectAllCheckbox.checked = false;
        updateDeleteFrameButton();
    } else {
        manageBtn.textContent = "Manage";
        actionBar.style.display = 'none';
        
        document.querySelectorAll('.frame-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
    }
}

export function updateDeleteFrameButton() {
    const btn = document.getElementById('delete-selected-frames-btn');
    btn.textContent = `Delete (${runtime.selectedFrames.size})`;
}

export function handleSelectAllFrames() {
    const isChecked = document.getElementById('select-all-frames-checkbox').checked;
    const visibleGrid = document.querySelector('.frame-content[style*="display: block"] .frame-grid');
    if (!visibleGrid) return;

    
    visibleGrid.querySelectorAll('.frame-item:has(.delete-btn)').forEach(item => {
        const frameId = parseInt(item.querySelector('.delete-btn').dataset.id);
        if (isNaN(frameId)) return;
        
        item.classList.toggle('selected', isChecked);
        if (isChecked) {
            runtime.selectedFrames.add(frameId);
        } else {
            runtime.selectedFrames.delete(frameId);
        }
    });
    updateDeleteFrameButton();
}

export async function executeBatchDeleteFrames() {
    if (runtime.selectedFrames.size === 0) return;
    
    const confirmed = await showCustomConfirm(
        "Confirm Delete",
        `Permanently delete ${runtime.selectedFrames.size} custom avatar frames?`,
        { confirmButtonClass: 'btn-danger' }
    );

    if (confirmed) {
        const idsToDelete = [...runtime.selectedFrames];
        await runtime.db.customAvatarFrames.bulkDelete(idsToDelete);
        
        
        toggleFrameManagementMode();
        populateFrameGrids(runtime.editingFrameForMember); 
        
        await showCustomAlert("Deleted", "The selected avatar frames were deleted.");
    }
}

export async function handleUploadFrame() {
    const fileInput = document.getElementById('custom-frame-upload-input');
    
    
    const file = await new Promise(resolve => {
        const changeHandler = (e) => {
            resolve(e.target.files[0] || null);
            fileInput.removeEventListener('change', changeHandler);
        };
        fileInput.addEventListener('change', changeHandler, { once: true });
        fileInput.click();
    });

    if (!file) return; 

    const name = await showCustomPrompt("Name Avatar Frame", "Enter a name for this avatar frame");
    if (!name || !name.trim()) return;

    
    const url = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });

    
    await runtime.db.customAvatarFrames.add({ name: name.trim(), url });
    
    populateFrameGrids(runtime.editingFrameForMember);
}

export async function handleBatchUploadFrames() {
    const placeholder = `请按照以下格式粘贴，一行一个：\n\n头像框名字1: https://.../image1.png\n头像框名字2: https://.../image2.gif`;
    const pastedText = await showCustomPrompt("Batch Import Avatar Frames", "Import a list of URLs", "", 'textarea', `<p style="font-size:12px;color:#888;">${placeholder}</p>`);

    if (!pastedText || !pastedText.trim()) return;

    const lines = pastedText.trim().split('\n');
    const newFrames = [];
    let errorCount = 0;

    for (const line of lines) {
        
        const match = line.match(/^(.+?)[:：]\s*(https?:\/\/.+)$/);
        if (match) {
            newFrames.push({
                name: match[1].trim(),
                url: match[2].trim()
            });
        } else if (line.trim()) {
            errorCount++;
        }
    }

    if (newFrames.length > 0) {
        await runtime.db.customAvatarFrames.bulkAdd(newFrames);
        populateFrameGrids(runtime.editingFrameForMember);
        await showCustomAlert("Import Complete", `Imported ${newFrames.length} avatar frames.`);
    }

    if (errorCount > 0) {
        await showCustomAlert("Partial Import", `Skipped ${errorCount} invalid lines.`);
    }
}

export async function handleDeleteCustomFrame(frameId) {
    const frame = await runtime.db.customAvatarFrames.get(frameId);
    if (!frame) return;

    const confirmed = await showCustomConfirm(
        "Confirm Delete",
        `Delete avatar frame “${frame.name}”?`,
        { confirmButtonClass: 'btn-danger' }
    );

    if (confirmed) {
        await runtime.db.customAvatarFrames.delete(frameId);
        populateFrameGrids(runtime.editingFrameForMember); 
    }
}

export function bindAvatarFrameEvents() {
  controls.frameModal = document.getElementById('avatar-frame-modal')

controls.aiFrameTab = document.getElementById('ai-frame-tab')

controls.myFrameTab = document.getElementById('my-frame-tab')

controls.aiFrameContent = document.getElementById('ai-frame-content')

controls.myFrameContent = document.getElementById('my-frame-content')

document.getElementById('save-frame-settings-btn').addEventListener('click', saveSelectedFrames);

document.getElementById('cancel-frame-settings-btn').addEventListener('click', () => {
            controls.frameModal.classList.remove('visible');
            runtime.editingFrameForMember = false; 
        });

controls.aiFrameTab.addEventListener('click', () => {
            controls.aiFrameTab.classList.add('active');
            controls.myFrameTab.classList.remove('active');
            controls.aiFrameContent.style.display = 'block';
            controls.myFrameContent.style.display = 'none';
        });

controls.myFrameTab.addEventListener('click', () => {
            controls.myFrameTab.classList.add('active');
            controls.aiFrameTab.classList.remove('active');
            controls.myFrameContent.style.display = 'block';
            controls.aiFrameContent.style.display = 'none';
        });
}
