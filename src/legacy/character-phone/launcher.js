import { applyCPhoneAppIcons, applyCPhoneWallpaper } from './settings.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'

export function openCharacterSelector() {
    renderCharacterSelector();
    showScreen('character-selection-screen');
}

export function renderCharacterSelector() {
    const gridEl = document.getElementById('character-grid');
    gridEl.innerHTML = '';
    
    
    const characters = Object.values(runtime.state.chats).filter(chat => !chat.isGroup);

    if (characters.length === 0) {
        gridEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No character phones yet.</p>";
        return;
    }

    characters.forEach(char => {
        const item = document.createElement('div');
        item.className = 'character-select-item';
        item.innerHTML = `
            <img src="${char.settings.aiAvatar || runtime.defaultAvatar}" class="avatar">
            <span class="name">${char.name}</span>
        `;
        item.addEventListener('click', () => switchToCharacterPhone(char.id));
        gridEl.appendChild(item);
    });
}

export async function switchToCharacterPhone(characterId) {
            runtime.activeCharacterId = characterId;
            console.log(`已切换到角色 ${characterId} 的手机`);
            
            
            applyCPhoneWallpaper();
            applyCPhoneAppIcons();
            
            
            renderCharHomeScreen();
            showScreen('character-phone-screen');
        }

export function switchToMyPhone() {
    runtime.activeCharacterId = null;
    console.log("已返回我的手机");
    showScreen('home-screen');
}

export function renderCharHomeScreen() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
    document.getElementById('char-main-time').textContent = timeString;
    document.getElementById('char-main-date').textContent = dateString;
    switchToCharScreen('char-home-screen');
}

export function switchToCharScreen(screenId) {
    document.querySelectorAll('.char-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

export function switchToCharHomeScreen() {
    switchToCharScreen('char-home-screen');
}
