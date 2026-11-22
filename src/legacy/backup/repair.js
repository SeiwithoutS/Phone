import { renderChatList } from '../chat/list.js'
import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export async function checkAndFixData() {
    const confirmed = await showCustomConfirm(
        "Confirm Repair",
        "Scan for saved characters missing from the chat list and repair the affected records? Export a backup before continuing.",
        { confirmText: '开始检查' }
    );

    if (!confirmed) return;

    await showCustomAlert("Please wait…", "Checking and repairing data…");

    try {
        const chatsFromDB = await runtime.db.chats.toArray();
        let fixedCount = 0;

        for (const chat of chatsFromDB) {
            let isModified = false;

            
            if (!Array.isArray(chat.history)) {
                chat.history = [];
                isModified = true;
            }
            
            if (typeof chat.settings !== 'object' || chat.settings === null) {
                chat.settings = {};
                isModified = true;
            }
            
            if (!chat.isGroup && !chat.originalName) {
                chat.originalName = chat.name;
                isModified = true;
            }
            
            if (typeof chat.unreadCount === 'undefined') {
                chat.unreadCount = 0;
                isModified = true;
            }
            
            if (!Array.isArray(chat.longTermMemory)) {
                chat.longTermMemory = [];
                isModified = true;
            }
            

            
            if (isModified) {
                fixedCount++;
                console.log(`修复了角色 "${chat.name}" (ID: ${chat.id}) 的残缺数据。`);
                await runtime.db.chats.put(chat);
            }
            
            
            runtime.state.chats[chat.id] = chat;
        }

        if (fixedCount > 0) {
            await showCustomAlert(
                "Repair Complete",
                `Repaired ${fixedCount} character records. The chat list has been refreshed.`
            );
            
            await renderChatList(); 
        } else {
            await showCustomAlert("Check Complete", "No issues found.");
        }

    } catch (error) {
        console.error("数据检查与修复失败:", error);
        await showCustomAlert("Operation Failed", `Data check failed: ${error.message}`);
    }
}
