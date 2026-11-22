import { renderStickerCategoriesInManager } from '../appearance/presets.js'
import { sendSticker } from '../chat/messages.js'
import { showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'
import { loadMoreThoughts } from '../character-phone/profile.js'
import { loadMoreMessages } from '../chat/conversation.js'
import { loadMoreQzonePosts } from '../qzone/feed.js'
import { controls } from '../runtime/state.js'

export async function renderStickerPanel(rerenderTabs = true) {
    const grid = document.getElementById('sticker-grid');
    const tabsContainer = document.getElementById('sticker-category-tabs');
    const searchInput = document.getElementById('sticker-search-input');
    const searchTerm = searchInput.value.trim().toLowerCase();

    
    if (rerenderTabs) {
        tabsContainer.innerHTML = '';
        const categories = await runtime.db.stickerCategories.toArray();
        
        tabsContainer.innerHTML += `<button class="sticker-category-tab ${runtime.activeStickerCategoryId === 'all' ? 'active' : ''}" data-category-id="all">All</button>`;
        categories.forEach(cat => {
             tabsContainer.innerHTML += `<button class="sticker-category-tab ${runtime.activeStickerCategoryId === cat.id ? 'active' : ''}" data-category-id="${cat.id}">${cat.name}</button>`;
        });
        tabsContainer.innerHTML += `<button class="sticker-category-tab ${runtime.activeStickerCategoryId === 'uncategorized' ? 'active' : ''}" data-category-id="uncategorized">Uncategorized</button>`;
    }

    
    grid.innerHTML = '';
    
    
    let stickersByCategory;
    if (runtime.activeStickerCategoryId === 'all') {
        stickersByCategory = runtime.state.userStickers;
    } else if (runtime.activeStickerCategoryId === 'uncategorized') {
        stickersByCategory = runtime.state.userStickers.filter(s => !s.categoryId);
    } else {
        stickersByCategory = runtime.state.userStickers.filter(s => s.categoryId === runtime.activeStickerCategoryId);
    }

    
    const stickersToShow = searchTerm
        ? stickersByCategory.filter(sticker => sticker.name.toLowerCase().includes(searchTerm))
        : stickersByCategory;

    
    if (stickersToShow.length === 0) {
        const message = searchTerm ? '找不到匹配的表情' : '这个分类下还没有表情哦~';
        grid.innerHTML = `<p style="text-align:center; color: var(--text-secondary); grid-column: 1 / -1; padding-top: 20px;">${message}</p>`;
        return;
    }

    stickersToShow.forEach(sticker => {
        const item = document.createElement('div');
        item.className = 'sticker-item';
        item.title = sticker.name;
        item.dataset.stickerId = sticker.id;
        item.innerHTML = `
            <div class="sticker-image-container" style="background-image: url(${sticker.url})"></div>
            <span class="sticker-name">${sticker.name}</span>
        `;
        item.addEventListener('click', () => {
            if (runtime.isStickerManagementMode) {
                handleStickerSelection(item);
            } else {
                sendSticker(sticker);
            }
        });
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            const confirmed = await showCustomConfirm("Delete Sticker", `Delete sticker “${sticker.name}”?`, { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                await runtime.db.userStickers.delete(sticker.id);
                runtime.state.userStickers = runtime.state.userStickers.filter(s => s.id !== sticker.id);
                renderStickerPanel();
            }
        };
        item.appendChild(deleteBtn);
        grid.appendChild(item);
    });
}

export function toggleStickerManagementMode() {
            runtime.isStickerManagementMode = !runtime.isStickerManagementMode;
            const grid = document.getElementById('sticker-grid');
            const manageBtn = document.getElementById('manage-stickers-btn');
            const actionBar = document.getElementById('sticker-action-bar');
            const selectAllCheckbox = document.getElementById('select-all-stickers-checkbox');
        
            grid.classList.toggle('management-mode', runtime.isStickerManagementMode);
            
            if (runtime.isStickerManagementMode) {
                manageBtn.textContent = "Done";
                actionBar.style.display = 'flex'; 
                runtime.selectedStickers.clear();
                selectAllCheckbox.checked = false; 
                updateDeleteStickerButton();
            } else {
                manageBtn.textContent = "Manage";
                actionBar.style.display = 'none';
                grid.querySelectorAll('.sticker-item.selected').forEach(item => item.classList.remove('selected'));
            }
        }

export function handleSelectAllStickers() {
            const checkbox = document.getElementById('select-all-stickers-checkbox');
            const shouldSelect = checkbox.checked;
        
            
            let stickersToSelect;
            if (runtime.activeStickerCategoryId === 'all') {
                stickersToSelect = runtime.state.userStickers;
            } else if (runtime.activeStickerCategoryId === 'uncategorized') {
                stickersToSelect = runtime.state.userStickers.filter(s => !s.categoryId);
            } else {
                stickersToSelect = runtime.state.userStickers.filter(s => s.categoryId === runtime.activeStickerCategoryId);
            }
        
            
            stickersToSelect.forEach(sticker => {
                const stickerId = sticker.id;
                const itemEl = document.querySelector(`.sticker-item[data-sticker-id="${stickerId}"]`);
                
                if (shouldSelect) {
                    
                    runtime.selectedStickers.add(stickerId);
                    if (itemEl) itemEl.classList.add('selected');
                } else {
                    
                    runtime.selectedStickers.delete(stickerId);
                    if (itemEl) itemEl.classList.remove('selected');
                }
            });
        
            
            updateDeleteStickerButton();
        }

export function updateDeleteStickerButton() {
            const btn = document.getElementById('delete-selected-stickers-btn');
            btn.textContent = `Delete (${runtime.selectedStickers.size})`;
        }

export function handleStickerSelection(item) {
            if (!runtime.isStickerManagementMode) return; 
        
            const stickerId = item.dataset.stickerId;
            if (!stickerId) return;
        
            item.classList.toggle('selected');
        
            if (runtime.selectedStickers.has(stickerId)) {
                runtime.selectedStickers.delete(stickerId);
            } else {
                runtime.selectedStickers.add(stickerId);
            }
            updateDeleteStickerButton();
        }

export async function executeBatchDeleteStickers() {
            if (runtime.selectedStickers.size === 0) return;
            
            const confirmed = await showCustomConfirm(
                "Confirm Delete",
                `Permanently delete ${runtime.selectedStickers.size} selected stickers?`,
                { confirmButtonClass: 'btn-danger' }
            );
        
            if (confirmed) {
                const idsToDelete = [...runtime.selectedStickers];
                
                
                await runtime.db.userStickers.bulkDelete(idsToDelete);
                
                
                runtime.state.userStickers = runtime.state.userStickers.filter(s => !idsToDelete.includes(s.id));
                
                
                toggleStickerManagementMode();
                renderStickerPanel();
                
                await showCustomAlert("Deleted", "Selected stickers deleted.");
            }
        }

export async function openBatchStickerImportModal() {
            const placeholderText = `请按照以下通用格式粘贴，一行一个：\n\n开心: https://.../happy.gif\n哭泣: https://.../cry.png\n\n`;
            
            const pastedText = await showCustomPrompt(
                "Batch Import Stickers",
                placeholderText,
                '',
                'textarea'
            );
        
            if (pastedText && pastedText.trim()) {
                await handleBatchStickerImport(pastedText);
            }
        }

export async function handleBatchStickerImport(text) {
            const lines = text.trim().split('\n');
            const newStickers = [];
            const baseUrl = 'https://files.catbox.moe/';
            let errorCount = 0;
            const currentCategoryId = (runtime.activeStickerCategoryId !== 'all' && runtime.activeStickerCategoryId !== 'uncategorized') ? runtime.activeStickerCategoryId : null;

            for (const line of lines) {
                const trimmedLine = line.trim();

                
                
                if (!trimmedLine || trimmedLine.includes('填入')) {
                    continue;
                }
                

                
                const fullUrlMatch = trimmedLine.match(/^(.+?)[:：]\s*(https?:\/\/.+)$/);
                
                if (fullUrlMatch) {
                    const name = fullUrlMatch[1].trim();
                    const url = fullUrlMatch[2].trim();
                    newStickers.push({
                        id: 'sticker_' + Date.now() + Math.random(),
                        name: name,
                        url: url,
                        categoryId: currentCategoryId
                    });
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
                    newStickers.push({
                        id: 'sticker_' + Date.now() + Math.random(),
                        name: name,
                        url: baseUrl + code,
                        categoryId: currentCategoryId
                    });
                } else {
                    errorCount++;
                    console.warn('批量导入格式错误，已跳过此行:', trimmedLine);
                }
            }

            if (errorCount > 0) {
                await showCustomAlert("Partial Import", `Skipped ${errorCount} invalid lines.`);
            }

            if (newStickers.length > 0) {
                await runtime.db.userStickers.bulkAdd(newStickers);
                runtime.state.userStickers.push(...newStickers);
                renderStickerPanel();
                await showCustomAlert("Import Complete", `Imported ${newStickers.length} new stickers.`);
            } else if (errorCount === 0) {
                alert("No items to import. Check the format of the pasted text.");
            }
        }

export async function addNewStickerCategory() {
            const input = document.getElementById('new-sticker-category-name-input');
            const name = input.value.trim();
            if (!name) {
                alert("Enter a category name.");
                return;
            }
            const existing = await runtime.db.stickerCategories.where('name').equals(name).first();
            if (existing) {
                alert(`The category “${name}” already exists.`);
                return;
            }
            await runtime.db.stickerCategories.add({ name });
            input.value = '';
            await renderStickerCategoriesInManager();
        }

export async function deleteStickerCategory(categoryId) {
            const category = await runtime.db.stickerCategories.get(categoryId);
            if (!category) return;

            const stickersInCateogry = await runtime.db.userStickers.where('categoryId').equals(categoryId).count();
            
            const confirmMessage = stickersInCateogry > 0 
                ? `确定要删除分类《${category.name}》吗？\n\n【【【警告】】】\n此操作将同时永久删除该分类下的 ${stickersInCateogry} 个表情包，且无法恢复！`
                : `确定要删除分类《${category.name}》吗？`;

            const confirmed = await showCustomConfirm(
                "Delete Category", 
                confirmMessage, 
                { confirmButtonClass: 'btn-danger' }
            );

            if (confirmed) {
                try {
                    
                    await runtime.db.transaction('rw', runtime.db.stickerCategories, runtime.db.userStickers, async tx => {
                        
                        const stickerIdsToDelete = await tx.userStickers.where('categoryId').equals(categoryId).primaryKeys();
                        
                        
                        if (stickerIdsToDelete.length > 0) {
                            await tx.userStickers.bulkDelete(stickerIdsToDelete);
                        }

                        
                        await tx.stickerCategories.delete(categoryId);
                    });

                    
                    runtime.state.userStickers = await runtime.db.userStickers.toArray();
                    if (runtime.activeStickerCategoryId === categoryId) {
                        runtime.activeStickerCategoryId = 'all'; 
                    }
                    await renderStickerCategoriesInManager(); 
                    await renderStickerPanel(); 
                    
                    alert(`Deleted “${category.name}” and its stickers.`);

                } catch (error) {
                    console.error("删除分类及表情时出错:", error);
                    alert("Deletion failed.");
                }
            }
        }

export function switchStickerCategory(categoryId) {
            runtime.activeStickerCategoryId = categoryId;
            document.querySelectorAll('.sticker-category-tab').forEach(tab => {
                tab.classList.toggle('active', String(tab.dataset.categoryId) === String(categoryId));
            });
            renderStickerPanel(false);
            
            
            const selectAllCheckbox = document.getElementById('select-all-stickers-checkbox');
            if(selectAllCheckbox) selectAllCheckbox.checked = false;
        }

export async function openStickerCategoryBindingModal(categoryId) {
    const category = categoryId === 'uncategorized'
        ? { id: 'uncategorized', name: '未分类' }
        : await runtime.db.stickerCategories.get(categoryId);

    if (!category) {
        console.error("无法为不存在的分类打开绑定模态框:", categoryId);
        return;
    }

    const modal = document.getElementById('sticker-binding-modal');
    const listEl = document.getElementById('sticker-binding-chat-list');
    const header = modal.querySelector('.modal-header span');
    listEl.innerHTML = '';
    header.textContent = `Link Category “${category.name}” to…`;

    const allChats = Object.values(runtime.state.chats).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    allChats.forEach(chat => {

        const isChecked = Array.isArray(chat.settings?.stickerCategoryIds) && chat.settings.stickerCategoryIds.includes(categoryId);
      
        const item = document.createElement('div');
        item.className = 'contact-picker-item'; // 复用现有样式
        item.innerHTML = `
            <input type="checkbox" class="sticker-binding-checkbox" data-chat-id="${chat.id}" ${isChecked ? 'checked' : ''} style="margin-right: 15px;">
            <img src="${chat.isGroup ? chat.settings.groupAvatar : chat.settings.aiAvatar || runtime.defaultAvatar}" class="avatar">
            <span class="name">${chat.name}</span>
        `;
        listEl.appendChild(item);
    });


    document.getElementById('save-sticker-binding-btn').onclick = () => saveStickerCategoryBindings(categoryId);
    document.getElementById('cancel-sticker-binding-btn').onclick = () => modal.classList.remove('visible');

    modal.classList.add('visible');
}

export async function saveStickerCategoryBindings(categoryId) {
    const selectedChatIds = new Set(
        Array.from(document.querySelectorAll('#sticker-binding-chat-list .sticker-binding-checkbox:checked'))
             .map(cb => cb.dataset.chatId)
    );

    const chatsToUpdate = [];
    for (const chatId in runtime.state.chats) {
        const chat = runtime.state.chats[chatId];
if (!Array.isArray(chat.settings.stickerCategoryIds)) {
            chat.settings.stickerCategoryIds = [];
        }

        // V-Change: 检查数组中是否已包含
        const wasBound = chat.settings.stickerCategoryIds.includes(categoryId);
        const shouldBeBound = selectedChatIds.has(chatId);

        if (wasBound && !shouldBeBound) {
            // V-Change: 从数组中移除
            chat.settings.stickerCategoryIds = chat.settings.stickerCategoryIds.filter(id => id !== categoryId);
            chatsToUpdate.push(chat);
        } else if (!wasBound && shouldBeBound) {
            // V-Change: 向数组中添加
            chat.settings.stickerCategoryIds.push(categoryId);
            chatsToUpdate.push(chat);
        }
    }

    if (chatsToUpdate.length > 0) {
        await runtime.db.chats.bulkPut(chatsToUpdate);
        await showCustomAlert("Saved", "Sticker category links updated.");
    }

    document.getElementById('sticker-binding-modal').classList.remove('visible');
}

export function getStickerContextForPrompt(chat) {
if (!chat || !chat.settings.stickerCategoryIds || chat.settings.stickerCategoryIds.length === 0) {
        return '';
    }

    const categoryIds = chat.settings.stickerCategoryIds;
    let allStickers = [];
    const addedStickerNames = new Set(); // 用于防止分类重叠导致表情重复

    // V-Change: 遍历所有绑定的分类ID
    categoryIds.forEach(categoryId => {
        let stickersInCategory;

        if (categoryId === 'uncategorized') {
            stickersInCategory = runtime.state.userStickers.filter(s => !s.categoryId);
        } else {
            stickersInCategory = runtime.state.userStickers.filter(s => s.categoryId === categoryId);
        }
        
        // V-Change: 合并所有表情
        stickersInCategory.forEach(sticker => {
            if (!addedStickerNames.has(sticker.name)) {
                allStickers.push(sticker);
                addedStickerNames.add(sticker.name);
            }
        });
    });

    if (allStickers.length === 0) {
        return '';
    }

    const stickerList = allStickers.map(s => `- ${s.name}`).join('\n');
    return `
# 可用表情包 (优先使用)
- 请根据当前情景和你的情绪，从列表中【选择一个最合适的】表情含义来使用 "sticker" 指令。尽量让你的表情丰富多样，避免重复。
${stickerList}
`;
}

export function getGroupStickerContextForPrompt(chat) {
if (!chat || !chat.isGroup) return '';

    let context = '\n# 可用表情包 (优先使用)\n每个AI角色都被设置了专属表情包，在需要发送表情时，他们应该【优先】从自己的专属列表中选择。尽量让你的表情丰富多样，避免重复。\n';
    let foundAny = false;

    chat.members.forEach(member => {
        if(member.id === 'user') return;

        const memberChat = runtime.state.chats[member.id];
        // V-Change: 检查新的数组属性
        if (memberChat && memberChat.settings.stickerCategoryIds && memberChat.settings.stickerCategoryIds.length > 0) {
            const categoryIds = memberChat.settings.stickerCategoryIds;
            let allStickersForMember = [];
            const addedStickerNames = new Set(); // 防止重复

            // V-Change: 遍历所有绑定的分类ID
            categoryIds.forEach(categoryId => {
                let stickersInCategory;

                if (categoryId === 'uncategorized') {
                    stickersInCategory = runtime.state.userStickers.filter(s => !s.categoryId);
                } else {
                    stickersInCategory = runtime.state.userStickers.filter(s => s.categoryId === categoryId);
                }
                
                // V-Change: 合并所有表情
                stickersInCategory.forEach(sticker => {
                    if (!addedStickerNames.has(sticker.name)) {
                        allStickersForMember.push(sticker);
                        addedStickerNames.add(sticker.name);
                    }
                });
            });
            
            // V-Change: 检查合并后的结果
            if (allStickersForMember.length > 0) {
                foundAny = true;
                context += `\n## ${member.groupNickname} (本名: ${member.originalName}) 的可用表情:\n`;
                context += allStickersForMember.map(s => `- ${s.name}`).join('\n'); // 添加合并后的列表
            }
        }
    });

    return foundAny ? context : '';
}

export function estimateTokens(text) {
    if (!text) return 0;
    // 这是一个非常粗略的估算，对于中文，通常一个汉字不止一个token。
    // 但作为相对参考值，字符数/1.5 是一个不错的起点。
    return Math.ceil(text.length / 1.5);
}

export async function calculateCurrentContextTokens() {
    if (!runtime.state.activeChatId) return 0;
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return 0;

    // 从设置页面实时获取值，而不是从 state 中读取旧值
    const maxMemory = parseInt(document.getElementById('max-memory').value) || 10;
    const linkedMemoryCount = parseInt(document.getElementById('linked-memory-count').value) || 10;
    const isOfflineMode = document.getElementById('offline-mode-toggle').checked;
    const aiPersona = document.getElementById('ai-persona').value;
    const myPersona = document.getElementById('my-persona').value;

    let fullContextString = '';

    // 这部分逻辑与 triggerAiResponse 中构建 systemPrompt 的逻辑几乎完全一致
    // 目的是为了模拟AI接收到的完整上下文

    // 1. 世界书
    const linkedBookIds = Array.from(document.querySelectorAll('#world-book-checkboxes-container input:checked')).map(cb => cb.value.replace('book_', ''));
    if (linkedBookIds.length > 0) {
        const linkedContents = linkedBookIds.map(bookId => {
            const worldBook = runtime.state.worldBooks.find(wb => wb.id === bookId);
            if (!worldBook || !Array.isArray(worldBook.content)) return '';
            return worldBook.content.filter(e => e.enabled !== false).map(e => e.content).join('\n');
        }).filter(Boolean).join('\n');
        fullContextString += linkedContents;
    }

    // 2. 长期记忆
    if (chat.longTermMemory && chat.longTermMemory.length > 0) {
        fullContextString += chat.longTermMemory.map(mem => mem.content).join('\n');
    }

    // 3. 挂载记忆
    const linkedMemoryToggle = document.getElementById('link-memory-toggle').checked;
    if (linkedMemoryToggle) {
        const linkedChatIds = Array.from(document.querySelectorAll('#linked-chats-checkboxes-container input:checked')).map(cb => cb.value);
        for (const linkedId of linkedChatIds) {
            const linkedChat = runtime.state.chats[linkedId];
            if (linkedChat && linkedChat.history.length > 0) {
                fullContextString += linkedChat.history.slice(-linkedMemoryCount).map(msg => String(msg.content)).join('\n');
            }
        }
    }

    // 4. 人设
    if (chat.isGroup) {
        chat.members.forEach(member => {
            fullContextString += member.persona;
        });
    } else {
        fullContextString += aiPersona;
    }
    fullContextString += myPersona;

    // 5. 表情包
    fullContextString += getStickerContextForPrompt(chat);
    if (chat.isGroup) {
        fullContextString += getGroupStickerContextForPrompt(chat);
    }
    
    // 6. 线下模式的额外Prompt
    if (!chat.isGroup && isOfflineMode) {
        const offlinePresetId = document.getElementById('offline-preset-select').value;
        if (offlinePresetId) {
            const preset = runtime.state.presets.find(p => p.id === offlinePresetId);
            if (preset) {
                fullContextString += preset.content.filter(e => e.enabled !== false).map(e => e.content).join('\n');
            }
        }
    }

    // 7. 短期记忆 (对话历史)
    const historySlice = chat.history.slice(-maxMemory);
    fullContextString += historySlice.map(msg => {
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) return msg.content.map(p => p.text).join(' ');
        return '';
    }).join('\n');
    
    return estimateTokens(fullContextString);
}

