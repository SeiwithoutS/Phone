import { preferences } from '../storage/preferences.js'
import { applyCustomFont } from './fonts.js'
import { applyAppIcons } from './icons.js'
import { applyGlobalCss, applyTheme, updateSettingsPreview } from './theme.js'
import { applyGlobalWallpaper, renderWallpaperScreen } from './wallpaper.js'
import { applyCPhoneAppIcons, applyCPhoneWallpaper } from '../character-phone/settings.js'
import { showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { applyStatusBarVisibility } from '../music/player.js'
import { runtime } from '../runtime/state.js'

export async function loadCssPresetsDropdown() {
            const selectEl = document.getElementById('css-preset-select');
            selectEl.innerHTML = "<option value=\"\">Choose a preset</option>";
            
            const presets = await runtime.db.appearancePresets.where('type').equals('global_css').toArray();
            presets.forEach(preset => {
                const option = document.createElement('option');
                option.value = preset.id;
                option.textContent = preset.name;
                selectEl.appendChild(option);
            });
        }

export async function handleCssPresetSelectionChange() {
            const selectEl = document.getElementById('css-preset-select');
            const selectedId = parseInt(selectEl.value);
            if (isNaN(selectedId)) return;
        
            const preset = await runtime.db.appearancePresets.get(selectedId);
            if (preset) {
                const cssInput = document.getElementById('global-css-input');
                cssInput.value = preset.value;
                applyGlobalCss(preset.value); 
            }
        }

export async function saveCssPreset() {
            const name = await showCustomPrompt("Save CSS Preset", "Enter a preset name");
            if (!name || !name.trim()) return;
        
            const cssValue = document.getElementById('global-css-input').value;
        
            const existingPreset = await runtime.db.appearancePresets.where({ name: name.trim(), type: 'global_css' }).first();
            if (existingPreset) {
                const confirmed = await showCustomConfirm("Overwrite Preset", `A preset named “${name.trim()}” already exists. Overwrite it?`, { confirmButtonClass: 'btn-danger' });
                if (!confirmed) return;
                
                await runtime.db.appearancePresets.update(existingPreset.id, { value: cssValue });
            } else {
                await runtime.db.appearancePresets.add({
                    name: name.trim(),
                    type: 'global_css',
                    value: cssValue
                });
            }
        
            await loadCssPresetsDropdown(); 
            alert("CSS preset saved.");
        }

export async function deleteCssPreset() {
            const selectEl = document.getElementById('css-preset-select');
            const selectedId = parseInt(selectEl.value);
        
            if (isNaN(selectedId)) {
                alert("Select a saved preset to delete.");
                return;
            }
        
            const preset = await runtime.db.appearancePresets.get(selectedId);
            if (!preset) return;
        
            const confirmed = await showCustomConfirm("Delete Preset", `Delete preset “${preset.name}”?`, { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                await runtime.db.appearancePresets.delete(selectedId);
                await loadCssPresetsDropdown(); 
                alert("Preset deleted.");
            }
        }

export async function loadFontPresetsDropdown() {
            const selectEl = document.getElementById('font-preset-select');
            selectEl.innerHTML = "<option value=\"\">Choose a preset</option>";
            
            const presets = await runtime.db.appearancePresets.where('type').equals('font').toArray();
            presets.forEach(preset => {
                const option = document.createElement('option');
                option.value = preset.id;
                option.textContent = preset.name;
                selectEl.appendChild(option);
            });
        }

export async function handleFontPresetSelectionChange() {
            const selectEl = document.getElementById('font-preset-select');
            const selectedId = parseInt(selectEl.value);
            if (isNaN(selectedId)) return;
        
            const preset = await runtime.db.appearancePresets.get(selectedId);
            if (preset) {
                const fontUrlInput = document.getElementById('font-url-input');
                fontUrlInput.value = preset.value;
                applyCustomFont(preset.value, true); 
            }
        }

export async function saveFontPreset() {
            const name = await showCustomPrompt("Save Font Preset", "Enter a preset name");
            if (!name || !name.trim()) return;
        
            const fontUrl = document.getElementById('font-url-input').value.trim();
            if (!fontUrl) {
                alert("Enter a font URL.");
                return;
            }
        
            const existingPreset = await runtime.db.appearancePresets.where({ name: name.trim(), type: 'font' }).first();
            if (existingPreset) {
                const confirmed = await showCustomConfirm("Overwrite Preset", `A preset named “${name.trim()}” already exists. Overwrite it?`, { confirmButtonClass: 'btn-danger' });
                if (!confirmed) return;
                
                await runtime.db.appearancePresets.update(existingPreset.id, { value: fontUrl });
            } else {
                await runtime.db.appearancePresets.add({
                    name: name.trim(),
                    type: 'font',
                    value: fontUrl
                });
            }
        
            await loadFontPresetsDropdown();
            alert("Font preset saved.");
        }

export async function deleteFontPreset() {
            const selectEl = document.getElementById('font-preset-select');
            const selectedId = parseInt(selectEl.value);
        
            if (isNaN(selectedId)) {
                alert("Select a saved preset to delete.");
                return;
            }
        
            const preset = await runtime.db.appearancePresets.get(selectedId);
            if (!preset) return;
        
            const confirmed = await showCustomConfirm("Delete Preset", `Delete preset “${preset.name}”?`, { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                await runtime.db.appearancePresets.delete(selectedId);
                await loadFontPresetsDropdown();
                alert("Preset deleted.");
            }
        }

export async function loadAppearancePresetsDropdown() {
    const selectEl = document.getElementById('appearance-preset-select');
    selectEl.innerHTML = "<option value=\"\">Choose a preset</option>";
    
    const presets = await runtime.db.appearancePresets.where('type').equals('appearance').toArray();
    presets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        selectEl.appendChild(option);
    });

    

    
    const currentSettings = {
        wallpaper: runtime.state.globalSettings.wallpaper,
        cphoneWallpaper: runtime.state.globalSettings.cphoneWallpaper,
        globalChatBackground: runtime.state.globalSettings.globalChatBackground,
        appIcons: runtime.state.globalSettings.appIcons,
        cphoneAppIcons: runtime.state.globalSettings.cphoneAppIcons,
        chatActionButtonsOrder: runtime.state.globalSettings.chatActionButtonsOrder,
        theme: preferences.getItem('ephone-theme') || 'light',
        showStatusBar: runtime.state.globalSettings.showStatusBar,
        notificationSoundUrl: runtime.state.globalSettings.notificationSoundUrl,
        widgetData: runtime.state.globalSettings.widgetData,
    };

    let matchingPresetId = null;

    
    for (const preset of presets) {
        
        if (JSON.stringify(preset.value) === JSON.stringify(currentSettings)) {
            matchingPresetId = preset.id;
            break; 
        }
    }

    
    if (matchingPresetId) {
        selectEl.value = matchingPresetId;
    } else {
        
        selectEl.value = '';
    }
    
}

export async function handleAppearancePresetSelectionChange() {
    const selectEl = document.getElementById('appearance-preset-select');
    const selectedId = parseInt(selectEl.value);
    if (isNaN(selectedId)) return;

    const preset = await runtime.db.appearancePresets.get(selectedId);
    if (preset && preset.value) {
        const data = preset.value;
        
        
        Object.assign(runtime.state.globalSettings, data);
        
        
        applyTheme(data.theme || 'light');
        
        
        await runtime.db.globalSettings.put(runtime.state.globalSettings);
        
        
        applyGlobalWallpaper();
        applyCPhoneWallpaper();
        applyAppIcons();
        applyCPhoneAppIcons();
        applyStatusBarVisibility();
        
        
        renderWallpaperScreen();

        alert(`Loaded appearance preset “${preset.name}”`);
    }
}

export async function saveAppearancePreset() {
    const name = await showCustomPrompt("Save Appearance Preset", "Enter a preset name");
    if (!name || !name.trim()) return;

    
    const appearanceData = {
        wallpaper: runtime.state.globalSettings.wallpaper,
        cphoneWallpaper: runtime.state.globalSettings.cphoneWallpaper,
        globalChatBackground: runtime.state.globalSettings.globalChatBackground,
        appIcons: runtime.state.globalSettings.appIcons,
        cphoneAppIcons: runtime.state.globalSettings.cphoneAppIcons,
        chatActionButtonsOrder: runtime.state.globalSettings.chatActionButtonsOrder,
        theme: preferences.getItem('ephone-theme') || 'light',
        showStatusBar: runtime.state.globalSettings.showStatusBar,
        notificationSoundUrl: runtime.state.globalSettings.notificationSoundUrl,
        widgetData: runtime.state.globalSettings.widgetData,
    };

    
    const existingPreset = await runtime.db.appearancePresets.where({ name: name.trim(), type: 'appearance' }).first();
    if (existingPreset) {
        const confirmed = await showCustomConfirm("Overwrite Preset", `A preset named “${name.trim()}” already exists. Overwrite it?`, { confirmButtonClass: 'btn-danger' });
        if (!confirmed) return;
        
        await runtime.db.appearancePresets.update(existingPreset.id, { value: appearanceData });
    } else {
        await runtime.db.appearancePresets.add({
            name: name.trim(),
            type: 'appearance', 
            value: appearanceData
        });
    }

    
    await loadAppearancePresetsDropdown();
    alert("Appearance preset saved.");
}

export async function deleteAppearancePreset() {
    const selectEl = document.getElementById('appearance-preset-select');
    const selectedId = parseInt(selectEl.value);

    if (isNaN(selectedId)) {
        alert("Select a saved preset to delete.");
        return;
    }

    const preset = await runtime.db.appearancePresets.get(selectedId);
    if (!preset) return;

    const confirmed = await showCustomConfirm("Delete Preset", `Delete preset “${preset.name}”?`, { confirmButtonClass: 'btn-danger' });
    if (confirmed) {
        await runtime.db.appearancePresets.delete(selectedId);
        await loadAppearancePresetsDropdown();
        alert("Preset deleted.");
    }
}

export async function loadThemePresetsDropdown() {
            const selectEl = document.getElementById('theme-preset-select');
            selectEl.innerHTML = "<option value=\"\">Choose a preset</option>";
            
            const presets = await runtime.db.appearancePresets.where('type').equals('bubble_theme').toArray();
            presets.forEach(preset => {
                const option = document.createElement('option');
                option.value = preset.id;
                option.textContent = preset.name;
                selectEl.appendChild(option);
            });
        }

export async function handleThemePresetSelectionChange() {
            const selectEl = document.getElementById('theme-preset-select');
            const selectedId = parseInt(selectEl.value);
            if (isNaN(selectedId)) return;
        
            const preset = await runtime.db.appearancePresets.get(selectedId);
            if (preset) {
                
                
                const baseTheme = preset.value.base || 'default';
                const customCss = preset.value.custom || '';

                
                const themeRadio = document.querySelector(`input[name="theme-select"][value="${baseTheme}"]`);
                if (themeRadio) {
                    themeRadio.checked = true;
                }

                
                const customCssInput = document.getElementById('custom-css-input');
                customCssInput.value = customCss;

                
                updateSettingsPreview(); 
                  
            }
        }

export async function saveThemePreset() {
            const name = await showCustomPrompt("Save Theme Preset", "Enter a preset name");
            if (!name || !name.trim()) return;
        
            
            
            const selectedThemeRadio = document.querySelector('input[name="theme-select"]:checked');
            const themeValue = selectedThemeRadio ? selectedThemeRadio.value : 'default';

            
            const cssValue = document.getElementById('custom-css-input').value.trim();

            
            const presetValueObject = {
                base: themeValue,
                custom: cssValue
            };
              
        
            const existingPreset = await runtime.db.appearancePresets.where({ name: name.trim(), type: 'bubble_theme' }).first();
            if (existingPreset) {
                const confirmed = await showCustomConfirm("Overwrite Preset", `A preset named “${name.trim()}” already exists. Overwrite it?`, { confirmButtonClass: 'btn-danger' });
                if (!confirmed) return;
                
                
                await runtime.db.appearancePresets.update(existingPreset.id, { value: presetValueObject });
            } else {
                await runtime.db.appearancePresets.add({
                    name: name.trim(),
                    type: 'bubble_theme',
                    
                    value: presetValueObject
                });
            }
        
            await loadThemePresetsDropdown();
            alert("Theme preset saved.");
        }

export async function deleteThemePreset() {
            const selectEl = document.getElementById('theme-preset-select');
            const selectedId = parseInt(selectEl.value);
        
            if (isNaN(selectedId)) {
                alert("Select a saved preset to delete.");
                return;
            }
        
            const preset = await runtime.db.appearancePresets.get(selectedId);
            if (!preset) return;
        
            const confirmed = await showCustomConfirm("Delete Preset", `Delete preset “${preset.name}”?`, { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                await runtime.db.appearancePresets.delete(selectedId);
                await loadThemePresetsDropdown();
                alert("Preset deleted.");
            }
        }

export async function openStickerCategoryManager() {
            await renderStickerCategoriesInManager();
            document.getElementById('sticker-category-manager-modal').classList.add('visible');
        }

export async function renderStickerCategoriesInManager() {
            const listEl = document.getElementById('existing-sticker-categories-list');
            const categories = await runtime.db.stickerCategories.toArray();
            listEl.innerHTML = '';
            if (categories.length === 0) {
                listEl.innerHTML = "<p style=\"text-align: center; color: var(--text-secondary);\">No categories yet.</p>";
                return;
            }
            categories.forEach(cat => {
                const item = document.createElement('div');
                item.className = 'existing-group-item'; 
                item.innerHTML = `
                    <span class="group-name">${cat.name}</span>
                    <span class="delete-group-btn" data-id="${cat.id}">×</span>
                `;
                listEl.appendChild(item);
            });
        }

export async function importAppearanceSettings(file) {
    if (!file) return;

    
    const confirmed = await showCustomConfirm(
        "Import Appearance Settings",
        "Replace your wallpaper, icons, fonts, CSS, and other appearance settings with this file?",
        { confirmText: '确认导入' }
    );

    if (!confirmed) return;

    try {
        
        const text = await file.text();
        const data = JSON.parse(text);

        
        if (!data.wallpaper && !data.globalCss && !data.appIcons) {
            throw new Error("文件格式不正确，缺少关键的外观设置项。");
        }

        
        
        Object.assign(runtime.state.globalSettings, data);

        
        await runtime.db.globalSettings.put(runtime.state.globalSettings);
        
        
        applyGlobalWallpaper();
        applyCPhoneWallpaper();
        applyAppIcons();
        applyCPhoneAppIcons();
        applyGlobalCss(runtime.state.globalSettings.globalCss);
        applyCustomFont(runtime.state.globalSettings.fontUrl);
        applyStatusBarVisibility();

        
        renderWallpaperScreen();
        
        
        await showCustomAlert("Import Complete", "Appearance settings imported and applied.");

    } catch (error) {
        
        console.error("导入外观设置时出错:", error);
        await showCustomAlert("Import Failed", `Could not read or apply the file: ${error.message}`);
    }
}
