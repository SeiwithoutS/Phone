import { updateBackButtonUnreadCount } from '../backup/backup.js'
import { openChat } from '../chat/conversation.js'
import { runtime } from '../runtime/state.js'

export function showNotification(chatId, messageContent) {
    
    playNotificationSound();
    
            clearTimeout(runtime.notificationTimeout);
            const chat = runtime.state.chats[chatId];
            if (!chat) return;
        
            
            const bar = document.getElementById('notification-bar');
            
            
            document.getElementById('notification-avatar').src = chat.settings.aiAvatar || chat.settings.groupAvatar || runtime.defaultAvatar;
            document.getElementById('notification-content').querySelector('.name').textContent = chat.name;
            document.getElementById('notification-content').querySelector('.message').textContent = messageContent;
            
            
            
            bar.classList.remove('visible');
            
            
            void bar.offsetWidth; 
            
            
            bar.classList.add('visible');
            
            
            const newBar = bar.cloneNode(true);
            bar.parentNode.replaceChild(newBar, bar);
            newBar.addEventListener('click', () => {
                openChat(chatId);
                newBar.classList.remove('visible');
            });
        
            
            runtime.notificationTimeout = setTimeout(() => {
                newBar.classList.remove('visible');
            }, 4000);
updateBackButtonUnreadCount();
        }

export function updateClock() { 
    const now = new Date(); 
    const timeString = now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }); 
    const dateString = now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }); 
    
    
    document.getElementById('status-bar-time').textContent = timeString; 
    
}

export function showBatteryAlert(imageUrl, text) { clearTimeout(runtime.batteryAlertTimeout); document.getElementById('battery-alert-image').src = imageUrl; document.getElementById('battery-alert-text').textContent = text; runtime.batteryAlertModal.classList.add('visible'); const closeAlert = () => { runtime.batteryAlertModal.classList.remove('visible'); runtime.batteryAlertModal.removeEventListener('click', closeAlert); }; runtime.batteryAlertModal.addEventListener('click', closeAlert); runtime.batteryAlertTimeout = setTimeout(closeAlert, 2000); }

export function updateBatteryDisplay(battery) { const batteryContainer = document.getElementById('status-bar-battery'); const batteryLevelEl = batteryContainer.querySelector('.battery-level'); const batteryTextEl = batteryContainer.querySelector('.battery-text'); const level = Math.floor(battery.level * 100); batteryLevelEl.style.width = `${level}%`; batteryTextEl.textContent = `${level}%`; if (battery.charging) { batteryContainer.classList.add('charging'); } else { batteryContainer.classList.remove('charging'); } }

export function handleBatteryChange(battery) { updateBatteryDisplay(battery); const level = battery.level; if (!battery.charging) { if (level <= 0.4 && runtime.lastKnownBatteryLevel > 0.4 && !runtime.alertFlags.hasShown40) { showBatteryAlert('https://i.postimg.cc/T2yKJ0DV/40.jpg', '有点饿了，可以去找充电器惹'); runtime.alertFlags.hasShown40 = true; } if (level <= 0.2 && runtime.lastKnownBatteryLevel > 0.2 && !runtime.alertFlags.hasShown20) { showBatteryAlert('https://i.postimg.cc/qB9zbKs9/20.jpg', '赶紧的充电，要饿死了'); runtime.alertFlags.hasShown20 = true; } if (level <= 0.1 && runtime.lastKnownBatteryLevel > 0.1 && !runtime.alertFlags.hasShown10) { showBatteryAlert('https://i.postimg.cc/ThMMVfW4/10.jpg', '已阵亡，还有30秒爆炸'); runtime.alertFlags.hasShown10 = true; } } if (level > 0.4) runtime.alertFlags.hasShown40 = false; if (level > 0.2) runtime.alertFlags.hasShown20 = false; if (level > 0.1) runtime.alertFlags.hasShown10 = false; runtime.lastKnownBatteryLevel = level; }

export async function initBatteryManager() { if ('getBattery' in navigator) { try { const battery = await navigator.getBattery(); runtime.lastKnownBatteryLevel = battery.level; handleBatteryChange(battery); battery.addEventListener('levelchange', () => handleBatteryChange(battery)); battery.addEventListener('chargingchange', () => { handleBatteryChange(battery); if (battery.charging) { showBatteryAlert('https://i.postimg.cc/3NDQ0dWG/image.jpg', 'Charging'); } }); } catch (err) { console.error("无法获取电池信息:", err); document.querySelector('.battery-text').textContent = 'ᗜωᗜ'; } } else { console.log("浏览器不支持电池状态API。"); document.querySelector('.battery-text').textContent = 'ᗜωᗜ'; } }