export function bindStickerEvents() {
  document.getElementById('sticker-category-tabs').addEventListener('click', (e) => {
    if (e.target.classList.contains('sticker-category-tab')) {
        const categoryId = e.target.dataset.categoryId;
        const finalId = (categoryId !== 'all' && categoryId !== 'uncategorized') ? parseInt(categoryId) : categoryId;
        
        
        document.getElementById('sticker-search-input').value = ''; 
        
        
        switchStickerCategory(finalId);
    }
});

controls.chatMessagesContainer = document.getElementById('chat-messages')

controls.chatMessagesContainer.addEventListener('scroll', () => {
    
    if (controls.chatMessagesContainer.scrollTop < 1 && !runtime.isLoadingMoreMessages) {
        const totalMessages = runtime.state.chats[runtime.state.activeChatId]?.history.length || 0;
        
        if (totalMessages > runtime.currentRenderedCount) {
             loadMoreMessages();
        }
    }
});

controls.thoughtsHistoryList = document.getElementById('thoughts-history-list')

controls.thoughtsHistoryList.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = controls.thoughtsHistoryList;
    
    if (scrollHeight - scrollTop <= clientHeight + 50 && !runtime.isLoadingMoreThoughts) { 
        const totalItems = runtime.state.chats[runtime.state.activeChatId]?.thoughtsHistory.length || 0;
        if (totalItems > runtime.thoughtsHistoryRenderCount) {
            loadMoreThoughts();
        }
    }
});

controls.qzoneContent = document.querySelector('#qzone-screen .qzone-content')

controls.qzoneContent.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = controls.qzoneContent;
    
    if (scrollHeight - scrollTop <= clientHeight + 100 && !runtime.isLoadingMorePosts) { 
        if (runtime.qzonePostsCache.length > runtime.qzonePostsRenderCount) {
            loadMoreQzonePosts();
        }
    }
});
}
