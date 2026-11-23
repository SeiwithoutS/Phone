import { downloadJson, escapeHtml } from '../../runtime/files'
import { createIconButton } from '../../components/icons'
import { normalizeWorldInfo } from '../../features/world-book/model'
import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

const collections = {
    worldBooks: { label: 'Mini Prompt', type: 'EPhoneMiniPrompt', categories: 'worldBookCategories', setting: 'linkedWorldBookIds' },
    presets: { label: 'Preset', type: 'EPhonePreset', categories: 'presetCategories', setting: 'offlinePresetId' },
};

export function collectionCard(table, item, preview, category, edit, refresh) {
    const settings = collections[table];
    const card = document.createElement('article');
    card.className = 'world-book-card collection-card';
    const title = document.createElement('strong');
    title.className = 'card-title';
    title.textContent = item.name;
    const summary = document.createElement('span');
    summary.className = 'card-content-preview';
    summary.textContent = preview;
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'collection-open';
    open.append(title, summary);
    open.onclick = () => edit(item.id);
    const actions = document.createElement('div');
    actions.className = 'collection-actions';
    const button = (text, action) => {
        const control = createIconButton(text === 'Delete' ? 'trash' : 'download', text + ' ' + item.name);
        if (text === 'Delete') control.classList.add('collection-delete');
        control.onclick = action;
        return control;
    };
    actions.append(button('Export', () => downloadJson({ type: settings.type, version: 1,
        name: item.name, category: category?.name, content: normalizeWorldInfo({ ...item }).content }, item.name + '-' + settings.type)),
    button('Delete', async () => {
        if (!await showCustomConfirm('Delete ' + settings.label, `Delete “${escapeHtml(String(item.name))}” and all its entries?`, { confirmButtonClass: 'btn-danger' })) return;
        try {
            await deletePromptCollection(table, item.id);
            await refresh();
        } catch (error) {
            await showCustomAlert('Delete failed', escapeHtml(String(error.message)));
        }
    }));
    card.append(open, actions);
    return card;
}

async function deletePromptCollection(table, id) {
    const { setting } = collections[table];
    const updates = await runtime.db.transaction('rw', runtime.db[table], runtime.db.chats, async tx => {
        await tx[table].delete(id);
        const changes = [];
        for (const chat of await tx.chats.toArray()) {
            const value = chat.settings?.[setting];
            const next = Array.isArray(value) ? value.filter(item => item !== id) : value === id ? null : value;
            if (Array.isArray(value) ? value.length === next.length : next === value) continue;
            await tx.chats.update(chat.id, { settings: { ...chat.settings, [setting]: next } });
            changes.push([chat.id, next]);
        }
        return changes;
    });
    for (const [chatId, value] of updates) {
        const chat = runtime.state.chats[chatId];
        if (chat) chat.settings[setting] = value;
    }
}

export async function importPromptCollection(table, data) {
    const { type, categories } = collections[table];
    if (data?.type !== type) return false;
    if (data.version !== 1 || typeof data.name !== 'string' || !data.name.trim() || !Array.isArray(data.content) ||
        !data.content.every(entry => entry && typeof entry.content === 'string')) throw new Error('Invalid collection JSON.');
    await runtime.db.transaction('rw', runtime.db[table], runtime.db[categories], async tx => {
        const name = typeof data.category === 'string' ? data.category.trim() : '';
        const existing = name ? await tx[categories].where('name').equalsIgnoreCase(name).first() : undefined;
        const categoryId = name ? existing?.id ?? await tx[categories].add({ name }) : null;
        const book = normalizeWorldInfo({ id: crypto.randomUUID(), name: data.name.trim(), categoryId, content: data.content });
        await tx[table].add(book);
    });
    return true;
}
