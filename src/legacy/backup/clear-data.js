import { renderChatList } from '../chat/list.js'
import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'
import { loadAllDataFromDB } from '../storage/load.js'

export function openDataClearWizard() {
    const modal = document.getElementById('data-clear-wizard-modal');
    runtime.selectedCharsForClear = [];
    runtime.selectedTypesForClear = [];
    
    
    renderClearWizardStep1();
    
    
    document.getElementById('data-clear-step-1').style.display = 'flex';
    document.getElementById('data-clear-step-2').style.display = 'none';
    
    modal.classList.add('visible');
}

export function renderClearWizardStep1() {
    const listEl = document.getElementById('data-clear-char-list');
    listEl.innerHTML = '';

    
    const userItem = document.createElement('div');
    userItem.className = 'clear-posts-item';
    userItem.dataset.charId = 'user';
    userItem.innerHTML = `
        <div class="checkbox"></div>
        <span class="name">${runtime.state.qzoneSettings.nickname || '我'} (User)</span>
    `;
    listEl.appendChild(userItem);

    
    Object.values(runtime.state.chats).forEach(chat => {
        if (!chat.isGroup) {
            const charItem = document.createElement('div');
            charItem.className = 'clear-posts-item';
            charItem.dataset.charId = chat.id;
            charItem.innerHTML = `
                <div class="checkbox"></div>
                <span class="name">${chat.name} (Character)</span>
            `;
            listEl.appendChild(charItem);
        }
    });
}

export function renderClearWizardStep2() {
            const listEl = document.getElementById('data-clear-type-list');
            listEl.innerHTML = '';
            
            const dataTypes = [
                { id: 'chat', name: '聊天记录', description: '将清空选定角色的所有对话消息、曾用备注和你的昵称。' },
                { id: 'qzone', name: '动态与互动', description: '将清空选定角色的所有动态、评论和点赞。' },
                { id: 'calls', name: '通话记录', description: '将清空选定角色的所有通话记录。' },
                { id: 'thoughts', name: '心声', description: '将清空选定角色的心声和散记历史。' },
                { id: 'memories', name: '长期记忆', description: '将清空选定角色的所有长期记忆。' },
                { id: 'favorites', name: '收藏', description: '将清空收藏夹中所有与该角色相关的内容（如聊天、动态、日记等）。' },
                { id: 'cphone', name: 'Cphone数据 (CPhone)', description: '将清空角色的相册、QQ、浏览器、淘宝、日记、备忘录等所有模拟手机数据。' }
            ];

            dataTypes.forEach(type => {
                const item = document.createElement('div');
                item.className = 'clear-posts-item';
                item.dataset.typeId = type.id;
                item.innerHTML = `
                    <div class="checkbox"></div>
                    <div>
                        <span class="name">${type.name}</span>
                        <p style="font-size: 12px; color: #888; margin: 4px 0 0;">${type.description}</p>
                    </div>
                `;
                listEl.appendChild(item);
            });
        }

export function handleDataClearNext() {
    const selectedItems = document.querySelectorAll('#data-clear-char-list .clear-posts-item.selected');
    if (selectedItems.length === 0) {
        alert("Select at least one character.");
        return;
    }

    runtime.selectedCharsForClear = Array.from(selectedItems).map(item => item.dataset.charId);
    
    
    renderClearWizardStep2();
    document.getElementById('data-clear-step-1').style.display = 'none';
    document.getElementById('data-clear-step-2').style.display = 'flex';
}

export function handleDataClearBack() {
    document.getElementById('data-clear-step-2').style.display = 'none';
    document.getElementById('data-clear-step-1').style.display = 'flex';
    
    document.querySelectorAll('#data-clear-char-list .clear-posts-item').forEach(item => {
        if (runtime.selectedCharsForClear.includes(item.dataset.charId)) {
            item.classList.add('selected');
        }
    });
}

