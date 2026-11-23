import { normalizeWorldInfo } from '../../features/world-book/model'
import { showCustomAlert, showCustomConfirm, bindDialogDismissal } from '../dialogs/dialogs.js'
import { decodePortable } from '../../storage/portable'
import { runtime } from '../runtime/state.js'

export async function cleanupRedundantData() {
    const confirmed = await showCustomConfirm(
        "Clean Up Unused Data?",
        "Clean up orphaned posts, comments and memories linked to deleted characters? This is permanent. NPC data is kept.<br><br>Export a backup before continuing.",
        { confirmButtonClass: 'btn-danger', confirmText: "Confirm Cleanup" }
    );

    if (!confirmed) return;

    await showCustomAlert("Please wait…", "Cleaning up unused data…");
    console.log("冗余数据清理流程已启动...");

    let cleanupCounts = {
        posts: 0, likes: 0, comments: 0, memories: 0,
        callRecords: 0, groupMembers: 0, chatLinks: 0,
    };

    try {
        await runtime.db.transaction('rw', runtime.db.tables, async tx => {
            
            const allChats = await tx.chats.toArray();
            const allNpcs = await tx.npcs.toArray(); 

            const existingChatIds = new Set(allChats.map(c => c.id));
            const existingNpcIds = new Set(allNpcs.map(n => `npc_${n.id}`)); 

            const existingOriginalNames = new Set(allChats.filter(c => !c.isGroup).map(c => c.originalName));
            existingOriginalNames.add(runtime.state.qzoneSettings.nickname || '{{user}}');
            
            allNpcs.forEach(npc => existingOriginalNames.add(npc.name));

            
            for (const chat of allChats) {
                 let chatModified = false;
                 if (chat.isGroup && chat.members) {
                     const originalMemberCount = chat.members.length;
                     
                     
                     
                     chat.members = chat.members.filter(member => 
                        existingChatIds.has(member.id) || existingNpcIds.has(member.id)
                     );
                     
                     if (chat.members.length < originalMemberCount) {
                        cleanupCounts.groupMembers += (originalMemberCount - chat.members.length);
                        chatModified = true;
                     }
                 }
                 
                 if (chat.settings?.linkedMemoryChatIds?.length > 0) {
                     const originalLinkCount = chat.settings.linkedMemoryChatIds.length;
                     chat.settings.linkedMemoryChatIds = chat.settings.linkedMemoryChatIds.filter(id => existingChatIds.has(id));
                     if (chat.settings.linkedMemoryChatIds.length < originalLinkCount) {
                        cleanupCounts.chatLinks += (originalLinkCount - chat.settings.linkedMemoryChatIds.length);
                        chatModified = true;
                     }
                 }
                 if(chatModified) {
                     await tx.chats.put(chat);
                 }
            }

            
            const allPosts = await tx.qzonePosts.toArray();
            for (const post of allPosts) {
                let postModified = false;
                
                
                
                const isAuthorValid = post.authorId === 'user' || existingChatIds.has(post.authorId) || existingNpcIds.has(post.authorId);

                if (!isAuthorValid) {
                    await tx.qzonePosts.delete(post.id);
                    cleanupCounts.posts++;
                    continue; 
                }
                
                if (post.likes && post.likes.length > 0) {
                    const originalLikeCount = post.likes.length;
                    post.likes = post.likes.filter(name => existingOriginalNames.has(name));
                    if (post.likes.length < originalLikeCount) {
                        cleanupCounts.likes += (originalLikeCount - post.likes.length);
                        postModified = true;
                    }
                }
                if (post.comments && post.comments.length > 0) {
                    const originalCommentCount = post.comments.length;
                    post.comments = post.comments.filter(comment => {
                        if (typeof comment === 'object' && comment.commenterName) {
                            return existingOriginalNames.has(comment.commenterName);
                        }
                        return true; 
                    });
                     if (post.comments.length < originalCommentCount) {
                        cleanupCounts.comments += (originalCommentCount - post.comments.length);
                        postModified = true;
                    }
                }
                if (postModified) { await tx.qzonePosts.put(post); }
            }

            
            await tx.memories.where('chatId').noneOf([...existingChatIds]).delete().then(c => cleanupCounts.memories += c);
            await tx.callRecords.where('chatId').noneOf([...existingChatIds]).delete().then(c => cleanupCounts.callRecords += c);
        });

        let summary = "✅ 清理完成！\n\n";
        let cleanedSomething = false;
        Object.entries(cleanupCounts).forEach(([key, value]) => {
            if (value > 0) {
                const keyMap = {
                    posts: '动态', likes: '点赞', comments: '评论', memories: '记忆',
                    callRecords: '通话记录',
                    groupMembers: '群成员', chatLinks: '记忆链接'
                };
                summary += `- 清理了 ${value} 条无效的${keyMap[key] || key}。\n`;
                cleanedSomething = true;
            }
        });
        if (!cleanedSomething) {
            summary = "✅ 检查完成，未发现任何冗余数据。";
        }
        summary += "\n建议刷新页面以确保所有更改生效。";

        await showCustomAlert("Complete", summary);
        
        const confirmedReload = await showCustomConfirm("Reload EPhone?", "Reload to see the latest data.");
        if(confirmedReload) {
            location.reload();
        }

    } catch (error) {
        console.error("清理冗余数据时出错:", error);
        await showCustomAlert("Cleanup Failed", `An error occurred: ${error.message}`);
    }
}

