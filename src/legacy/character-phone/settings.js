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
            if (!runtime.state.globalSettings.cphoneAppIcons) return;

            for (const iconId in runtime.state.globalSettings.cphoneAppIcons) {
                const imgElement = document.getElementById(`cphone-icon-img-${iconId}`);
                if (imgElement) {
                    imgElement.src = runtime.state.globalSettings.cphoneAppIcons[iconId];
                }
            }
        }

export function renderCPhoneIconSettings() {
            const grid = document.getElementById('cphone-icon-settings-grid');
            if (!grid) return;
            grid.innerHTML = '';

            const cphoneAppLabels = {
                'qq': 'QQ', 'album': '相册', 'browser': '浏览器', 'taobao': '淘宝',
                'memo': '备忘录', 'diary': '日记', 'amap': '高德地图', 'usage': 'App记录',
                'music': '网易云', 'ephone': 'Ephone'
            };

            for (const iconId in runtime.state.globalSettings.cphoneAppIcons) {
                const iconUrl = runtime.state.globalSettings.cphoneAppIcons[iconId];
                const labelText = cphoneAppLabels[iconId] || '未知App';

                const item = document.createElement('div');
                item.className = 'icon-setting-item';
                item.dataset.iconId = iconId;

                item.innerHTML = `
                    <img class="icon-preview" src="${iconUrl}" alt="${labelText}">
                    <button class="change-icon-btn">Change</button>
                `;
                grid.appendChild(item);
            }
        }

export function renderIconSettings() {
            const grid = document.getElementById('icon-settings-grid');
            if (!grid) return;
            grid.innerHTML = '';
        
    const appLabels = {
       'qq': 'QQ',
       'edit': 'Edit',
       'world-info': 'World Info',
       'social': 'Social',
       'world-book': 'Mini Prompts',
       'wallpaper': '外观设置',
       'api-settings': 'API设置',
       'font': '字体',
       'char-phone': 'Cphone',
       
       'preset': '预设',
             
           'tutorial': '教程',



    };
          
        
            for (const [iconId, labelText] of Object.entries(appLabels)) {
                const iconUrl = runtime.state.globalSettings.appIcons[iconId] || runtime.DEFAULT_APP_ICONS[iconId];
        
                const item = document.createElement('div');
                item.className = 'icon-setting-item';
                
                item.dataset.iconId = iconId; 
        
                item.innerHTML = `
                    <img class="icon-preview" src="${iconUrl}" alt="${labelText}">
                    <button class="change-icon-btn">Change</button>
                `;
                grid.appendChild(item);
            }
        }
