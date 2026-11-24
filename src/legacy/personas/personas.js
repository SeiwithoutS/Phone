import { readLocationFields, setLocationFields } from '../../features/chat/LocationFields'
import { addLongPressListener, showCustomConfirm } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export function openPersonaLibrary() { renderPersonaLibrary(); runtime.personaLibraryModal.classList.add('visible'); }

export function closePersonaLibrary() { runtime.personaLibraryModal.classList.remove('visible'); }

export function renderPersonaLibrary() { const grid = document.getElementById('persona-library-grid'); grid.innerHTML = ''; if (runtime.state.personaPresets.length === 0) { grid.innerHTML = "<p style=\"color: var(--text-secondary); grid-column: 1 / -1; text-align: center; margin-top: 20px;\">Use Add to create your first persona.</p>"; return; } runtime.state.personaPresets.forEach(preset => { const item = document.createElement('div'); item.className = 'persona-preset-item'; item.style.backgroundImage = `url(${preset.avatar})`; item.dataset.presetId = preset.id; item.addEventListener('click', () => applyPersonaPreset(preset.id)); addLongPressListener(item, () => showPresetActions(preset.id)); grid.appendChild(item); }); }

export function showPresetActions(presetId) { runtime.editingPersonaPresetId = presetId; runtime.presetActionsModal.classList.add('visible'); }

export function hidePresetActions() { runtime.presetActionsModal.classList.remove('visible'); runtime.editingPersonaPresetId = null; }

export function applyPersonaPreset(presetId) { const preset = runtime.state.personaPresets.find(p => p.id === presetId); if (preset) { document.getElementById('my-avatar-preview').src = preset.avatar || runtime.defaultAvatar; document.getElementById('my-persona').value = preset.persona; if (preset.name) {
    const isGroup = runtime.state.chats[runtime.state.activeChatId]?.isGroup;
    document.getElementById(isGroup ? 'my-group-nickname-input' : 'my-nickname-input').value = preset.name;
} setLocationFields('chat-user-location', preset); } closePersonaLibrary(); }

export function openPersonaEditorForCreate() { runtime.editingPersonaPresetId = null; document.getElementById('persona-editor-title').textContent = "Add Persona Preset"; document.getElementById('preset-avatar-preview').src = runtime.defaultAvatar; document.getElementById('preset-persona-input').value = ''; setLocationFields('preset-user-location', {}); runtime.personaEditorModal.classList.add('visible'); }

export function openPersonaEditorForEdit() { const preset = runtime.state.personaPresets.find(p => p.id === runtime.editingPersonaPresetId); if (!preset) return; document.getElementById('persona-editor-title').textContent = "Edit Persona Preset"; document.getElementById('preset-avatar-preview').src = preset.avatar || runtime.defaultAvatar; document.getElementById('preset-persona-input').value = preset.persona; setLocationFields('preset-user-location', preset); runtime.presetActionsModal.classList.remove('visible'); runtime.personaEditorModal.classList.add('visible'); }

export async function deletePersonaPreset() { const confirmed = await showCustomConfirm("Delete Preset", "Permanently delete this persona preset?", { confirmButtonClass: 'btn-danger' }); if (confirmed && runtime.editingPersonaPresetId) { await runtime.db.personaPresets.delete(runtime.editingPersonaPresetId); runtime.state.personaPresets = runtime.state.personaPresets.filter(p => p.id !== runtime.editingPersonaPresetId); hidePresetActions(); renderPersonaLibrary(); window.dispatchEvent(new Event("eephone:personas")); } }

export function closePersonaEditor() { runtime.personaEditorModal.classList.remove('visible'); runtime.editingPersonaPresetId = null; }

export async function savePersonaPreset() {
    const avatar = document.getElementById('preset-avatar-preview').src;
    const persona = document.getElementById('preset-persona-input').value.trim();
    const location = readLocationFields('preset-user-location');
    if (avatar === runtime.defaultAvatar && !persona && !location.location && !location.timeZone) {
        alert('Add an avatar, description, or location.');
        return;
    }
    const current = runtime.state.personaPresets.find(preset => preset.id === runtime.editingPersonaPresetId);
    const next = { id: current?.id ?? crypto.randomUUID(), ...current, avatar, persona, ...location };
    await runtime.db.personaPresets.put(next);
    if (current) Object.assign(current, next);
    else runtime.state.personaPresets.push(next);
    renderPersonaLibrary();
    closePersonaEditor();
    window.dispatchEvent(new Event('eephone:personas'));
}
