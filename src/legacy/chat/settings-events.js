import { loadThemePresetsDropdown } from '../appearance/presets.js'
import { applyScopedCss, updateSettingsPreview } from '../appearance/theme.js'
import { renderChatInterface } from './conversation.js'
import { openFrameSelectorModal, syncCharacterAvatarInGroups, syncCharacterNameInGroups } from './groups.js'
import { renderChatList } from './list.js'
import { renderGroupMemberSettings, updateWorldBookSelectionDisplay } from './settings.js'
import { showCustomConfirm } from '../dialogs/dialogs.js'
import { applyLyricsBarPosition } from '../music/player.js'
import { renderOfflinePresetSelector } from '../presets/presets.js'
import { openBatchStickerImportModal, renderStickerPanel } from '../stickers/stickers.js'
import { showScreen } from '../../app/routes'
import { controls } from '../runtime/state.js'
import { runtime } from '../runtime/state.js'

export function bindChatSettingsEditor() {
  controls.chatSettingsModal = document.getElementById('chat-settings-modal')

controls.worldBookSelectBox = document.querySelector('.custom-multiselect .select-box')

controls.worldBookCheckboxesContainer = document.getElementById('world-book-checkboxes-container')

controls.worldBookSelectBox.addEventListener('click', (e) => { e.stopPropagation(); controls.worldBookCheckboxesContainer.classList.toggle('visible'); controls.worldBookSelectBox.classList.toggle('expanded'); });

document.getElementById('world-book-checkboxes-container').addEventListener('change', updateWorldBookSelectionDisplay);

window.addEventListener('click', (e) => { if (!document.querySelector('.custom-multiselect').contains(e.target)) { controls.worldBookCheckboxesContainer.classList.remove('visible'); controls.worldBookSelectBox.classList.remove('expanded'); } });

document.getElementById('chat-settings-btn').addEventListener('click', async () => {
            loadThemePresetsDropdown(); 
            if (!runtime.state.activeChatId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const isGroup = chat.isGroup;
            const groupNai = document.getElementById('group-nai-settings-group');
            const singleNai = document.getElementById('nai-character-settings-group');
            groupNai.style.display = isGroup ? 'block' : 'none';
            singleNai.style.display = isGroup ? 'none' : 'block';
            const naiGroup = isGroup ? groupNai : singleNai;
            naiGroup.querySelectorAll('input[type="radio"]').forEach(input => {
                input.checked = input.value === (chat.settings.naiSettings?.promptSource ?? 'system');
            });
        
            
            const switchGreetingGroup = document.getElementById('switch-greeting-group');
            if (!isGroup && chat.settings.alternateGreetings && chat.settings.alternateGreetings.length > 0) {
                switchGreetingGroup.style.display = 'block';
            } else {
                switchGreetingGroup.style.display = 'none';
            }
            
            document.getElementById('chat-name-group').style.display = 'block';
            document.getElementById('my-persona-group').style.display = 'block';
            document.getElementById('my-avatar-group').style.display = 'block';
            document.getElementById('my-group-nickname-group').style.display = isGroup ? 'block' : 'none';
            document.getElementById('my-nickname-group').style.display = isGroup ? 'none' : 'block';
            document.getElementById('group-avatar-group').style.display = isGroup ? 'block' : 'none';
            document.getElementById('group-members-group').style.display = isGroup ? 'block' : 'none';
            document.getElementById('ai-persona-group').style.display = isGroup ? 'none' : 'block';
            document.getElementById('ai-avatar-group').style.display = isGroup ? 'none' : 'block';
            document.getElementById('assign-group-section').style.display = isGroup ? 'none' : 'block';
            document.getElementById('ai-original-name-group').style.display = isGroup ? 'none' : 'block';
            document.getElementById('ai-voice-id-group').style.display = isGroup ? 'none' : 'block';
           document.getElementById('inject-thought-group').style.display = isGroup ? 'none' : 'block';
            document.getElementById('offline-mode-group').style.display = isGroup ? 'none' : 'block';
            document.getElementById('ai-cooldown-group').style.display = isGroup ? 'none' : 'block';
            document.getElementById('group-cooldown-group').style.display = isGroup ? 'block' : 'none';
            document.getElementById('chat-name-input').value = chat.name;
            document.getElementById('my-persona').value = chat.settings.myPersona;
            document.getElementById('my-avatar-preview').src = chat.settings.myAvatar || (isGroup ? runtime.defaultMyGroupAvatar : runtime.defaultAvatar);
            document.getElementById('max-memory').value = chat.settings.maxMemory;
            document.getElementById('linked-memory-count').value = chat.settings.linkedMemoryCount || 10;
            const bgPreview = document.getElementById('bg-preview');
            const removeBgBtn = document.getElementById('remove-bg-btn');
            if (chat.settings.background) {
                bgPreview.src = chat.settings.background;
                bgPreview.style.display = 'block';
                removeBgBtn.style.display = 'inline-block';
            } else {
                bgPreview.style.display = 'none';
                removeBgBtn.style.display = 'none';
            }
            document.getElementById('lyrics-position-group').style.display = isGroup ? 'none' : 'block';

document.getElementById('single-char-background-activity-group').style.display = isGroup ? 'none' : 'block';
document.getElementById('group-background-activity-group').style.display = isGroup ? 'block' : 'none';




const timePerceptionToggle = document.getElementById('time-perception-toggle');
const timeZoneGroup = document.getElementById('time-zone-group');
timePerceptionToggle.checked = chat.settings.enableTimePerception;
timeZoneGroup.style.display = timePerceptionToggle.checked ? 'block' : 'none';


const timezoneSelect = document.getElementById('time-zone-select');

const timezones = Intl.supportedValuesOf('timeZone');
timezoneSelect.innerHTML = ''; 
timezones.forEach(tz => {
    const option = document.createElement('option');
    option.value = tz;
    option.textContent = tz;
    timezoneSelect.appendChild(option);
});

timezoneSelect.value = chat.settings.timeZone || 'Asia/Shanghai';
if (isGroup) {
    
    document.getElementById('group-background-activity-switch').checked = chat.settings.enableBackgroundActivity;
    document.getElementById('my-group-nickname-input').value = chat.settings.myNickname || '';
    document.getElementById('group-avatar-preview').src = chat.settings.groupAvatar || runtime.defaultGroupAvatar;
    document.getElementById('group-action-cooldown-input').value = chat.settings.actionCooldownMinutes || 10;

    
    document.getElementById('single-char-background-activity-group').style.display = 'none';
    renderGroupMemberSettings(chat.members);
} else {
    
    document.getElementById('single-char-background-activity-group').style.display = 'block';
    document.getElementById('char-background-activity-switch').checked = chat.settings.enableBackgroundActivity;
    document.getElementById('inject-thought-toggle').checked = chat.settings.injectLatestThought;
    
    const offlineModeToggle = document.getElementById('offline-mode-toggle');
    const offlineModeOptions = document.getElementById('offline-mode-options');
    const offlineMinInput = document.getElementById('offline-min-length-input');
    const offlineMaxInput = document.getElementById('offline-max-length-input');
    offlineModeToggle.checked = chat.settings.isOfflineMode || false;
    offlineModeOptions.style.display = offlineModeToggle.checked ? 'block' : 'none';
    offlineMinInput.value = chat.settings.offlineMinLength || 100;
    offlineMaxInput.value = chat.settings.offlineMaxLength || 300;
await renderOfflinePresetSelector(chat);
    document.getElementById('ai-original-name-input').value = chat.originalName;
document.getElementById('ai-voice-id-input').value = chat.settings.minimaxVoiceId || '';
document.getElementById('enable-tts-switch').checked = chat.settings.enableTts !== false;
    document.getElementById('ai-persona').value = chat.settings.aiPersona;
    document.getElementById('ai-avatar-preview').src = chat.settings.aiAvatar || runtime.defaultAvatar;
    document.getElementById('my-nickname-input').value = chat.settings.myNickname || '我';
    document.getElementById('ai-action-cooldown-input').value = chat.settings.actionCooldownMinutes || 10;
    const select = document.getElementById('assign-group-select');
    select.innerHTML = "<option value=\"\">Ungrouped</option>";
    const groups = await runtime.db.qzoneGroups.toArray();
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        if (chat.groupId === group.id) option.selected = true;
        select.appendChild(option);
    });
    const lyricsPos = chat.settings.lyricsPosition || { vertical: 'top', horizontal: 'center', offset: 10 };
    document.getElementById('lyrics-vertical-pos').value = lyricsPos.vertical;
    document.getElementById('lyrics-horizontal-pos').value = lyricsPos.horizontal;
    document.getElementById('lyrics-offset-input').value = lyricsPos.offset;
}
  
            
            
            const worldBookCheckboxesContainer = document.getElementById('world-book-checkboxes-container');
            worldBookCheckboxesContainer.innerHTML = ''; 
        
            const [allCategories, allBooks] = await Promise.all([
                runtime.db.worldBookCategories.toArray(),
                runtime.db.worldBooks.toArray()
            ]);
        
            const linkedBookIds = new Set(chat.settings.linkedWorldBookIds || []);
        
            if (allBooks.length === 0) {
                worldBookCheckboxesContainer.innerHTML = "<p style=\"text-align:center; color: #8a8a8a;\">No World Info books yet</p>";
            } else {
                
                allCategories.forEach(cat => {
                    const booksInCategory = allBooks.filter(book => book.categoryId === cat.id);
                    if (booksInCategory.length > 0) {
                        const categoryHeader = document.createElement('h4');
                        categoryHeader.textContent = cat.name; 
                        categoryHeader.style.cssText = 'margin: 10px 0 5px; color: #555; border-bottom: 1px solid #eee; padding-bottom: 3px;';
                        worldBookCheckboxesContainer.appendChild(categoryHeader);
        
                        booksInCategory.forEach(book => {
                            const isChecked = linkedBookIds.has(book.id);
                            const label = document.createElement('label');
                            
                            label.innerHTML = `<input type="checkbox" value="book_${book.id}" ${isChecked ? 'checked' : ''}> ${book.name}`;
                            worldBookCheckboxesContainer.appendChild(label);
                        });
                    }
                });
        
                
                const uncategorizedBooks = allBooks.filter(book => !book.categoryId);
                if (uncategorizedBooks.length > 0) {
                    const bookHeader = document.createElement('h4');
                    bookHeader.textContent = "Uncategorized";
                    bookHeader.style.cssText = 'margin: 15px 0 5px; color: #555; border-bottom: 1px solid #eee; padding-bottom: 3px;';
                    worldBookCheckboxesContainer.appendChild(bookHeader);
        
                    uncategorizedBooks.forEach(book => {
                        const isChecked = linkedBookIds.has(book.id);
                        const label = document.createElement('label');
                        label.innerHTML = `<input type="checkbox" value="book_${book.id}" ${isChecked ? 'checked' : ''}> ${book.name}`;
                        worldBookCheckboxesContainer.appendChild(label);
                    });
                }
            }
            
        
            updateWorldBookSelectionDisplay();

            const linkMemoryToggle = document.getElementById('link-memory-toggle'); const linkedMemorySelection = document.getElementById('linked-memory-selection'); const linkedChatsContainer = document.getElementById('linked-chats-checkboxes-container'); const linkedMemoryIds = chat.settings.linkedMemoryChatIds || []; linkMemoryToggle.checked = linkedMemoryIds.length > 0; linkedMemorySelection.style.display = linkMemoryToggle.checked ? 'block' : 'none'; linkedChatsContainer.innerHTML = ''; Object.values(runtime.state.chats).forEach(c => { if (c.id === chat.id) return; const isChecked = linkedMemoryIds.includes(c.id); const prefix = c.isGroup ? '[Group]' : '[Direct]'; const label = document.createElement('label'); label.innerHTML = `<input type="checkbox" value="${c.id}" ${isChecked ? 'checked' : ''}> ${prefix} ${c.name}`; linkedChatsContainer.appendChild(label); }); function updateLinkedMemorySelectionDisplay() { const checkedBoxes = linkedChatsContainer.querySelectorAll('input:checked'); const displayText = linkedMemorySelection.querySelector('.selected-options-text'); if (checkedBoxes.length === 0) { displayText.textContent = "Select entries"; } else if (checkedBoxes.length > 2) { displayText.textContent = `${checkedBoxes.length} selected`; } else { displayText.textContent = Array.from(checkedBoxes).map(cb => cb.parentElement.textContent.trim()).join(', '); } } updateLinkedMemorySelectionDisplay(); linkMemoryToggle.addEventListener('change', () => { linkedMemorySelection.style.display = linkMemoryToggle.checked ? 'block' : 'none'; }); const linkedMemorySelectBox = linkedMemorySelection.querySelector('.select-box'); const newLinkedMemorySelectBox = linkedMemorySelectBox.cloneNode(true); linkedMemorySelectBox.parentNode.replaceChild(newLinkedMemorySelectBox, linkedMemorySelectBox); newLinkedMemorySelectBox.addEventListener('click', (e) => { e.stopPropagation(); linkedChatsContainer.classList.toggle('visible'); newLinkedMemorySelectBox.classList.toggle('expanded'); }); linkedChatsContainer.addEventListener('change', updateLinkedMemorySelectionDisplay);
            const themeRadio = document.querySelector(`input[name="theme-select"][value="${chat.settings.theme || 'default'}"]`); if (themeRadio) themeRadio.checked = true;
            const fontSizeSlider = document.getElementById('font-size-slider'); fontSizeSlider.value = chat.settings.fontSize || 13; document.getElementById('font-size-value').textContent = `${fontSizeSlider.value}px`;
            const customCssInput = document.getElementById('custom-css-input'); customCssInput.value = chat.settings.customCss || '';
            updateSettingsPreview();
            document.getElementById('auto-memory-toggle').checked = chat.settings.enableAutoMemory || false;
            document.getElementById('auto-memory-interval').value = chat.settings.autoMemoryInterval || 20;
        setTimeout(() => {
            runtime.updateTokenCountDisplay(); // 首次打开时计算一次

            // 为所有影响上下文的输入框添加事件监听
            const inputsToWatch = [
                'ai-persona', 'my-persona', 'max-memory', 
                'linked-memory-count', 'auto-memory-toggle', 'auto-memory-interval',
                'offline-mode-toggle', 'offline-min-length-input', 
                'offline-max-length-input', 'offline-preset-select'
            ];
            
            inputsToWatch.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', runtime.updateTokenCountDisplay);
                }
            });

            // 为多选框容器添加事件监听
            document.getElementById('world-book-checkboxes-container').addEventListener('change', runtime.updateTokenCountDisplay);
            document.getElementById('linked-chats-checkboxes-container').addEventListener('change', runtime.updateTokenCountDisplay);
            document.getElementById('link-memory-toggle').addEventListener('change', runtime.updateTokenCountDisplay);
        }, 100);
            showScreen('chat-settings-screen');
        });

