import { addLongPressListener, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'
import { setupHomeScreenPagination } from '../home/widgets.js'

export async function openPresetScreen() {
    await renderPresetScreen();
    showScreen('preset-screen');
}

export async function renderPresetScreen() {
    const tabsContainer = document.getElementById('preset-tabs');
    const contentContainer = document.getElementById('preset-content-container');
    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';

    const [presets, categories] = await Promise.all([
        runtime.db.presets.toArray(),
        runtime.db.presetCategories.orderBy('name').toArray()
    ]);

    runtime.state.presets = presets; 

    if (presets.length === 0) {
        contentContainer.innerHTML = "<p style=\"text-align:center; color: #8a8a8a; margin-top: 50px;\">Use the plus button to create your first preset.</p>";
        return;
    }

    
    const allTab = document.createElement('button');
    allTab.className = 'world-book-tab active';
    allTab.textContent = "All";
    allTab.dataset.categoryId = 'all';
    tabsContainer.appendChild(allTab);

    const allPane = document.createElement('div');
    allPane.className = 'world-book-category-pane active';
    allPane.dataset.categoryId = 'all';
    contentContainer.appendChild(allPane);
    
    categories.forEach(category => {
        const categoryTab = document.createElement('button');
        categoryTab.className = 'world-book-tab';
        categoryTab.textContent = category.name;
        categoryTab.dataset.categoryId = String(category.id);
        tabsContainer.appendChild(categoryTab);

        const categoryPane = document.createElement('div');
        categoryPane.className = 'world-book-category-pane';
        categoryPane.dataset.categoryId = String(category.id);
        contentContainer.appendChild(categoryPane);
    });
    
    const hasUncategorized = presets.some(p => !p.categoryId);
    if (hasUncategorized) {
        const uncategorizedTab = document.createElement('button');
        uncategorizedTab.className = 'world-book-tab';
        uncategorizedTab.textContent = "Uncategorized";
        uncategorizedTab.dataset.categoryId = 'uncategorized';
        tabsContainer.appendChild(uncategorizedTab);
    
        const uncategorizedPane = document.createElement('div');
        uncategorizedPane.className = 'world-book-category-pane';
        uncategorizedPane.dataset.categoryId = 'uncategorized';
        contentContainer.appendChild(uncategorizedPane);
    }
    
    
    presets.forEach(preset => {
        
        const contentPreview = `该预设包含 ${preset.content.length} 个条目。`;
        
        const card = document.createElement('div');
        card.className = 'world-book-card'; 
        card.innerHTML = `
            <div class="card-title">${preset.name}</div>
            <div class="card-content-preview">${contentPreview}</div>
        `;
        
        
        const cardClickHandler = () => openPresetEditor(preset.id);
        const cardLongPressHandler = async () => { 
            const confirmed = await showCustomConfirm("Delete Preset", `Delete “${preset.name}”?`, { confirmButtonClass: 'btn-danger' }); 
            if (confirmed) { 
                await runtime.db.presets.delete(preset.id);
                runtime.state.presets = await runtime.db.presets.toArray();
                renderPresetScreen(); 
            } 
        };

        card.addEventListener('click', cardClickHandler);
        addLongPressListener(card, cardLongPressHandler);

        const clonedCardForAll = card.cloneNode(true);
        clonedCardForAll.addEventListener('click', cardClickHandler);
        addLongPressListener(clonedCardForAll, cardLongPressHandler);
        allPane.appendChild(clonedCardForAll);
        
        const categoryKey = preset.categoryId ? String(preset.categoryId) : 'uncategorized';
        const targetPane = contentContainer.querySelector(`.world-book-category-pane[data-category-id="${categoryKey}"]`);
        if (targetPane) {
            targetPane.appendChild(card);
        }
    });
    
    
    
    document.querySelectorAll('#preset-tabs .world-book-tab').forEach(tab => {
        tab.addEventListener('click', () => switchPresetCategory(tab.dataset.categoryId));
    });
}

export function switchPresetCategory(categoryId) {
    document.querySelectorAll('#preset-tabs .world-book-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.categoryId === categoryId);
    });
    document.querySelectorAll('#preset-content-container .world-book-category-pane').forEach(pane => {
        pane.classList.toggle('active', pane.dataset.categoryId === categoryId);
    });
}

