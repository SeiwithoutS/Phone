import { renderWallpaperScreen } from '../appearance/wallpaper.js'
import { switchToCharScreen } from './launcher.js'
import { closeCharMusicPlayer } from './music.js'
import { openMemoEditor, toggleMemoFavorite } from './notes.js'
import { handleContinueRealConversationFromCPhone, handleGenerateAmapHistory, handleGenerateAppUsage, handleGenerateBrowserHistory, handleGenerateSimulatedAlbum, handleGenerateSimulatedMemos, handleGenerateSimulatedMusic, handleGenerateSimulatedQQ, handleGenerateTaobaoHistory, loadMoreMirroredMessages, openCharSimulatedConversation, openCharWallet, toggleBrowserArticleFavorite } from './simulation.js'
import { importSingleChat } from '../chat/import.js'
import { showCustomAlert } from '../dialogs/dialogs.js'
import { showScreen } from '../../app/routes'
import { controls } from '../runtime/state.js'
import { runtime } from '../runtime/state.js'

export function bindCharacterPhoneEvents() {
  document.getElementById('import-single-chat-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        importSingleChat(file);
    }
    e.target.value = null; 
});

document.getElementById('add-char-memo-btn').addEventListener('click', () => openMemoEditor());


document.getElementById('favorite-article-btn').addEventListener('click', toggleBrowserArticleFavorite);

document.getElementById('favorite-memo-btn').addEventListener('click', toggleMemoFavorite);

document.getElementById('regenerate-char-qq-btn').addEventListener('click', async () => {
    
    showCustomAlert("Working…", "Generating a simulated chat and continuing the character’s conversation…");

    try {
        
        await Promise.all([
            handleGenerateSimulatedQQ(),
            handleContinueRealConversationFromCPhone()
        ]);

        console.log("CPhone QQ模拟记录生成 和 主聊天推进 已同时完成。");

    } catch (error) {
        console.error("在同时执行两个函数时出错:", error);
        await showCustomAlert("Operation Failed", `Could not complete the operation: ${error.message}`);
    }
});

document.getElementById('char-chat-list').addEventListener('click', (e) => {
            const item = e.target.closest('.chat-list-item');
            if (item && item.dataset.conversationIndex) {
                const index = parseInt(item.dataset.conversationIndex);
                if (!isNaN(index)) {
                    
                    openCharSimulatedConversation(index);
                }
            }
        });

document.getElementById('back-to-char-qq-list-btn').addEventListener('click', () => {
            switchToCharScreen('char-qq-screen');
        });

controls.charConversationMessages = document.getElementById('char-conversation-messages')

controls.cphoneScrollHandler = () => {
            
            if (runtime.cphoneActiveConversationType !== 'private_user') {
                return; 
            }
            
            
            if (controls.charConversationMessages.scrollTop < 1 && !runtime.isLoadingMoreCphoneMessages) {
                const totalMessages = runtime.state.chats[runtime.activeCharacterId]?.history.length || 0;
                
                if (totalMessages > runtime.cphoneRenderedCount) {
                    
                    loadMoreMirroredMessages();
                }
            }
        }

controls.charConversationMessages.addEventListener('scroll', controls.cphoneScrollHandler);

document.getElementById('char-simulated-send-btn').addEventListener('click', () => {
            alert("This simulated conversation is read-only.");
        });

document.getElementById('regenerate-char-album-btn').addEventListener('click', handleGenerateSimulatedAlbum);

document.getElementById('char-album-grid').addEventListener('click', (e) => {
            
            const photoItem = e.target.closest('.char-photo-item');
            
            
            if (photoItem && photoItem.dataset.description) {
                const description = photoItem.dataset.description;
                
                
                showCustomAlert("Photo Details", description.replace(/\n/g, '<br>'));
            }
        });

document.getElementById('regenerate-char-browser-btn').addEventListener('click', handleGenerateBrowserHistory);

document.getElementById('regenerate-char-taobao-btn').addEventListener('click', handleGenerateTaobaoHistory);

document.getElementById('char-product-grid').addEventListener('click', (e) => {
            const item = e.target.closest('.char-product-item');
            if (item && item.dataset.reason) {
                const reason = item.dataset.reason;
                showCustomAlert("Character’s thoughts…", reason.replace(/\n/g, '<br>'));
            }
        });

window.openCharWallet = openCharWallet;

document.getElementById('regenerate-char-memo-btn').addEventListener('click', handleGenerateSimulatedMemos);

document.getElementById('char-memo-detail-back-btn').addEventListener('click', () => switchToCharScreen('char-memo-screen'));

document.getElementById('regenerate-char-amap-btn').addEventListener('click', handleGenerateAmapHistory);

document.getElementById('regenerate-char-usage-btn').addEventListener('click', handleGenerateAppUsage);

document.getElementById('regenerate-char-music-btn').addEventListener('click', handleGenerateSimulatedMusic);

document.getElementById('close-char-music-player-btn').addEventListener('click', closeCharMusicPlayer);






document.getElementById('cphone-wallpaper-upload-input').addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                const dataUrl = await new Promise((res) => {
                    const reader = new FileReader();
                    reader.onload = () => res(reader.result);
                    reader.readAsDataURL(file);
                });
                
                runtime.state.globalSettings.cphoneWallpaper = dataUrl;
                
                renderWallpaperScreen();
            }
        });


}