export async function handleConfirmDataClear() {
            const selectedItems = document.querySelectorAll('#data-clear-type-list .clear-posts-item.selected');
            if (selectedItems.length === 0) {
                alert("Select at least one data type.");
                return;
            }

            runtime.selectedTypesForClear = Array.from(selectedItems).map(item => item.dataset.typeId);

            const confirmed = await showCustomConfirm(
                "Confirm Cleanup",
                "Permanently delete the selected data?",
                { confirmButtonClass: 'btn-danger', confirmText: "Confirm Delete" }
            );

            if (!confirmed) return;
            
            await showCustomAlert("Please wait…", "Cleaning up selected data…");

            try {
                await runtime.db.transaction('rw', runtime.db.tables, async tx => {
                    for (const charId of runtime.selectedCharsForClear) {
                        for (const type of runtime.selectedTypesForClear) {
                            
                            if (type === 'chat') {
                                if (charId === 'user') {
                                    const allChats = await tx.chats.toArray();
                                    for (const chat of allChats) {
                                        chat.history = chat.history.filter(msg => msg.role !== 'user');
                                        for (const session of chat.chatSessions || []) {
                                            session.history = session.history.filter(msg => msg.role !== 'user');
                                            session.composerDraft = '';
                                        }
                                        await tx.chats.put(chat);
                                    }
                                } else {
                                    const chat = await tx.chats.get(charId);
                                    if (chat) {
                                        chat.history = [];
                                        chat.chatSessions = [];
                                        delete chat.conversationId;
                                        delete chat.conversationCreatedAt;
                                        chat.heartfeltVoice = '...';
                                        chat.randomJottings = '...';
                                        if (Array.isArray(chat.nameHistory)) {
                                            chat.nameHistory = [];
                                        }
                                        if (chat.settings) {
                                            chat.settings.myNickname = '我';
                                        }
                                        await tx.chats.put(chat);
                                    }
                                }
                            }

                            if (type === 'qzone') {
                                const authorId = (charId === 'user') ? 'user' : charId;
                                await tx.qzonePosts.where('authorId').equals(authorId).delete();
                            }

                            if (type === 'calls' && charId !== 'user') {
                                await tx.callRecords.where('chatId').equals(charId).delete();
                            }

                            if (type === 'thoughts' && charId !== 'user') {
                                const chat = await tx.chats.get(charId);
                                if (chat) {
                                    chat.thoughtsHistory = [];
                                    chat.heartfeltVoice = '...';
                                    chat.randomJottings = '...';
                                    await tx.chats.put(chat);
                                }
                            }

                            if (type === 'memories' && charId !== 'user') {
                                const chat = await tx.chats.get(charId);
                                if (chat) {
                                    chat.longTermMemory = [];
                                    await tx.chats.put(chat);
                                }
                            }
                            

                            if (type === 'favorites') {
                                if (charId === 'user') {

                                    await tx.favorites.where('type').equals('qzone_post').filter(fav => fav.content.authorId === 'user').delete();

                                    await tx.favorites.where('type').equals('chat_message').filter(fav => fav.content.role === 'user').delete();
                                } else {
  
                                    await tx.favorites.where('type').equals('chat_message').and(fav => fav.chatId === charId).delete();

                                    await tx.favorites.where('type').equals('qzone_post').filter(fav => fav.content.authorId === charId).delete();
  
                                    await tx.favorites.where('type').equals('char_diary').filter(fav => fav.content.characterId === charId).delete();
                                    await tx.favorites.where('type').equals('char_browser_article').filter(fav => fav.content.characterId === charId).delete();
                                    await tx.favorites.where('type').equals('char_memo').filter(fav => fav.content.characterId === charId).delete();
                                }
                            }


                            if (type === 'cphone' && charId !== 'user') {
                                const chat = await tx.chats.get(charId);
                                if (chat) {
                                    chat.simulatedAlbum = [];
                                    chat.simulatedConversations = [];
                                    chat.simulatedBrowserHistory = [];
                                    chat.simulatedTaobaoHistory = null;
                                    chat.simulatedAmapHistory = [];
                                    chat.simulatedAppUsage = [];
                                    chat.simulatedMusicPlaylist = [];
                                    chat.diary = [];
                                    chat.memos = [];
                                    await tx.chats.put(chat);
                                }
                            }
                        }
                    }
                });
                
                await loadAllDataFromDB();
                await renderChatList();
                
                document.getElementById('data-clear-wizard-modal').classList.remove('visible');
                await showCustomAlert("Cleanup Complete", "Selected data was cleared.");

            } catch (error) {
                console.error("高级数据清理失败:", error);
                await showCustomAlert("Cleanup Failed", `Operation failed: ${error.message}`);
            }
        }
