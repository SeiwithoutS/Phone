import { escapeHtml } from '../../runtime/files'
import { bankAmount, bankCurrency } from '../../features/bank/bank'
import { deliveryStatus } from '../../features/shopping/market'
import { switchToCharScreen } from './launcher.js'
import { renderCharMusicScreen } from './music.js'
import { renderCharMemoList, renderCharSimulatedQQ } from './notes.js'
import { renderCharAlbum, renderCharAmap, renderCharAppUsage, renderCharBrowserHistory, taobaoStatusLabel } from './simulation.js'
import { appendMessage } from '../chat/conversation.js'
import { createChatListItem } from '../chat/list.js'
import { showCustomAlert } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export async function openCharApp(appName) {
            if (!runtime.activeCharacterId) return;
            const char = runtime.state.chats[runtime.activeCharacterId];
            
    
    await logAppUsage(runtime.activeCharacterId, appName);
      

            switch(appName) {
                case 'qq':
                    renderCharSimulatedQQ();
                    switchToCharScreen('char-qq-screen');
                    break;
                case 'album':
                    renderCharAlbum();
                    switchToCharScreen('char-album-screen');
                    break;
                case 'browser':
                    renderCharBrowserHistory();
                    switchToCharScreen('char-browser-screen');
                    break;
                case 'taobao':
                    await renderCharTaobao();
                    switchToCharScreen('char-taobao-screen');
                    break;
                case 'memo':
                    renderCharMemoList();
                    switchToCharScreen('char-memo-screen');
                    break;
                case 'amap':
                    renderCharAmap();
                    switchToCharScreen('char-amap-screen');
                    break;
                
                
                
                case 'music':
                    renderCharMusicScreen(); 
                    switchToCharScreen('char-music-screen'); 
                    break;
                

                case 'usage':
                    renderCharAppUsage();
                    switchToCharScreen('char-usage-screen');
                    break;
            }
        }

export async function renderCharTaobao() {
            const gridEl = document.getElementById('char-product-grid');
            gridEl.innerHTML = '';
            const characterId = runtime.activeCharacterId;
            const char = runtime.state.chats[characterId];
            if (!char) return;

            const orders = await runtime.db.marketOrders.toArray();
            if (runtime.activeCharacterId !== characterId) return;
            const purchases = [
                ...orders.filter(order => order.buyerId === characterId).sort((a, b) => b.timestamp - a.timestamp)
                    .map(order => ({
                        itemName: order.items.map(item => item.quantity + ' × ' + item.name).join(', '),
                        price: order.total / 100, status: deliveryStatus(order), reason: order.note,
                        image: order.items[0]?.image, marketOrder: true,
                    })),
                ...(char.storePurchases || []), ...(char.simulatedTaobaoHistory?.purchases || []),
            ];
            gridEl.replaceChildren();

            if (purchases.length === 0) {
                gridEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No orders yet.<br>Use Regenerate to create activity.</p>";
                return;
            }

            purchases.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'char-product-item';
                itemEl.dataset.reason = item.reason;
                
                let imageOrTextHtml;
                if (item.image) {
                    imageOrTextHtml = `<img src="${escapeHtml(item.image)}" alt="" class="product-image">`;
                } else if (!item.marketOrder && runtime.state.globalSettings.enableAiDrawing) {
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(item.image_prompt || 'a random product')}`;
                    imageOrTextHtml = `<img src="${imageUrl}" class="product-image">`;
                } else {
                    imageOrTextHtml = `
                        <div class="char-product-description-overlay">
                            <p class="char-photo-description">${escapeHtml(String(item.reason || "")) || '(无购买理由)'}</p>
                        </div>
                    `;
                }

                
                itemEl.innerHTML = `
                    ${imageOrTextHtml}
                    <div class="product-info">
                        <div class="product-name">${escapeHtml(String(item.itemName || ""))}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                            <div class="product-price">${escapeHtml(bankAmount(Math.round((Number(item.price) || 0) * 100), bankCurrency(runtime.db)))}</div>
                            <div class="char-product-status">${escapeHtml(String(taobaoStatusLabel(item.status)))}</div>
                        </div>
                    </div>
                `;
                  
                gridEl.appendChild(itemEl);
            });
        }

export function renderCharChatList() {
    const listEl = document.getElementById('char-chat-list');
    listEl.innerHTML = '';
    if (!runtime.activeCharacterId) return;

    
    const relatedChats = Object.values(runtime.state.chats).filter(chat => {
        
        if (chat.id === runtime.activeCharacterId) return true;
        
        if (chat.isGroup && chat.members.some(m => m.id === runtime.activeCharacterId)) return true;
        return false;
    });

    relatedChats.forEach(chat => {
        const item = createChatListItem(chat); 
        listEl.appendChild(item);
    });
}

export async function logAppUsage(characterId, appName) {
    const char = runtime.state.chats[characterId];
    if (!char) return;
    if (!char.appUsageLog) {
        char.appUsageLog = [];
    }
    char.appUsageLog.push({
        appName: appName,
        timestamp: Date.now()
    });
    
    if (char.appUsageLog.length > 50) {
        char.appUsageLog.shift();
    }
    await runtime.db.chats.put(char);
}

export async function sendCharLocationShare(locationName) {
    const userChat = runtime.state.chats[runtime.activeCharacterId]; 
    if (!userChat) return;

    const msg = {
        role: 'assistant', 
        senderName: userChat.originalName,
        type: 'location_share',
        content: locationName,
        imageUrl: 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1756262526935_qdqqd_4uque3.jpeg',
        timestamp: Date.now()
    };

    userChat.history.push(msg);
    await runtime.db.chats.put(userChat);
    
    
    if (runtime.state.activeChatId === runtime.activeCharacterId) {
        appendMessage(msg, userChat);
    }
    
    await showCustomAlert("Shared", `Shared “${userChat.name}” in the chat.`);
}