const receivedSound = import.meta.env.BASE_URL + 'message-received.wav';
const sentSound = import.meta.env.BASE_URL + 'message-sent.wav';
let lastReceivedSound = 0;

export async function previewMessageSound(kind = 'received', customUrl = '') {
    const player = document.getElementById('notification-sound-player');
    const url = kind === 'sent' ? sentSound : customUrl || receivedSound;
    if (player.getAttribute('src') !== url) player.src = url;
    player.currentTime = 0;
    await player.play();
}

export function playNotificationSound(kind = 'received') {
    const settings = runtime.state.globalSettings;
    if (settings.messageSounds === false) return;
    if (kind === 'received') {
        const now = Date.now();
        if (now - lastReceivedSound < 240) return;
        lastReceivedSound = now;
    }
    void previewMessageSound(kind, settings.notificationSoundUrl).catch(error => {
        if (kind === 'received' && settings.notificationSoundUrl && error.name !== 'NotAllowedError') {
            void previewMessageSound().catch(() => {});
        }
    });
}

export function formatReadingStateForAI(chatId) {
    const session = runtime.readingState[chatId];
    
    
    if (!session || !session.isActive) {
        return "";
    }

    const title = session.title || '未知书籍';
    let contentForAI = '';
    let contextLabel = '';

    
    if (session.currentSnippet && session.currentSnippet.trim()) {
        contentForAI = session.currentSnippet;
        contextLabel = '你正在阅读的段落';
    } else if (session.contentLines.length > 0) {
        const startLine = session.currentPage * session.linesPerPage;
        const endLine = startLine + session.linesPerPage;
        contentForAI = session.contentLines.slice(startLine, endLine).join('\n').substring(0, 200);
        contextLabel = '当前页内容摘要';
    } else {
        contentForAI = '(无内容)';
        contextLabel = '内容';
    }
    return `
    - **书名**: 《${title}》
    - **${contextLabel}**: "${contentForAI}..."
    #一起读书模式 | 行为铁律
    1.  **角色定位**: 你【不是】书中的任何角色，你是【你自己】(${runtime.state.chats[chatId]?.originalName || 'AI角色'})，正在和用户一起【阅读和讨论】这本书。
    2.  **行为准则**: 你的回复【必须】是作为读者的【感想、评论、提问或联想】。你可以：
        -   分享你对当前段落的看法。
        -   对书中的角色或情节发表评论。
        -   向用户提问，询问TA对内容的看法。
        -   根据书本内容，联想到你自己的经历或记忆。
    3.  **严禁**: 你的回复【绝对禁止】使用书中角色的口吻和人称！【绝对禁止】扮演书中的任何角色！【绝对禁止】续写或模仿书中的情节！你必须时刻记住，你只是一个读者。    
`;
}

export function updateReadingContextOnScroll() {
    const chatId = runtime.state.activeChatId;
    if (!chatId || !runtime.readingState[chatId]) return;

    const session = runtime.readingState[chatId];
    const container = document.getElementById('reading-content');
    
    
    
    

    
    const scrollTop = container.scrollTop; 
    const clientHeight = container.clientHeight; 
    const scrollBottom = scrollTop + clientHeight; 

    
    const approximateLineHeight = 15 * 1.8; 

    
    const firstVisibleLine = Math.floor(scrollTop / approximateLineHeight);
    const lastVisibleLine = Math.ceil(scrollBottom / approximateLineHeight);

    
    const absoluteStartIndex = (session.currentPage * session.linesPerPage) + firstVisibleLine;
    const absoluteEndIndex = (session.currentPage * session.linesPerPage) + lastVisibleLine;

    
    if (absoluteStartIndex < 0 || absoluteStartIndex >= session.contentLines.length) {
        return;
    }

    
    const newSnippet = session.contentLines.slice(
        Math.max(0, absoluteStartIndex), 
        Math.min(session.contentLines.length, absoluteEndIndex)
    ).join('\n');
    
    
    session.currentSnippet = newSnippet;
}