document.getElementById('save-member-settings-btn').addEventListener('click', async () => {
    if (!runtime.editingMemberId) return; 
    const chat = runtime.state.chats[runtime.state.activeChatId]; 
    const member = chat.members.find(m => m.id === runtime.editingMemberId); 
    if (!member) return;

    const newNickname = document.getElementById('member-name-input').value.trim();
    if (!newNickname) {
        alert("Enter a group display name.");
        return;
    }
    member.groupNickname = newNickname; 
    member.persona = document.getElementById('member-persona-input').value; 
    
    const newAvatarUrl = document.getElementById('member-avatar-preview').src;

    
    
    member.avatar = newAvatarUrl;

    
    const characterProfile = runtime.state.chats[member.id];
    if (characterProfile) {
        characterProfile.settings.aiAvatar = newAvatarUrl;
        await runtime.db.chats.put(characterProfile);
    }
    
    
    await runtime.db.chats.put(chat);
    
    
    renderGroupMemberSettings(chat.members); 
    document.getElementById('member-settings-modal').classList.remove('visible'); 
    runtime.editingMemberId = null;
});

document.getElementById('cancel-member-settings-btn').addEventListener('click', () => { document.getElementById('member-settings-modal').classList.remove('visible'); runtime.editingMemberId = null; });