const legacySingletons = new Set(['apiConfig', 'globalSettings', 'musicLibrary', 'qzoneSettings'])

function readBackup(data) {
    const wrapped = data?.data && Array.isArray(data.data.chats);
    const source = wrapped ? (data.version === 4 ? decodePortable(data.data) : data.data) : data;
    if (!Array.isArray(source?.chats)) throw new Error('This file is not an EPhone backup.');

    const records = new Map();
    for (const table of runtime.db.tables) {
        if (!Object.hasOwn(source, table.name)) continue;
        const value = source[table.name];
        if (Array.isArray(value)) records.set(table.name, value);
        else if (!wrapped && legacySingletons.has(table.name) && value && typeof value === 'object') {
            records.set(table.name, [{ ...value, id: value.id ?? 'main' }]);
        } else {
            throw new Error('Invalid backup table: ' + table.name);
        }
    }
    records.get('worldBooks')?.forEach(normalizeWorldInfo);
    return records;
}

export async function handleSmartImport(file) {
    if (!file) return;

    try {
        const tables = readBackup(JSON.parse(await file.text()));
        const confirmed = await showCustomConfirm(
            'Restore Backup?',
            'Restoring this backup will replace your current data. Continue?',
            { confirmButtonClass: 'btn-danger' }
        );
        if (!confirmed) return;
        const db = runtime.db;
        await db.transaction('rw', db.tables, async tx => {
            for (const table of tx.tables) {
                if (table.name === 'deviceSettings' && !tables.has(table.name)) continue;
                await table.clear();
                const records = tables.get(table.name);
                if (records?.length) await table.bulkPut(records);
            }
        });
        await showCustomAlert('Import Complete', 'Backup restored. EPhone will reload to display your data.');
        window.location.reload();
    } catch (error) {
        await showCustomAlert('Import Failed', 'Could not read or apply the file: ' + error.message);
    }
}

export function updateBackButtonUnreadCount() {
  const unreadChats = Object.values(runtime.state.chats).reduce((total, chat) =>
    chat.id === runtime.state.activeChatId ? total : total + (chat.unreadCount || 0), 0)
  const count = unreadChats + (runtime.unreadPostsCount || 0)
  const back = document.getElementById('back-to-list-btn')
  if (!back) return

  back.querySelector('.back-btn-indicator')?.remove()
  let indicator = back.querySelector('.unread-indicator')
  if (!indicator) {
    indicator = document.createElement('span')
    indicator.className = 'unread-indicator'
    back.appendChild(indicator)
  }
  indicator.textContent = count > 99 ? '99+' : String(count)
  indicator.style.display = count ? 'block' : 'none'
}

export function bindBackupSettingsEvents() {
  bindDialogDismissal();

document.getElementById('cleanup-data-btn').addEventListener('click', cleanupRedundantData);

document.getElementById('offline-mode-toggle').addEventListener('change', (e) => {
    
    document.getElementById('offline-mode-options').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-data-input').click());

document.getElementById('time-perception-toggle').addEventListener('change', (e) => {
        document.getElementById('time-zone-group').style.display = e.target.checked ? 'block' : 'none';
    });

document.getElementById('import-data-input').addEventListener('change', event => {
    const file = event.target.files[0];
    event.target.value = '';
    void handleSmartImport(file);
});
}