export async function openPresetEditor(presetId) {
    
    showScreen('preset-editor-screen');
    runtime.editingPresetId = presetId;

    try {
        
        const [preset, categories] = await Promise.all([
            runtime.db.presets.get(presetId),
            runtime.db.presetCategories.toArray()
        ]);

        
        if (!preset) {
            console.error("错误：尝试打开一个不存在的预设，ID:", presetId);
            await showCustomAlert("Loading Failed", "Preset details could not be found.");
            showScreen('preset-screen'); 
            return;
        }

        
        
        setTimeout(() => {
            
            document.getElementById('preset-editor-title').textContent = preset.name;
            document.getElementById('preset-name-input').value = preset.name;

            const selectEl = document.getElementById('preset-category-select');
            selectEl.innerHTML = "<option value=\"\">Uncategorized</option>";
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                if (preset.categoryId === cat.id) option.selected = true;
                selectEl.appendChild(option);
            });

            const entriesContainer = document.getElementById('preset-entries-container');
            entriesContainer.innerHTML = '';
            if (Array.isArray(preset.content) && preset.content.length > 0) {
                preset.content.forEach(entry => {
                    const block = createPresetEntryBlock(entry);
                    entriesContainer.appendChild(block);
                });
            } else {
                entriesContainer.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); margin-top: 20px;\">Use Add Entry below to get started.</p>";
            }
        }, 50); 

    } catch (error) {
        console.error("打开预设编辑器时发生严重错误:", error);
        await showCustomAlert("Loading Failed", `Could not load preset details: ${error.message}`);
        showScreen('preset-screen'); 
    }
}

export function createPresetEntryBlock(entry = { keys: [], comment: '', content: '', enabled: true }) {
    const block = document.createElement('div');
    block.className = 'message-editor-block';
    const isChecked = entry.enabled !== false ? 'checked' : '';

    
    block.innerHTML = `
        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-bottom: 5px;">
            <label class="toggle-switch" title="启用/禁用此条目">
                <input type="checkbox" class="entry-enabled-switch" ${isChecked}>
                <span class="slider"></span>
            </label>
            <button type="button" class="delete-block-btn" title="删除此条目">×</button>
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
            <label style="font-size: 0.8em;">Note (optional)</label>
            <input type="text" class="entry-comment-input" value="${entry.comment || ''}" placeholder="例如：角色核心设定" style="padding: 8px;">
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
            <label style="font-size: 0.8em;">Keywords (comma-separated)</label>
            <input type="text" class="entry-keys-input" value="${(entry.keys || []).join(', ')}" placeholder="例如: key1, key2" style="padding: 8px;">
        </div>
        
        <!-- 这里是全新的、带有“Expand/Collapse”按钮的结构 -->
        <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8em; display: flex; justify-content: space-between; align-items: center;">
                <span>Content</span>
                <button type="button" class="toggle-content-btn">Expand</button>
            </label>
            <div class="entry-content-container">
                 <textarea class="entry-content-textarea" rows="8" style="width: 100%; font-size: 14px;">${entry.content || ''}</textarea>
            </div>
        </div>
    `;
    

    
    block.querySelector('.delete-block-btn').addEventListener('click', () => block.remove());
    
    
    const toggleBtn = block.querySelector('.toggle-content-btn');
    const contentContainer = block.querySelector('.entry-content-container');
    toggleBtn.addEventListener('click', () => {
        const isHidden = contentContainer.style.display === 'none';
        contentContainer.style.display = isHidden ? 'block' : 'none';
        toggleBtn.textContent = isHidden ? 'Collapse' : 'Expand';
    });

    return block;
}

export async function openPresetCategoryManager() {
    await renderPresetCategoriesInManager();
    
    document.querySelector('#group-management-modal .modal-header span').textContent = "Manage Preset Categories";
    document.getElementById('add-new-group-btn').onclick = addNewPresetCategory;
    document.getElementById('existing-groups-list').onclick = (e) => {
        if (e.target.classList.contains('delete-group-btn')) {
            deletePresetCategory(parseInt(e.target.dataset.id));
        }
    };
    document.getElementById('close-group-manager-btn').onclick = () => {
        document.getElementById('group-management-modal').classList.remove('visible');
        renderPresetScreen(); 
    };
    document.getElementById('group-management-modal').classList.add('visible');
}

