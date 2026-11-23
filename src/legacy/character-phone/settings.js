import { applyLauncherAppearance, renderLauncherSettings } from '../appearance/icons.js'
import { runtime } from '../runtime/state.js'

export function applyCPhoneWallpaper() {
    const charPhoneScreen = document.getElementById('character-phone-screen');
    const wallpaper = runtime.state.globalSettings.cphoneWallpaper;
    if (wallpaper) {
        
        charPhoneScreen.style.backgroundImage = `url(${wallpaper})`;
    } else {
        
        charPhoneScreen.style.backgroundImage = 'linear-gradient(135deg, #f6d365, #fda085)';
    }
}

export function applyCPhoneAppIcons() {
    applyLauncherAppearance('cphone');
}

export function renderCPhoneIconSettings() {
    renderLauncherSettings('cphone');
}

export function renderIconSettings() {
    renderLauncherSettings('ephone');
}
