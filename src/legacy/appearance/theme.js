import { preferences } from '../storage/preferences.js'
import { createMessageElement } from '../chat/conversation.js'
import { renderLongTermMemoryList } from '../memories/memories.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'

export function applyScopedCss(cssString, scopeId, styleTagId) {
            const styleTag = document.getElementById(styleTagId);
            if (!styleTag) return;
            
            if (!cssString || cssString.trim() === '') {
                styleTag.innerHTML = '';
                return;
            }
            
            
            const scopedCss = cssString
                .replace(/\s*\.message-bubble\.user\s+([^{]+\{)/g, `${scopeId} .message-bubble.user $1`)
                .replace(/\s*\.message-bubble\.ai\s+([^{]+\{)/g, `${scopeId} .message-bubble.ai $1`)
                .replace(/\s*\.message-bubble\s+([^{]+\{)/g, `${scopeId} .message-bubble $1`);
            
            styleTag.innerHTML = scopedCss;
        }

export async function updateSettingsPreview() {
            if (!runtime.state.activeChatId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const previewArea = document.getElementById('settings-preview-area');
            if (!previewArea) return;
        
            
            const selectedTheme = document.querySelector('input[name="theme-select"]:checked')?.value || 'default';
            const fontSize = document.getElementById('font-size-slider').value;
            const customCss = document.getElementById('custom-css-input').value;
            const background = chat.settings.background; 
        
            
            previewArea.dataset.theme = selectedTheme;
            previewArea.style.setProperty('--chat-font-size', `${fontSize}px`);
            
            if (background && background.startsWith('data:image')) {
                previewArea.style.backgroundImage = `url(${background})`;
                previewArea.style.backgroundColor = 'transparent';
            } else {
                previewArea.style.backgroundImage = 'none';
                previewArea.style.background = background || '#f0f2f5';
            }
        
            
            previewArea.innerHTML = ''; 
        
            
            const aiMsg = { role: 'ai', content: '对方消息预览', timestamp: 1, senderName: chat.name };
            const aiBubble = await createMessageElement(aiMsg, chat); 
            if(aiBubble) previewArea.appendChild(aiBubble);
        
            
            const userMsg = { role: 'user', content: '我的消息预览', timestamp: 2 };
            const userBubble = await createMessageElement(userMsg, chat); 
            if(userBubble) previewArea.appendChild(userBubble);
            
            
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