export async function renderPresetCategoriesInManager() {
    const listEl = document.getElementById('existing-groups-list');
    const categories = await runtime.db.presetCategories.toArray();
    listEl.innerHTML = '';
    if (categories.length === 0) {
        listEl.innerHTML = "<p style=\"text-align: center; color: var(--text-secondary);\">No categories yet.</p>";
    }
    categories.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'existing-group-item';
        item.innerHTML = `<span class="group-name">${cat.name}</span><span class="delete-group-btn" data-id="${cat.id}">×</span>`;
        listEl.appendChild(item);
    });
}

export async function addNewPresetCategory() {
    const input = document.getElementById('new-group-name-input');
    const name = input.value.trim();
    if (!name) return alert("Enter a category name.");
    const existing = await runtime.db.presetCategories.where('name').equals(name).first();
    if (existing) return alert(`The category “${name}” already exists.`);
    await runtime.db.presetCategories.add({ name });
    input.value = '';
    await renderPresetCategoriesInManager();
}

export async function deletePresetCategory(categoryId) {
    const confirmed = await showCustomConfirm("Confirm Delete", "Delete this category? Its presets will become uncategorized.", { confirmButtonClass: 'btn-danger' });
    if (confirmed) {
        await runtime.db.presetCategories.delete(categoryId);
        await runtime.db.presets.where('categoryId').equals(categoryId).modify({ categoryId: null });
        
        
        runtime.state.presets = await runtime.db.presets.toArray();
        

        await renderPresetCategoriesInManager();
    }
}

export async function handlePresetImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        if (!file.name.endsWith('.json')) {
            throw new Error("文件格式不支持。请选择 .json 格式的 Tavern 预设文件。");
        }
        
        const text = await file.text();
        const tavernData = JSON.parse(text);
        
        
        await importTavernPresetFile(tavernData, file.name);

    } catch (error) {
        console.error("预设导入失败:", error);
        await showCustomAlert("Import Failed", `Could not read the preset file. Error: ${error.message}`);
    } finally {
        
        event.target.value = null;
    }
}

export async function importTavernPresetFile(tavernData, fileName) {
            let newEntries = [];

            

            
            if (Array.isArray(tavernData.prompts) && Array.isArray(tavernData.prompt_order) && tavernData.prompt_order.length > 0) {
                console.log("检测到 Tavern/SillyTavern 预设格式，将严格按照 prompt_order 排序。");

                
                const promptsMap = new Map(tavernData.prompts.map(p => [p.identifier, p]));

                
                const orderArray = tavernData.prompt_order.reduce((acc, curr) => (
                    (curr.order && curr.order.length > (acc.length || 0)) ? curr.order : acc
                ), []);

                if (orderArray && orderArray.length > 0) {
                    newEntries = orderArray
                        .map(orderItem => {
                            
                            const promptData = promptsMap.get(orderItem.identifier);
                            if (promptData) {
                                
                                return {
                                    keys: [], 
                                    comment: promptData.name || '无标题',
                                    content: promptData.content || '',
                                    
                                    enabled: orderItem.enabled 
                                };
                            }
                            return null;
                        })
                        .filter(Boolean); 
                }
            }
            
            else if (tavernData.entries && typeof tavernData.entries === 'object') {
                console.log("检测到 'entries' 对象格式的预设，将尝试按顺序导入。");
                if (Array.isArray(tavernData.order)) {
                    console.log("检测到 'order' 字段，将按指定顺序导入条目。");
                    newEntries = tavernData.order
                        .map(key => tavernData.entries[key])
                        .filter(Boolean)
                        .map(entry => ({
                            keys: entry.key || [],
                            comment: entry.comment || '无备注',
                            content: entry.content || '',
                            enabled: !entry.disable 
                        }));
                } else {
                    console.warn("未在文件中找到 'order' 字段，条目可能无法按原始顺序导入。");
                    newEntries = Object.values(tavernData.entries).map(entry => ({
                        keys: entry.key || [],
                        comment: entry.comment || '无备注',
                        content: entry.content || '',
                        enabled: !entry.disable
                    }));
                }
            }
            
            else if (Array.isArray(tavernData.prompts)) {
                console.log("检测到简单的 'prompts' 数组格式，将按数组内顺序导入。");
                newEntries = tavernData.prompts.map(prompt => ({
                    keys: [],
                    comment: prompt.name || '无标题',
                    content: prompt.content || '',
                    enabled: true 
                }));
            }
            
            else {
                throw new Error("文件格式无法识别。未找到有效的 'prompts' 数组或 'entries' 对象。");
            }
            

            
            newEntries = newEntries.filter(entry => entry.content);

            if (newEntries.length === 0) {
                alert("The preset file has no valid prompt entries.");
                return;
            }

            
            const presetNameSuggestion = fileName.replace(/\.json$/i, '');
            const newPresetName = await showCustomPrompt("Import SillyTavern Preset", "Name this prompt preset", presetNameSuggestion);
            if (!newPresetName || !newPresetName.trim()) {
                alert("Import cancelled because no name was provided.");
                return;
            }

            const newPreset = {
                id: 'preset_' + Date.now(),
                name: newPresetName.trim(),
                content: newEntries,
                categoryId: null
            };

            await runtime.db.presets.add(newPreset);
            runtime.state.presets.push(newPreset);

            await renderPresetScreen();
            await showCustomAlert("Import Complete", `Imported preset “${newPresetName}”.`);
        }

