import { readLocationFields, setLocationFields } from '../../features/chat/LocationFields'
import { chatFeatureSwitches, parseCalendarDates } from '../../features/chat/chat-features'
import { categoryKey } from '../../features/stickers/library'
import { getLoreBooks } from '../../features/world-book/lore-storage'
import { loadThemePresetsDropdown } from '../appearance/presets.js'
import { applyScopedCss, updateSettingsPreview } from '../appearance/theme.js'
import { renderChatInterface } from './conversation.js'
import { openFrameSelectorModal, syncCharacterAvatarInGroups, syncCharacterNameInGroups } from './groups.js'
import { renderChatList } from './list.js'
import { renderGroupMemberSettings } from './settings.js'
import { showCustomConfirm } from '../dialogs/dialogs.js'
import { applyLyricsBarPosition } from '../music/player.js'
import { renderOfflinePresetSelector } from '../presets/presets.js'
import { closeStickerPicker, openStickerPicker } from '../stickers/stickers.js'
import { showScreen } from '../../app/routes'
import { controls } from '../runtime/state.js'
import { runtime } from '../runtime/state.js'

function selectedPromptBooks(picker) {
    return [...picker.querySelectorAll('[data-link-options] input:checked')].map(input => input.value);
}

function updatePromptLinkSummary(picker) {
    const checked = [...picker.querySelectorAll('[data-link-options] input:checked')];
    const summary = picker.querySelector('[data-link-summary]');
    summary.textContent = checked.length === 1 ? checked[0].labels[0].textContent :
        checked.length ? `${checked.length} linked` : 'No links';
}

function renderPromptLinkPicker(picker, books, linkedIds, emptyMessage) {
    const linked = new Set((linkedIds ?? []).map(String));
    const options = picker.querySelector('[data-link-options]');
    const rows = books.map(book => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = String(book.id);
        input.checked = linked.has(input.value);
        const name = document.createElement('span');
        name.textContent = book.name || 'Untitled book';
        label.append(input, name);
        return label;
    });
    options.replaceChildren(...rows);
    if (!rows.length) {
        const empty = document.createElement('p');
        empty.textContent = emptyMessage;
        options.append(empty);
    }
    updatePromptLinkSummary(picker);
}

