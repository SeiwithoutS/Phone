import { handleConfirmDataClear, handleDataClearBack } from './clear-data.js'
import { compressAllLocalImages } from './media.js'
import { checkAndFixData } from './repair.js'
import { copyMessageContent, copyMessageTimestamp } from '../chat/editor.js'
import { openWorldBookDeletionModal } from '../world-book/books.js'
import { switchToChatListView } from '../app/screen-effects.js'

export function bindDataClearEvents() {
  document.getElementById('back-to-clear-step1-btn').addEventListener('click', handleDataClearBack);

document.getElementById('cancel-clear-wizard-btn-step2').addEventListener('click', () => {
    document.getElementById('data-clear-wizard-modal').classList.remove('visible');
});

document.getElementById('confirm-final-clear-btn').addEventListener('click', handleConfirmDataClear);

document.getElementById('data-clear-wizard-modal').addEventListener('click', (e) => {
    const item = e.target.closest('.clear-posts-item');
    if (item) {
        
        e.stopPropagation();
        item.classList.toggle('selected');
    }
});

document.getElementById('data-clear-wizard-modal').addEventListener('change', (e) => {
    
    if (e.target.id === 'select-all-chars-for-clear') {
        const isChecked = e.target.checked;
        document.querySelectorAll('#data-clear-char-list .clear-posts-item').forEach(item => {
            item.classList.toggle('selected', isChecked);
        });
    } 
    
    else if (e.target.id === 'select-all-types-for-clear') {
        const isChecked = e.target.checked;
        document.querySelectorAll('#data-clear-type-list .clear-posts-item').forEach(item => {
            item.classList.toggle('selected', isChecked);
        });
    }
});

document.getElementById('compress-images-btn').addEventListener('click', compressAllLocalImages);

document.getElementById('copy-message-btn').addEventListener('click', copyMessageContent);

document.getElementById('copy-timestamp-btn').addEventListener('click', copyMessageTimestamp);

document.getElementById('npc-list-back-btn').addEventListener('click', () => {
    
    switchToChatListView('messages-view');
});
}

export function bindDataRepairEvents() {
  document.getElementById('check-and-fix-data-btn').addEventListener('click', checkAndFixData);

document.getElementById('delete-world-books-btn').addEventListener('click', openWorldBookDeletionModal);

document.getElementById('cancel-delete-world-books-btn').addEventListener('click', () => {
    document.getElementById('delete-world-books-modal').classList.remove('visible');
});
}
