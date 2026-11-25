import { preferences } from '../storage/preferences.js'
import { importAppearanceSettings } from '../appearance/presets.js'
import { handleBatchUploadFrames, handleDeleteCustomFrame, handleUploadFrame } from '../avatars/frames.js'
import { renderCharTaobao } from '../character-phone/apps.js'
import { renderCharSimulatedQQ } from '../character-phone/notes.js'
import { openCharSimulatedConversation, renderCharAlbum, renderCharAppUsage, renderCharArticle } from '../character-phone/simulation.js'
import { renderChatInterface } from '../chat/conversation.js'
import { clearSearchFilters, handleSearchHistory, openSearchHistoryScreen } from '../chat/search.js'
import { showCustomAlert } from '../dialogs/dialogs.js'
import { renderFavoritesScreen } from '../qzone/favorites.js'
import { renderQzonePosts } from '../qzone/feed.js'
import { exportWorldBooks, handleWorldBookImport } from '../world-book/transfer.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'

export function bindPhonePreferences() {
  document.getElementById('import-appearance-btn').addEventListener('click', () => {
    document.getElementById('import-appearance-input').click();
});

document.getElementById('import-appearance-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        importAppearanceSettings(file);
    }
    e.target.value = null; 
});

document.addEventListener('visibilitychange', () => {
    
    if (document.visibilityState === 'hidden') {
        
        preferences.setItem('ephoneLastActiveTimestamp', Date.now());
        console.log("应用已切换到后台，记录当前时间。");
    }
});

document.getElementById('export-world-book-btn').addEventListener('click', exportWorldBooks);

document.getElementById('import-world-book-btn').addEventListener('click', () => {
            document.getElementById('import-world-book-input').click();
        });

document.getElementById('import-world-book-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleWorldBookImport(file); 
            }
            e.target.value = null;
        });

document.getElementById('enable-ai-drawing-switch').addEventListener('change', async (e) => {
            const isEnabled = e.target.checked;
            runtime.state.globalSettings.enableAiDrawing = isEnabled;
            await runtime.db.globalSettings.put(runtime.state.globalSettings);

            
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen) {
                switch (activeScreen.id) {
                    case 'chat-interface-screen':
                        renderChatInterface(runtime.state.activeChatId);
                        break;
                    case 'chat-list-screen':
                        
                        if(document.getElementById('qzone-screen').classList.contains('active')) renderQzonePosts();
                        
                        if(document.getElementById('favorites-view').classList.contains('active')) renderFavoritesScreen();
                        break;
                    case 'character-phone-screen':
                        const activeCharScreen = document.querySelector('.char-screen.active');
                        if (activeCharScreen) {
                            switch(activeCharScreen.id) {
                                case 'char-album-screen': renderCharAlbum(); break;
                                case 'char-taobao-screen': renderCharTaobao(); break;
                                case 'char-browser-article-screen': 
                                    const char = runtime.state.chats[runtime.activeCharacterId];
                                    const history = char.simulatedBrowserHistory || [];
                                    const lastArticleIndex = history.length > 0 ? history.length - 1 : 0; 
                                    renderCharArticle(history[lastArticleIndex]);
                                    break;
                                case 'char-usage-screen': renderCharAppUsage(); break;
                                case 'char-qq-screen': renderCharSimulatedQQ(); break;
                                case 'char-qq-conversation-screen': 
                                    const convoIndex = document.querySelector('#char-chat-list .chat-list-item')?.dataset.conversationIndex || 0;
                                    openCharSimulatedConversation(parseInt(convoIndex));
                                    break;
                            }
                        }
                        break;
                }
            }
            showCustomAlert("Settings Applied", `AI image generation is ${isEnabled ? '开启' : '关闭'}.`);
        });

document.getElementById('search-history-btn').addEventListener('click', openSearchHistoryScreen);

document.getElementById('execute-search-btn').addEventListener('click', handleSearchHistory);

document.getElementById('clear-search-btn').addEventListener('click', clearSearchFilters);

document.getElementById('upload-custom-frame-btn').addEventListener('click', handleUploadFrame);

document.getElementById('batch-import-frames-btn').addEventListener('click', handleBatchUploadFrames);

document.querySelector('#avatar-frame-modal .modal-body').addEventListener('click', (e) => {
    
    if (e.target.classList.contains('delete-btn')) {
        const frameId = parseInt(e.target.dataset.id);
        if (!isNaN(frameId)) {
            handleDeleteCustomFrame(frameId);
        }
    }
});
}
