import { switchToCharScreen } from './launcher.js'
import { addLongPressListener, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export async function viewMemo(memoId) {
    const char = runtime.state.chats[runtime.activeCharacterId];
    if (!char || !char.memos) return;

    const memo = char.memos.find(m => m.id === memoId);
    if (memo) {
        
        runtime.activeMemoForViewing = memo; 

        const titleEl = document.getElementById('char-memo-detail-title');
        const contentEl = document.getElementById('char-memo-detail-content');
        const favBtn = document.getElementById('favorite-memo-btn');

        if (titleEl) titleEl.textContent = memo.title;
        if (contentEl) contentEl.value = memo.content;
        
        
        const existingFavorite = await runtime.db.favorites.where({ type: 'char_memo', 'content.id': memoId }).first();
        favBtn.classList.toggle('active', !!existingFavorite);

        switchToCharScreen('char-memo-detail-screen');
    }
}

export function renderCharMemoList() {
    const listEl = document.getElementById('char-memo-list');
    listEl.innerHTML = '';
    const char = runtime.state.chats[runtime.activeCharacterId];
    const memos = (char.memos || []).slice().reverse();

    if (memos.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No notes yet.</p>";
        return;
    }

    memos.forEach(memo => {
        const item = document.createElement('div');
        
        item.className = 'list-item'; 
        item.innerHTML = `
            <div class="item-title">${memo.title}</div>
            <div class="item-content">${(memo.content || '').split('\n')[0]}</div>
        `;
        
        item.addEventListener('click', () => viewMemo(memo.id));
        addLongPressListener(item, () => deleteMemo(memo.id));
        listEl.appendChild(item);
    });
}

export async function openMemoEditor(memoId = null) {
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;
    const memo = chat.memos?.find(item => item.id === memoId);
    const title = await showCustomPrompt(memo ? 'Edit Note' : 'New Note', 'Enter a title', memo?.title ?? '');
    if (!title?.trim()) return;
    const content = await showCustomPrompt(title.trim(), 'Write your note', memo?.content ?? '', 'textarea');
    if (content === null) return;

    const updated = { id: memo?.id ?? Date.now(), title: title.trim(), content };
    const memos = memo ? chat.memos.map(item => item.id === memoId ? updated : item) : [...(chat.memos ?? []), updated];
    await runtime.db.chats.put({ ...chat, memos });
    chat.memos = memos;
    renderCharMemoList();
    switchToCharScreen('char-memo-screen');
}

async function deleteMemo(memoId) {
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat?.memos?.some(item => item.id === memoId)) return;
    if (!(await showCustomConfirm('Delete Note', 'Delete this note?'))) return;

    const memos = chat.memos.filter(item => item.id !== memoId);
    await runtime.db.transaction('rw', runtime.db.chats, runtime.db.favorites, async tx => {
        await tx.chats.put({ ...chat, memos });
        await tx.favorites.where({ type: 'char_memo', 'content.id': memoId }).delete();
    });
    chat.memos = memos;
    renderCharMemoList();
}

export async function toggleMemoFavorite() {
    
    if (!runtime.activeMemoForViewing || !runtime.activeCharacterId) return;

    const memo = runtime.activeMemoForViewing;
    const char = runtime.state.chats[runtime.activeCharacterId];
    const favBtn = document.getElementById('favorite-memo-btn');

    
    const existingFavorite = await runtime.db.favorites.where({ type: 'char_memo', 'content.id': memo.id }).first();

    if (existingFavorite) {
        
        await runtime.db.favorites.delete(existingFavorite.id);
        favBtn.classList.remove('active'); 
        await showCustomAlert("Complete", "Removed from Favorites.");
    } else {
        
        const newFavorite = {
            type: 'char_memo',
            
            content: {
                id: memo.id,
                title: memo.title,
                content: memo.content,
                timestamp: memo.timestamp,
                characterId: runtime.activeCharacterId,
                characterName: char.name
            },
            timestamp: Date.now() 
        };
        await runtime.db.favorites.add(newFavorite);
        favBtn.classList.add('active'); 
        await showCustomAlert("Complete", "Added to Favorites.");
    }
}