export async function renderOfflinePresetSelector(chat) {
    const selectEl = document.getElementById('offline-preset-select');
    if (!selectEl) return;

    
    const presets = runtime.state.presets || [];
    
    
    selectEl.innerHTML = "<option value=\"\">No Preset</option>";
    presets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        selectEl.appendChild(option);
    });

    
    if (chat.settings.offlinePresetId) {
        selectEl.value = chat.settings.offlinePresetId;
    }
}

export function bindPresetEvents() {
  setupHomeScreenPagination();

window.openPresetScreen = openPresetScreen;

document.getElementById('add-preset-btn').addEventListener('click', async () => {
            const name = await showCustomPrompt("Create Preset", "Enter a preset name");
            if (name && name.trim()) {
                const newPreset = { id: 'preset_' + Date.now(), name: name.trim(), content: [] };
                await runtime.db.presets.add(newPreset);
                await renderPresetScreen();
                openPresetEditor(newPreset.id);
            }
        });

document.getElementById('manage-preset-categories-btn').addEventListener('click', openPresetCategoryManager);

document.getElementById('add-preset-entry-btn').addEventListener('click', () => {
            const container = document.getElementById('preset-entries-container');
            if (container.querySelector('p')) {
                container.innerHTML = '';
            }
            const newBlock = createPresetEntryBlock();
            container.appendChild(newBlock);
            newBlock.querySelector('.entry-content-textarea').focus();
        });

document.getElementById('save-preset-btn').addEventListener('click', async () => {
    if (!runtime.editingPresetId) return;
    const preset = await runtime.db.presets.get(runtime.editingPresetId);
    if (!preset) return;

    
    const newName = document.getElementById('preset-name-input').value.trim();
    if (!newName) { alert("Enter a preset name."); return; }
    preset.name = newName;
    preset.categoryId = parseInt(document.getElementById('preset-category-select').value) || null;

    const entriesContainer = document.getElementById('preset-entries-container');
    const entryBlocks = entriesContainer.querySelectorAll('.message-editor-block');
    const newEntries = [];
    entryBlocks.forEach(block => {
        const content = block.querySelector('.entry-content-textarea').value.trim();
        if (content) {
            newEntries.push({
                comment: block.querySelector('.entry-comment-input').value.trim(),
                keys: (block.querySelector('.entry-keys-input').value.trim() || '').split(',').map(k => k.trim()).filter(Boolean),
                content: content,
                enabled: block.querySelector('.entry-enabled-switch').checked
            });
        }
    });
    preset.content = newEntries;

    
    await runtime.db.presets.put(preset);
    runtime.editingPresetId = null;

    
    showScreen('preset-screen');
    
    
    
    await renderPresetScreen();
});
}
