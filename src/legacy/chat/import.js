import { renderChatInterface } from './conversation.js'
import { renderChatList } from './list.js'
import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'


export async function exportSingleChat() {
    if (!runtime.state.activeChatId) return;
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return;

    try {
        const backupData = {
            type: 'EPhoneSingleChat', 
            version: 1,
            chatData: chat
        };

        const blob = new Blob(
            [JSON.stringify(backupData, null, 2)], 
            { type: 'application/json' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        link.download = `EPhone-Chat-${chat.name}-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        await showCustomAlert("Export Complete", `Chat history with ΓÇ£${chat.name}ΓÇ¥ exported.`);

    } catch (error) {
        console.error("σ»╝σç║σìòΣ╕¬Φüèσñ⌐µù╢σç║ΘöÖ:", error);
        await showCustomAlert("Export Failed", `An error occurred: ${error.message}`);
    }
}

export async function importSingleChat(file) {
    if (!file || !runtime.state.activeChatId) return;
    const currentChatId = runtime.state.activeChatId;
    const currentChat = runtime.state.chats[currentChatId];

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        
        if (data.type !== 'EPhoneSingleChat' || !data.chatData) {
            throw new Error("µûçΣ╗╢µá╝σ╝ÅΣ╕ìµ¡úτí«∩╝îΦ┐ÖΣ╕ìµÿ»Σ╕ÇΣ╕¬µ£ëµòêτÜäσìòΦüèσñçΣ╗╜µûçΣ╗╢πÇé");
        }

        
        const confirmed = await showCustomConfirm(
            "Restore Backup?",
            `Restore the backup and replace the chat history and settings for ΓÇ£${currentChat.name}ΓÇ¥?`,
            { confirmButtonClass: 'btn-danger', confirmText: 'τí«Φ«ñΦªåτ¢û' }
        );

        if (!confirmed) return;

        
        const importedChatData = data.chatData;
        
        
        importedChatData.id = currentChatId; 
        
        
        await runtime.db.chats.put(importedChatData);
        runtime.state.chats[currentChatId] = importedChatData;

        
        await showCustomAlert("Import Complete", "Chat history restored. Refreshing the screenΓÇª");
        
        
        renderChatInterface(currentChatId);
        renderChatList();
        document.getElementById('chat-settings-btn').click(); 

    } catch (error) {
        console.error("σ»╝σàÑσìòΣ╕¬Φüèσñ⌐µù╢σç║ΘöÖ:", error);
        await showCustomAlert("Import Failed", `Could not read or apply the file: ${error.message}`);
    }
}
