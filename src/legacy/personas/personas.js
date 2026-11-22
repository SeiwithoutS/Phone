import { addLongPressListener, showCustomConfirm } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export function openPersonaLibrary() { renderPersonaLibrary(); runtime.personaLibraryModal.classList.add('visible'); }

export function closePersonaLibrary() { runtime.personaLibraryModal.classList.remove('visible'); }

export function renderPersonaLibrary() { const grid = document.getElementById('persona-library-grid'); grid.innerHTML = ''; if (runtime.state.personaPresets.length === 0) { grid.innerHTML = "<p style=\"color: var(--text-secondary); grid-column: 1 / -1; text-align: center; margin-top: 20px;\">Use Add to create your first persona.</p>"; return; } runtime.state.personaPresets.forEach(preset => { const item = document.createElement('div'); item.className = 'persona-preset-item'; item.style.backgroundImage = `url(${preset.avatar})`; item.dataset.presetId = preset.id; item.addEventListener('click', () => applyPersonaPreset(preset.id)); addLongPressListener(item, () => showPresetActions(preset.id)); grid.appendChild(item); }); }

export function showPresetActions(presetId) { runtime.editingPersonaPresetId = presetId; runtime.presetActionsModal.classList.add('visible'); }

export function hidePresetActions() { runtime.presetActionsModal.classList.remove('visible'); runtime.editingPersonaPresetId = null; }

export function applyPersonaPreset(presetId) { const preset = runtime.state.personaPresets.find(p => p.id === presetId); if (preset) { document.getElementById('my-avatar-preview').src = preset.avatar; document.getElementById('my-persona').value = preset.persona; } closePersonaLibrary(); }

export function openPersonaEditorForCreate() { runtime.editingPersonaPresetId = null; document.getElementById('persona-editor-title').textContent = "Add Persona Preset"; document.getElementById('preset-avatar-preview').src = runtime.defaultAvatar; document.getElementById('preset-persona-input').value = ''; runtime.personaEditorModal.classList.add('visible'); }

export function openPersonaEditorForEdit() { const preset = runtime.state.personaPresets.find(p => p.id === runtime.editingPersonaPresetId); if (!preset) return; document.getElementById('persona-editor-title').textContent = "Edit Persona Preset"; document.getElementById('preset-avatar-preview').src = preset.avatar; document.getElementById('preset-persona-input').value = preset.persona; runtime.presetActionsModal.classList.remove('visible'); runtime.personaEditorModal.classList.add('visible'); }

export async function deletePersonaPreset() { const confirmed = await showCustomConfirm("Delete Preset", "Permanently delete this persona preset?", { confirmButtonClass: 'btn-danger' }); if (confirmed && runtime.editingPersonaPresetId) { await runtime.db.personaPresets.delete(runtime.editingPersonaPresetId); runtime.state.personaPresets = runtime.state.personaPresets.filter(p => p.id !== runtime.editingPersonaPresetId); hidePresetActions(); renderPersonaLibrary(); } }

export function closePersonaEditor() { runtime.personaEditorModal.classList.remove('visible'); runtime.editingPersonaPresetId = null; }

export async function savePersonaPreset() { const avatar = document.getElementById('preset-avatar-preview').src; const persona = document.getElementById('preset-persona-input').value.trim(); if (avatar === runtime.defaultAvatar && !persona) { alert("Add an avatar or a persona description."); return; } if (runtime.editingPersonaPresetId) { const preset = runtime.state.personaPresets.find(p => p.id === runtime.editingPersonaPresetId); if (preset) { preset.avatar = avatar; preset.persona = persona; await runtime.db.personaPresets.put(preset); } } else { const newPreset = { id: 'preset_' + Date.now(), avatar: avatar, persona: persona }; await runtime.db.personaPresets.add(newPreset); runtime.state.personaPresets.push(newPreset); } renderPersonaLibrary(); closePersonaEditor(); }