export function bindChatSettingsEditor() {
  controls.chatSettingsModal = document.getElementById('chat-settings-modal')
  const worldInfoPicker = document.getElementById('chat-world-info-picker');
  const miniPromptsPicker = document.getElementById('chat-mini-prompts-picker');
  for (const picker of [worldInfoPicker, miniPromptsPicker]) {
    picker.addEventListener('change', () => updatePromptLinkSummary(picker));
  }

document.getElementById('chat-settings-btn').addEventListener('click', async () => {
            loadThemePresetsDropdown(); 
            if (!runtime.state.activeChatId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const isGroup = chat.isGroup;
            const characterDetails = document.getElementById('qq-character-details');
            characterDetails.hidden = Boolean(isGroup);
            characterDetails.open = false;
            document.getElementById('ai-avatar-preview').hidden = Boolean(isGroup);
            document.getElementById('group-avatar-preview').hidden = !isGroup;
            document.getElementById('chat-settings-contact-name').textContent = chat.name;
            document.getElementById('chat-settings-error').textContent = '';
            for (const disclosure of document.querySelectorAll('.chat-settings-body details')) disclosure.open = false;
            document.querySelector('.chat-settings-body').scrollTop = 0;
            const groupNai = document.getElementById('group-nai-settings-group');
            const singleNai = document.getElementById('nai-character-settings-group');
            groupNai.style.display = isGroup ? 'block' : 'none';
            singleNai.style.display = isGroup ? 'none' : 'block';
            const naiGroup = isGroup ? groupNai : singleNai;
            naiGroup.querySelectorAll('input[type="radio"]').forEach(input => {
                input.checked = input.value === (chat.settings.naiSettings?.promptSource ?? 'system');
            });
        
            
            
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
            document.getElementById('chat-character-features').hidden = isGroup;
            for (const [id, [key, fallback]] of Object.entries(chatFeatureSwitches)) {
                document.getElementById(id).checked = chat.settings[key] ?? fallback;
            }
            setLocationFields('chat-character-location', { location: chat.settings.characterLocation, timeZone: chat.settings.timeZone });
            setLocationFields('chat-user-location', { location: chat.settings.userLocation, timeZone: chat.settings.userTimeZone });
            document.getElementById('chat-holiday-dates').value = chat.settings.holidayDates || '';
            document.getElementById('chat-name-input').value = chat.name;
            document.getElementById('my-persona').value = chat.settings.myPersona;
            document.getElementById('my-avatar-preview').src = chat.settings.myAvatar || (isGroup ? runtime.defaultMyGroupAvatar : runtime.defaultAvatar);
            const bgPreview = document.getElementById('bg-preview');
            const removeBgBtn = document.getElementById('remove-bg-btn');
            if (chat.settings.background) {
                bgPreview.src = chat.settings.background;
                bgPreview.style.display = 'block';
                removeBgBtn.style.display = 'inline-block';
            } else {
                bgPreview.removeAttribute('src');
                bgPreview.style.display = 'none';
                removeBgBtn.style.display = 'none';
            }
            document.getElementById('lyrics-position-group').style.display = isGroup ? 'none' : 'block';

document.getElementById('single-char-background-activity-group').style.display = isGroup ? 'none' : 'block';
document.getElementById('group-background-activity-group').style.display = isGroup ? 'block' : 'none';




const timePerceptionToggle = document.getElementById('time-perception-toggle');
timePerceptionToggle.checked = chat.settings.enableTimePerception;


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
    document.getElementById('my-nickname-input').value = chat.settings.myNickname || 'You';
    const nicknameInput = document.getElementById('character-nickname-for-user');
    nicknameInput.defaultValue = chat.settings.characterNickname || '';
    nicknameInput.value = nicknameInput.defaultValue;
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
  
            
            
            const [miniPrompts, stickerCategories] = await Promise.all([
                runtime.db.worldBooks.toArray(),
                runtime.db.stickerCategories.toArray()
            ]);
            const stickerGroups = document.getElementById('chat-sticker-groups');
            const assigned = new Set((chat.settings.stickerCategoryIds || []).map(categoryKey));
            if (assigned.has('uncategorized') || runtime.state.userStickers.some(sticker => !sticker.categoryId)) {
                stickerCategories.push({ id: 'uncategorized', name: 'Uncategorized' });
            }
            const stickerOptions = stickerCategories.map(category => {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = categoryKey(category.id);
                checkbox.checked = assigned.has(checkbox.value);
                label.append(checkbox, category.name);
                return label;
            });
            stickerGroups.replaceChildren(...stickerOptions);
            if (!stickerOptions.length) stickerGroups.textContent = 'Create a group in the Stickers app to assign it here.';
        
            renderPromptLinkPicker(worldInfoPicker, getLoreBooks(), chat.settings.linkedLoreBookIds,
                'Create or import a lorebook in World Info to link it here.');
            renderPromptLinkPicker(miniPromptsPicker, miniPrompts, chat.settings.linkedWorldBookIds,
                'Create or import a book in Mini Prompts to link it here.');

            const themeRadio = [...document.querySelectorAll('input[name="theme-select"]')]
                .find(input => input.value === chat.settings.theme) ?? document.getElementById('theme-default');
            themeRadio.checked = true;
            const fontSizeSlider = document.getElementById('font-size-slider'); fontSizeSlider.value = chat.settings.fontSize || 13; document.getElementById('font-size-value').textContent = `${fontSizeSlider.value}px`;
            const customCssInput = document.getElementById('custom-css-input'); customCssInput.value = chat.settings.customCss || '';
            updateSettingsPreview();
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
    const notice = document.getElementById('chat-settings-error');
    notice.textContent = '';
    const invalid = (message, field, tab = 'Setup') => {
        document.querySelector('[data-settings-tab="' + tab + '"]').click();
        notice.textContent = message;
        if (field.closest('details')) field.closest('details').open = true;
        requestAnimationFrame(() => field.focus());
    };
    const current = runtime.state.chats[runtime.state.activeChatId];
    const chat = structuredClone(current);
    
    
    const oldOfflineModeState = chat.settings.isOfflineMode || false;

    
    const nameInput = document.getElementById('chat-name-input');
    const newName = nameInput.value.trim();
    if (!newName) return invalid('Enter a display name.', nameInput);
    if (!chat.isGroup && newName !== chat.name) {
        if (!chat.nameHistory) chat.nameHistory = [];
        if (!chat.nameHistory.includes(chat.name)) chat.nameHistory.push(chat.name);
    }
    chat.name = newName;
    const selectedThemeRadio = document.querySelector('input[name="theme-select"]:checked');
    chat.settings.theme = selectedThemeRadio ? selectedThemeRadio.value : 'default';
    chat.settings.fontSize = parseInt(document.getElementById('font-size-slider').value);
    chat.settings.customCss = document.getElementById('custom-css-input').value.trim();
    chat.settings.background = document.getElementById('bg-preview').getAttribute('src') || '';
    chat.settings.myPersona = document.getElementById('my-persona').value;
    chat.settings.myAvatar = document.getElementById('my-avatar-preview').src;
    
    chat.settings.linkedLoreBookIds = selectedPromptBooks(worldInfoPicker);
    const selectedMiniPrompts = selectedPromptBooks(miniPromptsPicker);
    chat.settings.linkedWorldBookIds = [...new Set([
        ...(chat.settings.linkedWorldBookIds ?? []).map(String).filter(id => selectedMiniPrompts.includes(id)),
        ...selectedMiniPrompts,
    ])];
    chat.settings.stickerCategoryIds = Array.from(
        document.querySelectorAll('#chat-sticker-groups input:checked'), checkbox => checkbox.value
    );
    
    chat.settings.enableTimePerception = document.getElementById('time-perception-toggle').checked;
    const characterLocation = readLocationFields('chat-character-location');
    const userLocation = readLocationFields('chat-user-location');
    chat.settings.timeZone = characterLocation.timeZone;
    chat.settings.userTimeZone = userLocation.timeZone;
    chat.settings.userLocation = userLocation.location;
    const sourceName = chat.isGroup ? 'group-nai-prompt-source' : 'nai-prompt-source';
    const promptSource = document.querySelector('input[name="' + sourceName + '"]:checked')?.value ?? 'system';
    chat.settings.naiSettings = { ...chat.settings.naiSettings, promptSource };
    
    if (chat.isGroup) {
        chat.settings.enableBackgroundActivity = document.getElementById('group-background-activity-switch').checked;
        chat.settings.myNickname = document.getElementById('my-group-nickname-input').value.trim();
        chat.settings.groupAvatar = document.getElementById('group-avatar-preview').src;
        chat.settings.actionCooldownMinutes = Math.max(1, parseInt(document.getElementById('group-action-cooldown-input').value) || 10);
    } else {
        const diaryCss = document.getElementById('chat-diary-css');
        if (diaryCss) chat.settings.diaryCss = diaryCss.value.trim();
        const holidayInput = document.getElementById('chat-holiday-dates');
        const holidayDates = holidayInput.value.trim();
        try { parseCalendarDates(holidayDates); } catch (error) { return invalid(error.message, holidayInput, 'Features'); }
        for (const [id, [key]] of Object.entries(chatFeatureSwitches)) {
            chat.settings[key] = document.getElementById(id).checked;
        }
        chat.settings.characterLocation = characterLocation.location;
        chat.settings.holidayDates = holidayDates;
        chat.settings.enableBackgroundActivity = document.getElementById('char-background-activity-switch').checked;
        const newOfflineModeState = document.getElementById('offline-mode-toggle').checked;
        chat.settings.isOfflineMode = newOfflineModeState;

        
        
        
        
        
        if (oldOfflineModeState === true && newOfflineModeState === false) {
            
            
            const switchInstruction = {
                role: 'system',
                content: '[System instruction: The chat is back in online mode. Return the online JSON array format, for example [{"type": "text", "content": "Hi"}].]',
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
        
        const characterNameInput = document.getElementById('ai-original-name-input');
        const newOriginalName = characterNameInput.value.trim();
        if (!newOriginalName) return invalid("Enter the character's name.", characterNameInput);
        chat.originalName = newOriginalName;
        chat.settings.aiPersona = document.getElementById('ai-persona').value;
        chat.settings.minimaxVoiceId = document.getElementById('ai-voice-id-input').value.trim();
chat.settings.enableTts = document.getElementById('enable-tts-switch').checked;
        chat.settings.aiAvatar = document.getElementById('ai-avatar-preview').src;
        chat.settings.myNickname = document.getElementById('my-nickname-input').value.trim() || 'You';
        chat.settings.actionCooldownMinutes = Math.max(1, parseInt(document.getElementById('ai-action-cooldown-input').value) || 10);
        chat.settings.lyricsPosition = {
            vertical: document.getElementById('lyrics-vertical-pos').value,
            horizontal: document.getElementById('lyrics-horizontal-pos').value,
            offset: parseInt(document.getElementById('lyrics-offset-input').value) || 10
        };
        const selectedGroupId = document.getElementById('assign-group-select').value;
        chat.groupId = selectedGroupId ? parseInt(selectedGroupId) : null;
    }

    const button = document.getElementById('save-chat-settings-btn');
    const nicknameInput = document.getElementById('character-nickname-for-user');
    const nicknameEdit = nicknameInput.value.trim() !== nicknameInput.defaultValue.trim() ? nicknameInput.value.trim() : undefined;
    button.disabled = true;
    try {
        await runtime.db.transaction('rw', runtime.db.chats, async tx => {
            const stored = await tx.chats.get(chat.id);
            if (!stored) throw new Error('This chat was deleted.');
            const changes = { name: chat.name, settings: chat.settings };
            if (!chat.isGroup) {
                const nickname = nicknameEdit ?? stored.settings?.characterNickname ?? current.settings.characterNickname;
                if (nickname === undefined) delete changes.settings.characterNickname;
                else changes.settings.characterNickname = nickname;
                Object.assign(changes, { originalName: chat.originalName, nameHistory: chat.nameHistory, groupId: chat.groupId });
                if (oldOfflineModeState && !chat.settings.isOfflineMode) changes.history = [...(stored.history ?? []), chat.history.at(-1)];
            }
            await tx.chats.update(chat.id, changes);
            Object.assign(chat, changes);
        });
        current.name = chat.name;
        current.settings = chat.settings;
        if (!chat.isGroup) {
            Object.assign(current, { originalName: chat.originalName, nameHistory: chat.nameHistory, groupId: chat.groupId });
            if (oldOfflineModeState && !chat.settings.isOfflineMode) current.history = chat.history;
        }
    } catch {
        notice.textContent = 'Could not save chat settings. Try again.';
        return;
    } finally {
        button.disabled = false;
    }
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

controls.setupFileUpload('bg-input', base64 => {
    const preview = document.getElementById('bg-preview');
    preview.src = base64;
    preview.style.display = 'block';
    document.getElementById('remove-bg-btn').style.display = 'inline-block';
    void updateSettingsPreview();
});

controls.setupFileUpload('preset-avatar-input', (base64) => document.getElementById('preset-avatar-preview').src = base64);

document.getElementById('remove-bg-btn').addEventListener('click', () => {
    const preview = document.getElementById('bg-preview');
    preview.removeAttribute('src');
    preview.style.display = 'none';
    document.getElementById('remove-bg-btn').style.display = 'none';
    void updateSettingsPreview();
});

controls.stickerPanel = document.getElementById('sticker-panel')

document.getElementById('open-sticker-panel-btn').addEventListener('click', () => {
    if (controls.stickerPanel.classList.contains('visible')) closeStickerPicker(true);
    else openStickerPicker();
});

document.getElementById('close-sticker-panel-btn').addEventListener('click', () => closeStickerPicker(true));
controls.stickerPanel.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeStickerPicker(true);
});

}