export async function renderCharSimulatedQQ() {
    const listEl = document.getElementById('char-chat-list');
    listEl.innerHTML = '';
    const char = runtime.state.chats[runtime.activeCharacterId];
    if (!char) return;

    
    const userDisplayName = char.settings.myNickname || (runtime.state.qzoneSettings.nickname || '我');
    const lastRealMessage = char.history.filter(m => !m.isHidden).slice(-1)[0] || { content: '...' };
    
    
    let lastMsgContent = '...';
    if (lastRealMessage) {
        if (typeof lastRealMessage.content === 'string') {
            lastMsgContent = lastRealMessage.content;
        } else if (Array.isArray(lastRealMessage.content) && lastRealMessage.content[0]?.type === 'image_url') {
            lastMsgContent = '[图片]';
        } else if (lastRealMessage.type) {
            const typeMap = { 'voice_message': '[语音]', 'transfer': '[转账]', 'ai_image': '[图片]' };
            lastMsgContent = typeMap[lastRealMessage.type] || `[${lastRealMessage.type}]`;
        }
    }

    
    const myAvatar = char.settings.myAvatar || runtime.defaultAvatar;
    const myFrame = char.settings.myAvatarFrame || '';
    let avatarHtml;
    if (myFrame) {
        avatarHtml = `<div class="avatar-group has-frame" style="width: 45px; height: 45px;"><div class="avatar-with-frame" style="width: 45px; height: 45px;"><img src="${myAvatar}" class="avatar-img" style="border-radius: 50%;"><img src="${myFrame}" class="avatar-frame"></div></div>`;
    } else {
        avatarHtml = `<div class="avatar-group" style="width: 45px; height: 45px;"><img src="${myAvatar}" class="avatar" style="border-radius: 50%; width: 45px; height: 45px;"></div>`;
    }

    const userChatItem = document.createElement('div');
    userChatItem.className = 'chat-list-item';
    
    userChatItem.dataset.conversationIndex = "-1"; 
    userChatItem.innerHTML = `
        ${avatarHtml}
        <div class="info">
            <div class="name-line">
                <span class="name">${userDisplayName}</span>
            </div>
            <div class="last-msg">${String(lastMsgContent).substring(0, 20)}...</div>
        </div>
    `;
    listEl.appendChild(userChatItem);
    

    const allNpcs = await runtime.db.npcs.toArray();
    const npcMap = new Map(allNpcs.map(npc => [npc.name, npc]));
    const conversations = char.simulatedConversations || [];

    if (conversations.length === 0 && !userChatItem) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">Select Regenerate.<br>Generate recent conversations for this character.</p>";
        return;
    }

    conversations.forEach((convo, index) => {
        
        if (convo.type === 'private_user') {
            return;
        }
        

        const item = document.createElement('div');
        item.className = 'chat-list-item';
        item.dataset.conversationIndex = index;

        let lastMessage, avatarHtml, displayName;
        
        if (convo.type === 'group') {
            displayName = convo.groupName + ` <span class="group-tag">Group</span>`;
            lastMessage = convo.messages.slice(-1)[0] || { content: '...' };
            const groupAvatarPrompt = `logo, simple, flat design, for a group chat named '${convo.groupName}'`;
            const avatarUrl = runtime.state.globalSettings.enableAiDrawing ? `https://image.pollinations.ai/prompt/${encodeURIComponent(groupAvatarPrompt)}` : runtime.defaultGroupAvatar;
            avatarHtml = `<div class="avatar-group"><img src="${avatarUrl}" class="avatar" style="border-radius: 50%;"></div>`;
        
        } else { 
            displayName = convo.participant.name;
            lastMessage = convo.messages.slice(-1)[0] || { content: '...' };
            const npcData = npcMap.get(displayName);
            let avatarUrl = (npcData && npcData.avatar) ? npcData.avatar : 
                (runtime.state.globalSettings.enableAiDrawing ? `https://image.pollinations.ai/prompt/${encodeURIComponent(convo.participant.avatar_prompt || 'anime person')}` : runtime.defaultGroupMemberAvatar);
            avatarHtml = `<div class="avatar-group"><img src="${avatarUrl}" class="avatar" style="border-radius: 50%;"></div>`;
        }

        let lastMsgContent = '...';
        if (lastMessage && lastMessage.content) {
            lastMsgContent = lastMessage.content;
        }
        
        item.innerHTML = `
            ${avatarHtml}
            <div class="info">
                <div class="name-line">
                    <span class="name">${displayName}</span>
                </div>
                <div class="last-msg">${String(lastMsgContent).substring(0, 20)}...</div>
            </div>
        `;
        listEl.appendChild(item);
    });
}
