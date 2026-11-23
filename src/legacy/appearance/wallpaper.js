import { loadAppearancePresetsDropdown, loadCssPresetsDropdown, deleteCssPreset, deleteFontPreset, deleteThemePreset, handleCssPresetSelectionChange, handleFontPresetSelectionChange, handleThemePresetSelectionChange, saveCssPreset, saveFontPreset, saveThemePreset } from './presets.js'
import { renderCPhoneIconSettings, renderIconSettings, applyCPhoneAppIcons, applyCPhoneWallpaper } from '../character-phone/settings.js'
import { initializeButtonOrderEditor, renderButtonOrderEditor } from '../chat/button-order.js'
import { runtime } from '../runtime/state.js'
import { applyAppIcons } from './icons.js'
import { applyGlobalCss } from './theme.js'
import { exportSingleChat } from '../chat/import.js'
import { showCustomPrompt } from '../dialogs/dialogs.js'
import { applyStatusBarVisibility } from '../music/player.js'
import { handleConfirmClearPosts } from '../qzone/feed.js'
import { showScreen } from '../../app/routes'

export function renderWallpaperScreen() {
    loadCssPresetsDropdown();
loadAppearancePresetsDropdown();
    
    const ephonePreview = document.getElementById('wallpaper-preview');
    
    const ephoneBg = runtime.state.globalSettings.wallpaper;
    if (ephoneBg) {
        
        ephonePreview.style.backgroundImage = `url(${ephoneBg})`;
        ephonePreview.textContent = ''; 
    } else {
        
        ephonePreview.style.backgroundImage = 'linear-gradient(135deg, #89f7fe, #66a6ff)';
        ephonePreview.textContent = "Gradient Background";
    }

    
    const cphonePreview = document.getElementById('cphone-wallpaper-preview');
    const cphoneBg = runtime.state.globalSettings.cphoneWallpaper;
    if (cphoneBg) {
        cphonePreview.style.backgroundImage = `url(${cphoneBg})`;
        cphonePreview.textContent = '';
    } else {
        cphonePreview.style.backgroundImage = 'linear-gradient(135deg, #f6d365, #fda085)';
        cphonePreview.textContent = "Gradient Background";
    }

    
    const globalBgPreview = document.getElementById('global-bg-preview');
    const globalBg = runtime.state.globalSettings.globalChatBackground;
    if (globalBg) {
        globalBgPreview.style.backgroundImage = `url(${globalBg})`;
        globalBgPreview.textContent = '';
        document.getElementById('remove-global-bg-btn').style.display = 'inline-block';
    } else {
        globalBgPreview.style.backgroundImage = 'none';
        globalBgPreview.textContent = "Upload an image below";
        document.getElementById('remove-global-bg-btn').style.display = 'none';
    }

    
    renderIconSettings();
    renderCPhoneIconSettings(); 
    document.getElementById('global-css-input').value = runtime.state.globalSettings.globalCss || '';
    document.getElementById('message-sound-toggle').checked = runtime.state.globalSettings.messageSounds !== false;
    document.getElementById('notification-sound-url-input').value = runtime.state.globalSettings.notificationSoundUrl || '';
    document.getElementById('status-bar-toggle-switch').checked = runtime.state.globalSettings.showStatusBar || false;
    renderButtonOrderEditor();
    initializeButtonOrderEditor();
}

