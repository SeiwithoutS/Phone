import { assignedStickers, categoryKey } from '../../features/stickers/library'
import { imageSource } from '../../runtime/files'
import { sendSticker } from '../chat/messages.js'
import { showCustomAlert } from '../dialogs/dialogs.js'
import { controls, runtime } from '../runtime/state.js'
import { loadMoreThoughts } from '../character-phone/profile.js'
import { loadMoreMessages } from '../chat/conversation.js'
import { loadMoreQzonePosts } from '../qzone/feed.js'

function groupStickers(chat, member) {
    return [...assignedStickers(runtime.state.userStickers, runtime.state.chats[member?.id]),
        ...assignedStickers(runtime.state.userStickers, chat)];
}

function stickersForPicker(chat) {
    if (!chat?.isGroup) return assignedStickers(runtime.state.userStickers, chat);
    const assigned = new Set(assignedStickers(runtime.state.userStickers, chat));
    for (const member of chat.members ?? []) {
        for (const sticker of assignedStickers(runtime.state.userStickers, runtime.state.chats[member.id])) assigned.add(sticker);
    }
    return [...assigned];
}

export function openStickerPicker() {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    runtime.activeStickerCategoryId = stickersForPicker(chat).length ? 'assigned' : 'all';
    document.getElementById('sticker-search-input').value = '';
    controls.stickerPanel.classList.add('visible');
    document.getElementById('open-sticker-panel-btn').setAttribute('aria-expanded', 'true');
    document.getElementById('close-sticker-panel-btn').focus();
    void renderStickerPanel();
}

export function closeStickerPicker(restoreFocus = false) {
    controls.stickerPanel?.classList.remove('visible');
    const button = document.getElementById('open-sticker-panel-btn');
    button?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button?.focus();
}

export async function renderStickerPanel(rerenderTabs = true) {
    const grid = document.getElementById('sticker-grid');
    const tabs = document.getElementById('sticker-category-tabs');
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (rerenderTabs) {
        const categories = await runtime.db.stickerCategories.toArray();
        const entries = [{ id: 'all', name: 'All' }, { id: 'assigned', name: 'For this chat' },
            ...categories, { id: 'uncategorized', name: 'Uncategorized' }];
        tabs.replaceChildren(...entries.map(category => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'sticker-category-tab';
            button.dataset.categoryId = String(category.id);
            button.textContent = category.name;
            return button;
        }));
    }
    if (runtime.state.chats[runtime.state.activeChatId] !== chat) return;
    const category = String(runtime.activeStickerCategoryId);
    for (const tab of tabs.children) {
        const active = tab.dataset.categoryId === category;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', String(active));
    }
    const needle = document.getElementById('sticker-search-input').value.trim().toLowerCase();
    const candidates = category === 'assigned' ? stickersForPicker(chat) : runtime.state.userStickers;
    const items = [];
    for (const sticker of candidates) {
        if (category !== 'all' && category !== 'assigned' && categoryKey(sticker.categoryId) !== category) continue;
        if (!sticker.name.toLowerCase().includes(needle)) continue;
        const source = imageSource(sticker.url);
        if (!source) continue;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sticker-item';
        item.setAttribute('aria-label', 'Send sticker: ' + sticker.name);
        const image = document.createElement('img');
        image.className = 'sticker-image-container';
        image.src = source;
        image.alt = '';
        image.loading = 'lazy';
        const name = document.createElement('span');
        name.className = 'sticker-name';
        name.textContent = sticker.name;
        item.append(image, name);
        item.onclick = async () => {
            if (runtime.state.chats[runtime.state.activeChatId] !== chat) return;
            item.disabled = true;
            try { await sendSticker(sticker); }
            catch { await showCustomAlert('Sticker could not be sent', 'Try again.'); }
            finally { item.disabled = false; }
        };
        items.push(item);
    }
    if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'sticker-picker-empty';
        empty.textContent = 'No stickers match this view.';
        items.push(empty);
    }
    grid.replaceChildren(...items);
}

export function findStickerForChat(chat, name, sender) {
    if (!chat?.isGroup) return assignedStickers(runtime.state.userStickers, chat).find(sticker => sticker.name === name);
    const member = chat.members?.find(person => [person.originalName, person.groupNickname, person.id].includes(sender));
    return groupStickers(chat, member).find(sticker => sticker.name === name);
}

function stickerList(stickers) {
    return [...new Set(stickers.map(sticker => sticker.name))].map(name => '- ' + name).join('\n');
}

export function getStickerContextForPrompt(chat) {
    const list = stickerList(assignedStickers(runtime.state.userStickers, chat));
    return list ? '\n# Available stickers\nTo send a sticker, use type "sticker" and one of these exact names as meaning:\n' + list + '\n' : '';
}

export function getGroupStickerContextForPrompt(chat) {
    if (!chat?.isGroup) return '';
    const lists = [];
    for (const member of chat.members ?? []) {
        if (member.id === 'user') continue;
        const list = stickerList(groupStickers(chat, member));
        if (list) lists.push('## ' + (member.groupNickname || member.originalName || member.id) + '\n' + list);
    }
    return lists.length ? '\n# Available stickers by group member\nUse only exact sticker names for the sender.\n' + lists.join('\n') + '\n' : '';
}

export function bindStickerEvents() {
    document.getElementById('sticker-category-tabs').addEventListener('click', event => {
        const tab = event.target.closest('.sticker-category-tab');
        if (!tab) return;
        runtime.activeStickerCategoryId = tab.dataset.categoryId;
        document.getElementById('sticker-search-input').value = '';
        void renderStickerPanel(false);
    });
    document.getElementById('sticker-search-input').addEventListener('input', () => void renderStickerPanel(false));

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
