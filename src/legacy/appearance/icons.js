import { showChoiceModal, showCustomPrompt } from '../dialogs/dialogs.js'
import { uploadImageLocally } from '../home/widgets.js'
import { runtime } from '../runtime/state.js'

export function applyAppIcons() {
            if (!runtime.state.globalSettings.appIcons) return;
        
            for (const iconId in runtime.state.globalSettings.appIcons) {
                const imgElement = document.getElementById(`icon-img-${iconId}`);
                if (imgElement) {
                    imgElement.hidden = false;
                    imgElement.src = runtime.state.globalSettings.appIcons[iconId];
                }
            }
        }

export async function handleIconChange(iconId, phoneType, itemElement) {
            const appName = itemElement.querySelector('.icon-preview').alt;
        
            
            const choice = await showChoiceModal(`更换“${appName}”图标`, [
                { text: '📁 从本地上传', value: 'local' },
                { text: '🌐 使用网络URL', value: 'url' }
            ]);
        
            let newUrl = null;
        
            
            if (choice === 'local') {
                
                newUrl = await uploadImageLocally();
            } else if (choice === 'url') {
                const currentUrl = (phoneType === 'cphone')
                    ? runtime.state.globalSettings.cphoneAppIcons[iconId]
                    : runtime.state.globalSettings.appIcons[iconId];

                
                
                const isBase64 = !currentUrl || currentUrl.startsWith('data:image');

                
                
                const initialValueForPrompt = isBase64 ? '' : currentUrl;
                

                
                newUrl = await showCustomPrompt(
                    `Change Icon`, 
                    "Enter an image URL", 
                    initialValueForPrompt, 
                    'url'
                );
            }
        
            
            if (newUrl && newUrl.trim()) {
                const trimmedUrl = newUrl.trim();
                
                
                if (phoneType === 'cphone') {
                    runtime.state.globalSettings.cphoneAppIcons[iconId] = trimmedUrl;
                } else {
                    runtime.state.globalSettings.appIcons[iconId] = trimmedUrl;
                }
                
                
                itemElement.querySelector('.icon-preview').src = trimmedUrl;
                
                
            } else if (newUrl !== null) {
                
                alert("Enter a valid URL or select a file.");
            }
        }