export function applyGlobalWallpaper() {
    const homeScreen = document.getElementById('home-screen');
    const wallpaper = runtime.state.globalSettings.wallpaper;
    if (wallpaper) {
        
        homeScreen.style.backgroundImage = /^(linear|radial|conic)-gradient\(/i.test(wallpaper)
            ? wallpaper : `url(${JSON.stringify(wallpaper)})`;
    } else {
        
        homeScreen.style.backgroundImage = 'linear-gradient(135deg, #89f7fe, #66a6ff)';
    }
}

export function bindWallpaperUpload() {
  document.getElementById('reset-global-css-btn').addEventListener('click', () => {
    document.getElementById('global-css-input').value = ''
  })
  document.getElementById('wallpaper-upload-input').addEventListener('change', async (event) => { const file = event.target.files[0]; if(file) { const dataUrl = await new Promise((res, rej) => { const reader = new FileReader(); reader.onload = () => res(reader.result); reader.onerror = () => rej(reader.error); reader.readAsDataURL(file); }); runtime.newWallpaperBase64 = dataUrl; renderWallpaperScreen(); } });

document.getElementById('save-wallpaper-btn').addEventListener('click', async () => {
            
            if (document.querySelector('.launcher-setting-row[data-reading-image]')) {
                alert('Wait for the app image to finish loading.');
                return;
            }
            const invalid = document.querySelector('.launcher-setting-row [aria-invalid="true"]');
            if (invalid) {
                invalid.closest('details').open = true;
                invalid.focus();
                return;
            }
            if (runtime.newWallpaperBase64) {
                runtime.state.globalSettings.wallpaper = runtime.newWallpaperBase64;
            }
            
            
            

            runtime.state.globalSettings.globalCss = document.getElementById('global-css-input').value.trim();
            runtime.state.globalSettings.messageSounds = document.getElementById('message-sound-toggle').checked;
            runtime.state.globalSettings.notificationSoundUrl = document.getElementById('notification-sound-url-input').value.trim();
            runtime.state.globalSettings.showStatusBar = document.getElementById('status-bar-toggle-switch').checked;
            
            
            await runtime.db.globalSettings.put(runtime.state.globalSettings);
            
            
            applyGlobalWallpaper();
            applyCPhoneWallpaper(); 
            runtime.newWallpaperBase64 = null; 

            applyAppIcons();
            applyCPhoneAppIcons(); 
            
            applyGlobalCss(runtime.state.globalSettings.globalCss);
            applyStatusBarVisibility();

            alert("Appearance settings saved and applied.");
            showScreen('home-screen');
        });
}

export function bindGlobalBackgroundEvents() {
  document.getElementById('confirm-clear-posts-btn').addEventListener('click', handleConfirmClearPosts);

document.getElementById('clear-posts-list').addEventListener('click', (e) => {
    const item = e.target.closest('.clear-posts-item');
    if (item) {
        item.classList.toggle('selected');
    }
});

document.getElementById('global-bg-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        const dataUrl = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
        
        runtime.state.globalSettings.globalChatBackground = dataUrl;
        
        renderWallpaperScreen();
    }
    event.target.value = null; 
});

document.getElementById('remove-global-bg-btn').addEventListener('click', () => {
    
    runtime.state.globalSettings.globalChatBackground = '';
    renderWallpaperScreen();
});

document.getElementById('upload-global-bg-url-btn').addEventListener('click', async () => {
    
    const url = await showCustomPrompt("Image URL", "Enter a background image URL", "", "url");

    
    if (url && url.trim()) {
        
        runtime.state.globalSettings.globalChatBackground = url.trim();
        
        
        renderWallpaperScreen();
    } else if (url !== null) {
        
        alert("Enter a valid URL.");
    }
});

document.getElementById('upload-ephone-bg-url-btn').addEventListener('click', async () => {
    const url = await showCustomPrompt("EPhone Wallpaper URL", "Enter a wallpaper URL for the EPhone home screen", "", "url");
    if (url && url.trim()) {
        
        runtime.newWallpaperBase64 = url.trim();
        
        renderWallpaperScreen();
    } else if (url !== null) {
        alert("Enter a valid URL.");
    }
});

document.getElementById('upload-cphone-bg-url-btn').addEventListener('click', async () => {
    const url = await showCustomPrompt("Character Phone Wallpaper URL", "Enter a wallpaper URL for the character phone", "", "url");
    if (url && url.trim()) {
        
        runtime.state.globalSettings.cphoneWallpaper = url.trim();
        
        renderWallpaperScreen();
    } else if (url !== null) {
        alert("Enter a valid URL.");
    }
});

document.getElementById('remove-ephone-bg-btn').addEventListener('click', () => {
    
    runtime.newWallpaperBase64 = null;
    runtime.state.globalSettings.wallpaper = '';
    
    renderWallpaperScreen();
});

document.getElementById('remove-cphone-bg-btn').addEventListener('click', () => {
    
    runtime.state.globalSettings.cphoneWallpaper = '';
    
    renderWallpaperScreen();
});

document.getElementById('css-preset-select').addEventListener('change', handleCssPresetSelectionChange);

document.getElementById('save-css-preset-btn').addEventListener('click', saveCssPreset);

document.getElementById('delete-css-preset-btn').addEventListener('click', deleteCssPreset);

document.getElementById('font-preset-select').addEventListener('change', handleFontPresetSelectionChange);

document.getElementById('save-font-preset-btn').addEventListener('click', saveFontPreset);

document.getElementById('delete-font-preset-btn').addEventListener('click', deleteFontPreset);

document.getElementById('theme-preset-select').addEventListener('change', handleThemePresetSelectionChange);

document.getElementById('save-theme-preset-btn').addEventListener('click', saveThemePreset);

document.getElementById('delete-theme-preset-btn').addEventListener('click', deleteThemePreset);

document.getElementById('export-single-chat-btn').addEventListener('click', exportSingleChat);

document.getElementById('import-single-chat-btn').addEventListener('click', () => {
    document.getElementById('import-single-chat-input').click();
});
}