document.getElementById('reset-theme-btn').addEventListener('click', () => { document.getElementById('theme-default').checked = true; });

document.getElementById('save-chat-settings-btn').addEventListener('click', async () => {
    if (!runtime.state.activeChatId) return;
    const chat = runtime.state.chats[runtime.state.activeChatId];
    
    
    const oldOfflineModeState = chat.settings.isOfflineMode || false;

    
    const newName = document.getElementById('chat-name-input').value.trim();
    if (!newName) return alert("Enter a chat or group name.");
    if (!chat.isGroup && newName !== chat.name) {
        if (!chat.nameHistory) chat.nameHistory = [];
        if (!chat.nameHistory.includes(chat.name)) chat.nameHistory.push(chat.name);
    }
    chat.name = newName;
    const selectedThemeRadio = document.querySelector('input[name="theme-select"]:checked');
    chat.settings.theme = selectedThemeRadio ? selectedThemeRadio.value : 'default';
    chat.settings.fontSize = parseInt(document.getElementById('font-size-slider').value);
    chat.settings.customCss = document.getElementById('custom-css-input').value.trim();
    chat.settings.myPersona = document.getElementById('my-persona').value;
    chat.settings.myAvatar = document.getElementById('my-avatar-preview').src;
    chat.settings.maxMemory = parseInt(document.getElementById('max-memory').value) || 10;
    chat.settings.linkedMemoryCount = parseInt(document.getElementById('linked-memory-count').value) || 10;
    
    const checkedBookItems = document.querySelectorAll('#world-book-checkboxes-container input[type="checkbox"]:checked');
    const newLinkedBookIds = [];
    checkedBookItems.forEach(cb => {
        if (cb.value.startsWith('book_')) {
            newLinkedBookIds.push(cb.value.replace('book_', ''));
        }
    });
    chat.settings.linkedWorldBookIds = newLinkedBookIds;
    
    const linkMemoryToggleChecked = document.getElementById('link-memory-toggle').checked;
    if (linkMemoryToggleChecked) {
        const checkedChats = document.querySelectorAll('#linked-chats-checkboxes-container input:checked');
        chat.settings.linkedMemoryChatIds = Array.from(checkedChats).map(cb => cb.value);
    } else {
        chat.settings.linkedMemoryChatIds = [];
    }
    chat.settings.enableAutoMemory = document.getElementById('auto-memory-toggle').checked;
    chat.settings.autoMemoryInterval = parseInt(document.getElementById('auto-memory-interval').value) || 20;
    chat.settings.enableTimePerception = document.getElementById('time-perception-toggle').checked;
    chat.settings.timeZone = document.getElementById('time-zone-select').value;
    const sourceName = chat.isGroup ? 'group-nai-prompt-source' : 'nai-prompt-source';
    const promptSource = document.querySelector('input[name="' + sourceName + '"]:checked')?.value ?? 'system';
    chat.settings.naiSettings = { ...chat.settings.naiSettings, promptSource };
    
    if (chat.isGroup) {
        chat.settings.enableBackgroundActivity = document.getElementById('group-background-activity-switch').checked;
        chat.settings.myNickname = document.getElementById('my-group-nickname-input').value.trim();
        chat.settings.groupAvatar = document.getElementById('group-avatar-preview').src;
        chat.settings.actionCooldownMinutes = parseInt(document.getElementById('group-action-cooldown-input').value) || 10;
    } else {
        chat.settings.enableBackgroundActivity = document.getElementById('char-background-activity-switch').checked;
        const newOfflineModeState = document.getElementById('offline-mode-toggle').checked;
        chat.settings.isOfflineMode = newOfflineModeState;

        
        
        
        
        
        if (oldOfflineModeState === true && newOfflineModeState === false) {
            
            
            const switchInstruction = {
                role: 'system',
                content: '[系统指令：模式已切换！你现在回到了线上聊天模式。你的回复【必须】严格遵守线上模式的JSON数组格式，例如 [{"type": "text", "content": "你好"}]]',
                timestamp: Date.now(),
                isHidden: true 
            };
            
            
            chat.history.push(switchInstruction);
            console.log("已成功注入“切换到线上模式”的系统指令。");
        }
        
        
        chat.settings.injectLatestThought = document.getElementById('inject-thought-toggle').checked;        
        chat.settings.offlineMinLength = parseInt(document.getElementById('offline-min-length-input').value) || 100;
        chat.settings.offlineMaxLength = parseInt(document.getElementById('offline-max-length-input').value) || 300;
        chat.settings.offlinePresetId = document.getElementById('offline-preset-select').value || null;
        
        const newOriginalName = document.getElementById('ai-original-name-input').value.trim();
        if (!newOriginalName) return alert("Enter the character’s name.");
        chat.originalName = newOriginalName;
        chat.settings.aiPersona = document.getElementById('ai-persona').value;
        chat.settings.minimaxVoiceId = document.getElementById('ai-voice-id-input').value.trim();
chat.settings.enableTts = document.getElementById('enable-tts-switch').checked;
        chat.settings.aiAvatar = document.getElementById('ai-avatar-preview').src;
        chat.settings.myNickname = document.getElementById('my-nickname-input').value.trim() || '我';
        chat.settings.actionCooldownMinutes = parseInt(document.getElementById('ai-action-cooldown-input').value) || 10;
        chat.settings.lyricsPosition = {
            vertical: document.getElementById('lyrics-vertical-pos').value,
            horizontal: document.getElementById('lyrics-horizontal-pos').value,
            offset: parseInt(document.getElementById('lyrics-offset-input').value) || 10
        };
        const selectedGroupId = document.getElementById('assign-group-select').value;
        chat.groupId = selectedGroupId ? parseInt(selectedGroupId) : null;
    }

    await runtime.db.chats.put(chat);
    if (!chat.isGroup) {
        await syncCharacterNameInGroups(chat);
        await syncCharacterAvatarInGroups(chat);
    }
    applyLyricsBarPosition(chat);
    applyScopedCss(chat.settings.customCss, '#chat-messages', 'custom-bubble-style');
    showScreen('chat-interface-screen');
    renderChatInterface(runtime.state.activeChatId);
    renderChatList();
});

