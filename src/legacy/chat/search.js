import { createMessageElement, scrollToOriginalMessage } from './conversation.js'
import { formatChatActionNotice } from '../../features/chat/action-notices'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'

export function openSearchHistoryScreen() {
    if (!runtime.state.activeChatId) return;
    
    
    document.getElementById('keyword-search-input').value = '';
    document.getElementById('date-search-input').value = '';
    
    document.getElementById('chat-search-results-list').innerHTML = `<p style="text-align:center; color: var(--text-secondary);">Enter a keyword or select a date.</p>`;
    
    
    showScreen('search-history-screen');
}

export async function handleSearchHistory() {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return;

    const keyword = document.getElementById('keyword-search-input').value.trim().toLowerCase();
    const dateValue = document.getElementById('date-search-input').value;

    if (!keyword && !dateValue) {
        alert("Enter a keyword or select a date.");
        return;
    }

    let results = chat.history.filter(msg => !msg.isHidden);

    
    if (keyword) {
        results = results.filter(msg => {
            let contentString = '';
            
            if (typeof msg.content === 'string') {
                contentString = msg.content;
            } else if (msg.type === 'voice_message') {
                contentString = msg.content;
            } else if (msg.type === 'ai_image' || msg.type === 'user_photo') {
                contentString = msg.content;
            } else if (msg.type === 'offline_text') {
                contentString = `${msg.dialogue || ''} ${msg.description || ''}`;
            } else if (msg.quote) {
                 contentString = msg.content;
            }
            const displayed = formatChatActionNotice(msg, runtime.state.globalSettings.qqActionLanguage);
            return String(contentString ?? '').toLowerCase().includes(keyword) || displayed.toLowerCase().includes(keyword);
        });
    }

    
    if (dateValue) {
        const selectedDate = new Date(`${dateValue}T00:00:00`);
        const startOfDay = selectedDate.getTime();
        const nextDay = selectedDate.setDate(selectedDate.getDate() + 1);
        
        results = results.filter(msg => msg.timestamp >= startOfDay && msg.timestamp < nextDay);
    }
    
    
    await renderSearchResults(results);
}

export async function renderSearchResults(results) {
    const listEl = document.getElementById('chat-search-results-list');
    const chat = runtime.state.chats[runtime.state.activeChatId];
    listEl.innerHTML = '';

    if (results.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary);\">No matching messages.</p>";
        return;
    }

    let lastDateString = '';
    for (const msg of results) {
        const msgDate = new Date(msg.timestamp);
        const currentDateString = msgDate.toLocaleDateString();

        if (currentDateString !== lastDateString) {
            const dateSeparator = document.createElement('div');
            dateSeparator.className = 'date-separator';
            dateSeparator.textContent = `--- ${msgDate.getFullYear()}-${msgDate.getMonth() + 1}-${msgDate.getDate()} ---`;
            listEl.appendChild(dateSeparator);
            lastDateString = currentDateString;
        }

        const messageEl = await createMessageElement(msg, chat);
        if (messageEl) {
            
            
            messageEl.style.cursor = 'pointer';
            
            messageEl.addEventListener('click', () => jumpToOriginalMessage(msg.timestamp));
              
            listEl.appendChild(messageEl);
        }
    }
}

export function jumpToOriginalMessage(timestamp) {
    const chatId = runtime.state.activeChatId;
    if (!runtime.state.chats[chatId]) return;
    showScreen('chat-interface-screen');
    setTimeout(() => scrollToOriginalMessage(timestamp, chatId), 200);
}

export async function clearSearchFilters() {
    document.getElementById('keyword-search-input').value = '';
    document.getElementById('date-search-input').value = '';
    
    await renderSearchResults(runtime.state.chats[runtime.state.activeChatId].history.filter(msg => !msg.isHidden));
}
