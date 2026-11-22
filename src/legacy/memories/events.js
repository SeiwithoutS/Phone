import { summarizeExistingLongTermMemory } from '../api/client.js'
import { deleteApiPreset, handlePresetSelectionChange, saveApiPreset } from '../api/settings.js'
import { openLongTermMemoryScreen } from '../appearance/theme.js'
import { hideThoughtsHistory, loadMoreThoughts, showThoughtsHistory } from '../character-phone/profile.js'
import { handleSwitchGreeting } from '../chat/import.js'
import { handleAddManualMemory, handleDeleteMemory, handleEditMemory, handleManualSummary } from './memories.js'
import { loadMoreQzonePosts } from '../qzone/feed.js'
import { handlePostClick } from '../qzone/gestures.js'
import { executeBatchDeleteStickers, toggleStickerManagementMode } from '../stickers/stickers.js'
import { showScreen } from '../../app/routes'
import { controls } from '../runtime/state.js'
import { runtime } from '../runtime/state.js'

export function bindMemoryEditorEvents() {
  controls.postsList.addEventListener('click', handlePostClick);

controls.postsList.addEventListener('mousedown', controls.handleSwipeStart);

controls.postsList.addEventListener('touchstart', controls.handleSwipeStart, { passive: true });

controls.postsList.addEventListener('click', (e) => {
            
            if (e.target && e.target.id === 'load-more-qzone-btn') {
                loadMoreQzonePosts();
            }
        });

document.getElementById('refine-memory-btn-header').addEventListener('click', () => {
            if(runtime.state.activeChatId) {
                summarizeExistingLongTermMemory(runtime.state.activeChatId);
            }
        });

document.getElementById('api-preset-select').addEventListener('change', handlePresetSelectionChange);

document.getElementById('save-api-preset-btn').addEventListener('click', saveApiPreset);

document.getElementById('delete-api-preset-btn').addEventListener('click', deleteApiPreset);



document.getElementById('switch-greeting-btn').addEventListener('click', handleSwitchGreeting);

document.getElementById('thoughts-history-list').addEventListener('click', (e) => {
            if (e.target && e.target.id === 'load-more-thoughts-btn') {
                loadMoreThoughts();
            }
        });

document.getElementById('profile-history-icon-btn').addEventListener('click', showThoughtsHistory);

document.getElementById('history-back-btn').addEventListener('click', hideThoughtsHistory);

document.getElementById('character-profile-modal').addEventListener('click', (e) => {
            
            if (e.target.id === 'character-profile-modal') {
                e.target.classList.remove('visible');
            }
        });

document.getElementById('manage-stickers-btn').addEventListener('click', toggleStickerManagementMode);

document.getElementById('delete-selected-stickers-btn').addEventListener('click', executeBatchDeleteStickers);
}

export function bindMemoryNavigation() {
  document.getElementById('open-memory-screen-btn').addEventListener('click', openLongTermMemoryScreen);

document.getElementById('memory-screen-back-btn').addEventListener('click', () => {
            showScreen('chat-interface-screen');
        });

document.getElementById('add-manual-memory-btn-header').addEventListener('click', handleAddManualMemory);

document.getElementById('summarize-recent-btn-header').addEventListener('click', handleManualSummary);

document.getElementById('memory-list-container').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-memory-btn');
    if (editBtn) {
        handleEditMemory(editBtn.dataset.authorId, parseInt(editBtn.dataset.memoryTimestamp));
        return;
    }
    const deleteBtn = e.target.closest('.delete-memory-btn');
    if (deleteBtn) {
        handleDeleteMemory(deleteBtn.dataset.authorId, parseInt(deleteBtn.dataset.memoryTimestamp));
        return;
    }
});
}