document.getElementById('chat-settings-screen').addEventListener('click', (e) => {
    if (e.target.classList.contains('change-frame-btn')) {
        openFrameSelectorModal('chat');
    }
});

document.getElementById('member-settings-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('change-frame-btn')) { 
                openFrameSelectorModal('member');
            }
        });
}

export function bindChatAppearanceControls() {
  document.getElementById('clear-chat-btn').addEventListener('click', async () => { if (!runtime.state.activeChatId) return; const chat = runtime.state.chats[runtime.state.activeChatId]; const confirmed = await showCustomConfirm("Clear Chat History", "Permanently delete all messages in this chat?", { confirmButtonClass: 'btn-danger' }); if (confirmed) { chat.history = [];chat.heartfeltVoice = '...';chat.randomJottings = '...'; await runtime.db.chats.put(chat); renderChatInterface(runtime.state.activeChatId); renderChatList(); controls.chatSettingsModal.classList.remove('visible'); } });

controls.setupFileUpload = (inputId, callback) => { document.getElementById(inputId).addEventListener('change', async (event) => { const file = event.target.files[0]; if (file) { const dataUrl = await new Promise((res, rej) => { const reader = new FileReader(); reader.onload = () => res(reader.result); reader.onerror = () => rej(reader.error); reader.readAsDataURL(file); }); callback(dataUrl); event.target.value = null; } }); }

controls.setupFileUpload('ai-avatar-input', (base64) => document.getElementById('ai-avatar-preview').src = base64);

controls.setupFileUpload('my-avatar-input', (base64) => document.getElementById('my-avatar-preview').src = base64);

controls.setupFileUpload('group-avatar-input', (base64) => document.getElementById('group-avatar-preview').src = base64);

controls.setupFileUpload('member-avatar-input', (base64) => document.getElementById('member-avatar-preview').src = base64);

controls.setupFileUpload('bg-input', (base64) => { if(runtime.state.activeChatId) { runtime.state.chats[runtime.state.activeChatId].settings.background = base64; const bgPreview = document.getElementById('bg-preview'); bgPreview.src = base64; bgPreview.style.display = 'block'; document.getElementById('remove-bg-btn').style.display = 'inline-block'; } });

controls.setupFileUpload('preset-avatar-input', (base64) => document.getElementById('preset-avatar-preview').src = base64);

document.getElementById('remove-bg-btn').addEventListener('click', () => { if (runtime.state.activeChatId) { runtime.state.chats[runtime.state.activeChatId].settings.background = ''; const bgPreview = document.getElementById('bg-preview'); bgPreview.src = ''; bgPreview.style.display = 'none'; document.getElementById('remove-bg-btn').style.display = 'none'; } });

controls.stickerPanel = document.getElementById('sticker-panel')

document.getElementById('open-sticker-panel-btn').addEventListener('click', () => { 
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (chat && chat.settings.stickerCategoryId) {
       
        runtime.activeStickerCategoryId = chat.settings.stickerCategoryId;
    } else {
    
        runtime.activeStickerCategoryId = 'all'; 
    }
    renderStickerPanel(); 
    controls.stickerPanel.classList.add('visible'); 
});

document.getElementById('close-sticker-panel-btn').addEventListener('click', () => controls.stickerPanel.classList.remove('visible'));

document.getElementById('add-sticker-batch-btn').addEventListener('click', openBatchStickerImportModal);
}
