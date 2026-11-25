import { renderNpcListScreen } from '../npc/npcs.js'
import { renderFavoritesScreen } from '../qzone/favorites.js'
import { renderQzonePosts, renderQzoneScreen, updateUnreadIndicator } from '../qzone/feed.js'
import { runtime } from '../runtime/state.js'
import { renderFontSettings } from '../appearance/fonts.js'
import { loadFontPresetsDropdown } from '../appearance/presets.js'
import { renderWallpaperScreen } from '../appearance/wallpaper.js'
import { renderApiSettings } from '../api/settings.js'
import { renderChatList } from '../chat/list.js'
import { updateListenTogetherIcon } from '../music/player.js'
import { renderWorldBookScreen } from '../world-book/books.js'
import { renderPresetScreen } from '../presets/presets.js'

export function enterScreen(screenId, chatListView = 'messages-view') {
    const screen = document.getElementById(screenId);
    if (screenId === 'chat-list-screen') {
        void renderChatList();
        switchToChatListView(chatListView === 'npc-list-view' ? chatListView : 'messages-view');
    }
    if (screenId === 'api-settings-screen') void renderApiSettings();
    if (screenId === 'wallpaper-screen') void renderWallpaperScreen();
    if (screenId === 'world-book-screen') void renderWorldBookScreen();
    if (screenId === 'preset-screen') void renderPresetScreen();
    if (screenId === 'chat-interface-screen') updateListenTogetherIcon(runtime.state.activeChatId);
    if (screenId === 'font-settings-screen') {
        void loadFontPresetsDropdown();
        renderFontSettings();
    }
    screen?.querySelector('.back-btn')?.blur();
}

export function switchToChatListView(viewId) {
                    const chatListScreen = document.getElementById('chat-list-screen');
                    const views = {
                        'persona-view': document.getElementById('persona-view'),
                        'messages-view': document.getElementById('messages-view'),
                        'qzone-screen': document.getElementById('qzone-screen'),
                        'favorites-view': document.getElementById('favorites-view'),
                'memories-view': document.getElementById('memories-view'),
               'npc-list-view': document.getElementById('npc-list-view')
            };
                    const mainHeader = document.getElementById('main-chat-list-header');
                    const mainBottomNav = document.getElementById('chat-list-bottom-nav'); 
        
                    if (runtime.isFavoritesSelectionMode) {
                        document.getElementById('favorites-edit-btn').click(); 
                    }
        
                    
                    Object.values(views).forEach(v => v.classList.remove('active'));
                    
                    if (views[viewId]) {
                        views[viewId].classList.add('active');
                    }
        
                    
                    document.querySelectorAll('#chat-list-bottom-nav .nav-item').forEach(item => {
                        const active = item.dataset.view === viewId;
                        item.classList.toggle('active', active);
                        item.setAttribute('aria-pressed', String(active));
                    });
                    
                    
                    if (viewId === 'messages-view' || viewId === 'persona-view') {
                        mainHeader.style.display = 'flex';
                        mainBottomNav.style.display = 'flex';
                        mainHeader.querySelector('#chat-list-title').textContent = viewId === 'persona-view' ? 'Persona' : 'Chat';
                        mainHeader.querySelector('.header-actions').style.visibility = viewId === 'persona-view' ? 'hidden' : '';
                    } else {
                        mainHeader.style.display = 'none';
                        mainBottomNav.style.display = 'none';
                    }
                    
        
            if (viewId !== 'memories-view') {
                runtime.activeCountdownTimers.forEach(timerId => clearInterval(timerId));
                runtime.activeCountdownTimers = [];
            }
        
                    
                    switch (viewId) {
                        case 'qzone-screen':
                            views['qzone-screen'].style.backgroundColor = '#f0f2f5';
                            updateUnreadIndicator(0);
                            renderQzoneScreen();
                            renderQzonePosts();
                            break;
                        case 'favorites-view':
                            views['favorites-view'].style.backgroundColor = '#f9f9f9';
                            renderFavoritesScreen();
                            break;
                        case 'messages-view':
                            
                            break;
        case 'npc-list-view':
            renderNpcListScreen(); 
            break;
                    }
                }
