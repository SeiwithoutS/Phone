import { preferences } from '../storage/preferences.js'
import { createMessageElement } from '../chat/conversation.js'
import { renderLongTermMemoryList } from '../memories/memories.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'

export function applyScopedCss(cssString, scopeId, styleTagId) {
    const styleTag = document.getElementById(styleTagId);
    if (!styleTag) return;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssString || '');
    function scopeRules(rules) {
        for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
                const selector = rule.selectorText.replace(/#(?:chat-messages|settings-preview-area)\s*/g, '');
                rule.selectorText = scopeId + ' :is(' + selector + ')';
            } else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
                scopeRules(rule.cssRules);
            }
        }
    }
    scopeRules(sheet.cssRules);
    styleTag.textContent = [...sheet.cssRules].filter(rule =>
        rule instanceof CSSStyleRule || rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule ||
        rule instanceof CSSKeyframesRule).map(rule => rule.cssText).join('\n');
}

let previewVersion = 0;

export async function updateSettingsPreview() {
            if (!runtime.state.activeChatId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const previewArea = document.getElementById('settings-preview-area');
            if (!previewArea) return;
        
            
            const selectedTheme = document.querySelector('input[name="theme-select"]:checked')?.value || 'default';
            const fontSize = document.getElementById('font-size-slider').value;
            const customCss = document.getElementById('custom-css-input').value;
            const background = document.getElementById('bg-preview').getAttribute('src') ||
                runtime.state.globalSettings.globalChatBackground;
            const version = ++previewVersion;
        
            
            previewArea.dataset.theme = selectedTheme;
            previewArea.style.setProperty('--chat-font-size', `${fontSize}px`);
            
            previewArea.style.backgroundImage = background ? `url(${JSON.stringify(background)})` : 'none';
            previewArea.style.backgroundColor = document.getElementById('phone-screen').classList.contains('dark-mode')
                ? '#000' : '#f0f2f5';
            const [aiBubble, userBubble] = await Promise.all([
                createMessageElement({ role: 'ai', content: 'Hi there!', timestamp: 1, senderName: chat.name }, chat),
                createMessageElement({ role: 'user', content: 'This is your chat preview.', timestamp: 2 }, chat),
            ]);
            if (version !== previewVersion) return;
            previewArea.replaceChildren(...[aiBubble, userBubble].filter(Boolean));

            const previewLyricsBar = document.createElement('div');
            previewLyricsBar.style.cssText = `
                position: absolute; 
                font-size: 11px; 
                padding: 2px 6px; 
                border-radius: 8px; 
                background-color: rgba(0, 0, 0, 0.1); 
                color: var(--text-secondary); 
                white-space: nowrap; 
                transition: all 0.3s ease;
            `;
            previewLyricsBar.textContent = "♪ Lyrics preview ♪";
            previewArea.appendChild(previewLyricsBar);
            
            const vertical = document.getElementById('lyrics-vertical-pos').value;
            const horizontal = document.getElementById('lyrics-horizontal-pos').value;
            const offset = parseInt(document.getElementById('lyrics-offset-input').value) || 10;
        
            if (vertical === 'top') {
                previewLyricsBar.style.top = `${offset}px`;
            } else {
                previewLyricsBar.style.bottom = `${offset}px`;
            }
            
            switch (horizontal) {
                case 'left':
                    previewLyricsBar.style.left = '15px';
                    break;
                case 'right':
                    previewLyricsBar.style.right = '15px';
                    break;
                default:
                    previewLyricsBar.style.left = '50%';
                    previewLyricsBar.style.transform = 'translateX(-50%)';
                    break;
            }
            
            
            applyScopedCss(customCss, '#settings-preview-area', 'preview-bubble-style');
        }

export function applyTheme(theme) {
            const phoneScreen = document.getElementById('phone-screen');
            const toggleSwitch = document.getElementById('theme-toggle-switch');
            
            const isDark = theme === 'dark';
            
            phoneScreen.classList.toggle('dark-mode', isDark);
            
            
            if (toggleSwitch) {
                toggleSwitch.checked = isDark;
            }
            
            preferences.setItem('ephone-theme', theme);
        }

export function toggleTheme() {
            const toggleSwitch = document.getElementById('theme-toggle-switch');
            
            const newTheme = toggleSwitch.checked ? 'dark' : 'light';
            applyTheme(newTheme);
        }

export function openLongTermMemoryScreen() {
            if (!runtime.state.activeChatId) return;
            renderLongTermMemoryList();
            showScreen('long-term-memory-screen');
        }

export function applyGlobalCss(cssString) {
            const styleTag = document.getElementById('global-custom-style');
            if (styleTag) {
                
                styleTag.innerHTML = cssString || '';
            }
        }

export async function addMusicActionSystemMessage(actionText) {
            
            if (!runtime.musicState.isActive || !runtime.musicState.activeChatId) return;
            const chat = runtime.state.chats[runtime.musicState.activeChatId];
            if (!chat) return;
        
            
            const myNickname = chat.isGroup ? (chat.settings.myNickname || '我') : '我';
            const fullMessage = `[系统提示：用户 (${myNickname}) ${actionText}]`;
        
            
            const systemMessage = {
                role: 'system',
                content: fullMessage,
                timestamp: Date.now(),
                isHidden: true 
            };
        
            
            chat.history.push(systemMessage);
            await runtime.db.chats.put(chat);
        }
