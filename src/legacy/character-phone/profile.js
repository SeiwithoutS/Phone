import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { hideLoader, showLoader } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export function showCharacterProfileModal(chatId) {
            const chat = runtime.state.chats[chatId];
            if (!chat || chat.isGroup) return;
        
            
            
           
           
            document.getElementById('profile-heartfelt-voice').textContent = chat.heartfeltVoice || '...';
            document.getElementById('profile-random-jottings').textContent = chat.randomJottings || '...';

            const modal = document.getElementById('character-profile-modal');
        
            
            
            
            
            modal.classList.add('visible');
        }

export function showThoughtsHistory() {
            document.getElementById('profile-main-content').style.display = 'none';
            document.getElementById('profile-thoughts-history-view').style.display = 'flex';
            renderThoughtsHistory();
        }

export function hideThoughtsHistory() {
    document.getElementById('profile-thoughts-history-view').style.display = 'none';
    
    
    document.getElementById('profile-main-content').style.display = 'flex'; 
}

export function renderThoughtsHistory() {
            const listEl = document.getElementById('thoughts-history-list');
            const chat = runtime.state.chats[runtime.state.activeChatId];
            listEl.innerHTML = '';
            
            if (!chat || !chat.thoughtsHistory || chat.thoughtsHistory.length === 0) {
                listEl.innerHTML = "<p style=\"text-align:center; color: #8a8a8a; padding: 30px 0;\">No history yet.</p>";
                return;
            }
        
            const history = [...chat.thoughtsHistory].reverse(); 
            const initialItems = history.slice(0, runtime.THOUGHTS_RENDER_WINDOW);
            
            initialItems.forEach(thought => {
                const card = createThoughtCard(thought);
                listEl.appendChild(card);
            });
        
            runtime.thoughtsHistoryRenderCount = initialItems.length;
        

if (history.length > runtime.thoughtsHistoryRenderCount) {
    appendLoadMoreThoughtsButton(listEl); 
}
        }

function appendLoadMoreThoughtsButton(list) {
    if (list.querySelector('.load-more-thoughts')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'form-button load-more-thoughts';
    button.textContent = 'Load Older Entries';
    button.addEventListener('click', loadMoreThoughts, { once: true });
    list.appendChild(button);
}

export async function loadMoreThoughts() {
    if (runtime.isLoadingMoreThoughts) return;
    runtime.isLoadingMoreThoughts = true;

    const listEl = document.getElementById('thoughts-history-list');
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) { 
        runtime.isLoadingMoreThoughts = false; 
        return; 
    }

    listEl.querySelector('.load-more-thoughts')?.remove();
    showLoader(listEl, 'bottom'); 
    await new Promise(resolve => setTimeout(resolve, 500)); 

    const history = [...chat.thoughtsHistory].reverse();
    const totalItems = history.length;

    const nextSliceStart = runtime.thoughtsHistoryRenderCount;
    const nextSliceEnd = runtime.thoughtsHistoryRenderCount + runtime.THOUGHTS_RENDER_WINDOW;
    const itemsToAppend = history.slice(nextSliceStart, nextSliceEnd);

    
    hideLoader(listEl);

    itemsToAppend.forEach(thought => {
        const card = createThoughtCard(thought);
        listEl.appendChild(card);
    });

    runtime.thoughtsHistoryRenderCount += itemsToAppend.length;
    if (runtime.thoughtsHistoryRenderCount < totalItems) appendLoadMoreThoughtsButton(listEl);

    runtime.isLoadingMoreThoughts = false;
}

export function createThoughtCard(thought) {
    const card = document.createElement('div');
    card.className = 'thought-card';
    const date = new Date(thought.timestamp);
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    
    
    card.innerHTML = `
        <button class="thought-delete-btn" data-timestamp="${thought.timestamp}" title="Delete Entry">×</button>
        <div class="thought-header">${dateString}</div>
        <div class="thought-content">
            <div class="voice">
                <div class="label">
                    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    Inner Monologue
                </div>
                <p class="text">${thought.heartfeltVoice}</p>
            </div>
            <div class="jottings">
                <div class="label">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path></svg>
                    Notes
                </div>
                <p class="text">${thought.randomJottings}</p>
            </div>
        </div>
    `;
    return card;
}

export async function handleDeleteThought(timestamp) {
    const confirmed = await showCustomConfirm(
        "Confirm Delete",
        "Permanently delete this inner monologue?",
        { confirmButtonClass: 'btn-danger', confirmText: "Confirm Delete" }
    );

    if (confirmed) {
        const chat = runtime.state.chats[runtime.state.activeChatId];
        if (!chat || !chat.thoughtsHistory) return;

        const indexToDelete = chat.thoughtsHistory.findIndex(thought => thought.timestamp === timestamp);
        if (indexToDelete === -1) return; 

   
        const isLatest = indexToDelete === chat.thoughtsHistory.length - 1;

 
        chat.thoughtsHistory = chat.thoughtsHistory.filter(thought => thought.timestamp !== timestamp);


        if (isLatest) {
            if (chat.thoughtsHistory.length > 0) {

                const newLatestThought = chat.thoughtsHistory[chat.thoughtsHistory.length - 1];
                chat.heartfeltVoice = newLatestThought.heartfeltVoice;
                chat.randomJottings = newLatestThought.randomJottings;

                const heartfeltVoiceEl = document.getElementById('profile-heartfelt-voice');
                const randomJottingsEl = document.getElementById('profile-random-jottings');
                if (heartfeltVoiceEl) heartfeltVoiceEl.textContent = chat.heartfeltVoice;
                if (randomJottingsEl) randomJottingsEl.textContent = chat.randomJottings;

                console.log("已删除最新心声，当前心声已回滚至上一条。");
            } else {

                chat.heartfeltVoice = '...';
                chat.randomJottings = '...';


                const heartfeltVoiceEl = document.getElementById('profile-heartfelt-voice');
                const randomJottingsEl = document.getElementById('profile-random-jottings');
                if (heartfeltVoiceEl) heartfeltVoiceEl.textContent = chat.heartfeltVoice;
                if (randomJottingsEl) randomJottingsEl.textContent = chat.randomJottings;

                console.log("已删除最后一条心声，当前心声已重置。");
            }
        }

        await runtime.db.chats.put(chat);


        renderThoughtsHistory();

        await showCustomAlert("Success", "Entry deleted.");
    }
}
