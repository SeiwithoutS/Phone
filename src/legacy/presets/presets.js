import { defaultPromptEntries, readTavernPreset } from '../../features/presets/prompt-order'
import { escapeHtml } from '../../runtime/files'
import { collectionCard, importPromptCollection } from '../world-book/collection-actions.js'
import { showCustomAlert, showCustomPrompt } from '../dialogs/dialogs.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'

export async function openPresetScreen() {
    showScreen('preset-screen');
}

export async function renderPresetScreen() {
    const presets = await runtime.db.presets.toArray();
    runtime.state.presets = presets;
    const container = document.getElementById('preset-content-container');
    const cards = presets.map(preset => {
        const count = Array.isArray(preset.content) ? preset.content.length : 0;
        return collectionCard('presets', preset, count + (count === 1 ? ' entry' : ' entries'), openPresetEditor, renderPresetScreen);
    });
    container.replaceChildren(...cards);
    if (!cards.length) {
        const empty = document.createElement('p');
        empty.className = 'phone-app-muted';
        empty.textContent = 'Use the plus button to create your first preset.';
        container.append(empty);
    }
}

export function openPresetEditor(presetId) {
    showScreen('preset-editor-screen', { bookId: presetId });
}

export async function handlePresetImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        if (!file.name.endsWith('.json')) {
            throw new Error("文件格式不支持。请选择 .json 格式的 Tavern 预设文件。");
        }
        
        const text = await file.text();
        const tavernData = JSON.parse(text.replace(/^\uFEFF/, ''));
        if (await importPromptCollection('presets', tavernData)) {
            await renderPresetScreen();
            return;
        }
        
        
        await importTavernPresetFile(tavernData, file.name);

    } catch (error) {
        console.error("预设导入失败:", error);
        await showCustomAlert("Import Failed", `Could not read the preset file. Error: ${escapeHtml(String(error.message))}`);
    } finally {
        
        event.target.value = null;
    }
}

export async function importTavernPresetFile(tavernData, fileName) {
    const content = readTavernPreset(tavernData);
    if (!content.length) throw new Error('The preset file has no valid prompt entries.');
    const name = await showCustomPrompt('Import SillyTavern Preset', 'Name this prompt preset', fileName.replace(/\.json$/i, ''));
    if (!name?.trim()) return;
    await runtime.db.presets.add({ id: crypto.randomUUID(), name: name.trim(), content });
    await renderPresetScreen();
    await showCustomAlert('Import Complete', 'Imported preset "' + escapeHtml(name.trim()) + '".');
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

window.openPresetScreen = openPresetScreen;

document.getElementById('add-preset-btn').addEventListener('click', async () => {
            const name = await showCustomPrompt("Create Preset", "Enter a preset name");
            if (name && name.trim()) {
                const newPreset = { id: 'preset_' + Date.now(), name: name.trim(), content: defaultPromptEntries };
                await runtime.db.presets.add(newPreset);
                await renderPresetScreen();
                openPresetEditor(newPreset.id);
            }
        });


}
