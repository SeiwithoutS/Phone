import { preferences } from '../storage/preferences.js'
import { renderApiSettings } from '../api/settings.js'
import { applyCustomFont } from '../appearance/fonts.js'
import { applyAppIcons } from '../appearance/icons.js'
import { applyGlobalCss, applyScopedCss, applyTheme } from '../appearance/theme.js'
import { applyGlobalWallpaper, renderWallpaperScreen } from '../appearance/wallpaper.js'
import { openCharApp } from '../character-phone/apps.js'
import { openCharacterSelector, switchToCharHomeScreen, switchToMyPhone } from '../character-phone/launcher.js'
import { setupCharPlayerControls } from '../character-phone/music.js'
import { openCharWallet } from '../character-phone/simulation.js'
import { renderChatList } from '../chat/list.js'
import { initBatteryManager, updateClock } from '../home/status.js'
import { refreshCharacterAvatars } from '../../features/characters/gallery'
import { applyStatusBarVisibility, handleListenTogetherClick } from '../music/player.js'
import { openNpcEditor } from '../npc/npcs.js'
import { simulateBackgroundActivity } from '../npc/simulation.js'
import { updateUnreadIndicator } from '../qzone/feed.js'
import { migrateOldRedPacketData } from '../rendering/markup.js'
import { renderWorldBookScreen } from '../world-book/books.js'
import { showScreen } from '../../app/routes'
import { controls } from './state.js'
import { runtime } from './state.js'
import { loadAllDataFromDB } from '../storage/load.js'

export async function initializePhoneUi() {
  controls.lastActiveTimestamp = preferences.getItem('ephoneLastActiveTimestamp')

if (controls.lastActiveTimestamp) {
        const minutesOffline = (Date.now() - parseInt(controls.lastActiveTimestamp)) / (1000 * 60);
        
        if (minutesOffline > 5) {
            
            
            simulateBackgroundActivity(minutesOffline);
        }
    }

setupCharPlayerControls();

window.showScreen = showScreen;


window.handleListenTogetherClick = handleListenTogetherClick;

window.openCharacterSelector = openCharacterSelector;

window.openCharApp = openCharApp;

window.switchToMyPhone = switchToMyPhone;

window.openCharWallet = openCharWallet;

window.switchToCharHomeScreen = switchToCharHomeScreen;

window.openNpcEditor = openNpcEditor;

controls.globalCssStyleTag = document.createElement('style')

controls.globalCssStyleTag.id = 'global-custom-style';

document.head.appendChild(controls.globalCssStyleTag);

runtime.qzoneStickerPanelState.panelEl = document.getElementById('qzone-sticker-panel');

runtime.qzoneStickerPanelState.gridEl = document.getElementById('qzone-sticker-grid');

controls.savedTheme = preferences.getItem('ephone-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

applyTheme(controls.savedTheme, false);

controls.customBubbleStyleTag = document.createElement('style')

controls.customBubbleStyleTag.id = 'custom-bubble-style';

document.head.appendChild(controls.customBubbleStyleTag);

controls.previewBubbleStyleTag = document.createElement('style')

controls.previewBubbleStyleTag.id = 'preview-bubble-style';

document.head.appendChild(controls.previewBubbleStyleTag);

applyScopedCss('', '#chat-messages', 'custom-bubble-style');

applyScopedCss('', '#settings-preview-area', 'preview-bubble-style');


window.showScreen = showScreen;

window.renderChatListProxy = renderChatList;

window.renderApiSettingsProxy = renderApiSettings;

window.renderWallpaperScreenProxy = renderWallpaperScreen;

window.renderWorldBookScreenProxy = renderWorldBookScreen;

await loadAllDataFromDB();

applyStatusBarVisibility();

await migrateOldRedPacketData();

applyGlobalCss(runtime.state.globalSettings.globalCss);

controls.storedCount = parseInt(preferences.getItem('unreadPostsCount')) || 0

updateUnreadIndicator(controls.storedCount);

if (runtime.state.globalSettings && runtime.state.globalSettings.fontUrl) {
                        applyCustomFont(runtime.state.globalSettings.fontUrl);
                    }

updateClock();

setInterval(updateClock, 1000 * 30);

applyGlobalWallpaper();

initBatteryManager();

applyAppIcons();
setInterval(refreshCharacterAvatars, 5000);

}
