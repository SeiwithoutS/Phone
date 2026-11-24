import { escapeHtml } from '../../runtime/files'
import { collectionCard } from './collection-actions.js'
import { runtime } from '../runtime/state.js'
import { showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { showScreen } from '../../app/routes'
import { cancelReplyMode } from '../chat/attachments.js'
import { startReplyToMessage } from '../chat/messages.js'
import { handleConfirmRepost, hideRepostModal } from '../qzone/feed.js'

export async function renderWorldBookScreen() {
    const books = await runtime.db.worldBooks.toArray();
    runtime.state.worldBooks = books;
    const container = document.getElementById('world-book-content-container');
    const cards = books.map(book => {
        const first = Array.isArray(book.content) ? book.content[0] : undefined;
        const preview = first?.comment || first?.content || (typeof book.content === 'string' ? book.content : '') || 'No entries yet';
        return collectionCard('worldBooks', book, preview, openWorldBookEditor, renderWorldBookScreen);
    });
    container.replaceChildren(...cards);
    if (!cards.length) {
        const empty = document.createElement('p');
        empty.className = 'phone-app-muted';
        empty.textContent = 'Use the plus button to create your first Mini Prompts book.';
        container.append(empty);
    }
}

function openWorldBookEditor(bookId) {
  showScreen('world-book-editor-screen', { bookId })
}

export function updateCachedWorldBook(book) {
  const index = runtime.state.worldBooks.findIndex(item => item.id === book.id)
  if (index !== -1) runtime.state.worldBooks[index] = book
}

export async function openWorldBookDeletionModal() {
    const modal = document.getElementById('delete-world-books-modal');
    const listEl = document.getElementById('delete-world-books-list');
    const selectAllCheckbox = document.getElementById('select-all-world-books-for-clear');
    listEl.innerHTML = '';
    selectAllCheckbox.checked = false; 

    const books = await runtime.db.worldBooks.toArray();

    if (books.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">There are no Mini Prompts books to delete.</p>";
    } else {
        books.forEach(book => {
            const item = document.createElement('div');
            item.className = 'clear-posts-item'; 
            item.dataset.bookId = book.id;
            item.innerHTML = `
                <div class="checkbox"></div>
                <span class="name">${escapeHtml(String(book.name))}</span>
            `;
            listEl.appendChild(item);
        });
    }
    
    modal.classList.add('visible');
}

export async function handleConfirmWorldBookDeletion() {
    const selectedItems = document.querySelectorAll('#delete-world-books-list .clear-posts-item.selected');
    if (selectedItems.length === 0) {
        alert("Select at least one Mini Prompts book.");
        return;
    }

    const idsToDelete = new Set(Array.from(selectedItems).map(item => item.dataset.bookId));
    
    const confirmed = await showCustomConfirm(
        "Confirm Cleanup",
        `Permanently delete ${selectedItems.length} Mini Prompts books and unlink them from all characters?`,
        { confirmButtonClass: 'btn-danger', confirmText: "Confirm Delete" }
    );

    if (!confirmed) return;
    
    await showCustomAlert("Please wait…", "Deleting…");

    try {
        const changes = await runtime.db.transaction('rw', runtime.db.worldBooks, runtime.db.chats, async tx => {
            const storedBooks = await tx.worldBooks.toArray();
            await tx.worldBooks.bulkDelete(storedBooks.filter(book => idsToDelete.has(String(book.id))).map(book => book.id));
            const links = new Map();
            for (const chat of await tx.chats.toArray()) {
                const current = chat.settings?.linkedWorldBookIds;
                if (!Array.isArray(current)) continue;
                const linkedWorldBookIds = current.filter(id => !idsToDelete.has(String(id)));
                if (linkedWorldBookIds.length === current.length) continue;
                await tx.chats.update(chat.id, { settings: { ...chat.settings, linkedWorldBookIds } });
                links.set(chat.id, linkedWorldBookIds);
            }
            return links;
        });
        for (const [id, links] of changes) {
            const chat = runtime.state.chats[id];
            if (chat) chat.settings.linkedWorldBookIds = links;
        }
        runtime.state.worldBooks = runtime.state.worldBooks.filter(book => !idsToDelete.has(String(book.id)));
        
        document.getElementById('delete-world-books-modal').classList.remove('visible');
        await showCustomAlert("Deleted", `Deleted ${selectedItems.length} Mini Prompts books.`);

    } catch (error) {
        console.error("删除世界书失败:", error);
        await showCustomAlert("Deletion Failed", `Operation failed: ${error.message}`);
    }
}

export function bindWorldBookEditor() {
  document.getElementById('add-world-book-btn').addEventListener('click', async () => { const name = await showCustomPrompt("Create Mini Prompts", "Enter a name for this Mini Prompts book"); if (name && name.trim()) { const newBook = { id: 'wb_' + Date.now(), name: name.trim(), content: [] }; await runtime.db.worldBooks.add(newBook); runtime.state.worldBooks.push(newBook); openWorldBookEditor(newBook.id); } });


}

export function bindWorldBookRelatedEvents() {
document.getElementById('repost-cancel-btn').addEventListener('click', hideRepostModal);

document.getElementById('repost-confirm-btn').addEventListener('click', handleConfirmRepost);

document.getElementById('quote-message-btn').addEventListener('click', startReplyToMessage);

document.getElementById('cancel-reply-btn').addEventListener('click', cancelReplyMode);

document.getElementById('qzone-posts-list').addEventListener('input', (e) => {
                if (!e.target.matches('.comment-input')) return;
        
                const commentInput = e.target;
                const postContainer = commentInput.closest('.qzone-post-container');
                if (!postContainer) return;
                
                const popup = postContainer.querySelector('.at-mention-popup');
                const value = commentInput.value;
                const atMatch = value.match(/@([\p{L}\w]*)$/u);
        
                if (atMatch) {
                    const namesToMention = new Set();
                    const authorNickname = postContainer.querySelector('.post-nickname')?.textContent;
                    if (authorNickname) namesToMention.add(authorNickname);
                    postContainer.querySelectorAll('.commenter-name').forEach(nameEl => {
                        namesToMention.add(nameEl.textContent.replace(':', ''));
                    });
                    namesToMention.delete(runtime.state.qzoneSettings.nickname);
        
                    popup.innerHTML = '';
                    if (namesToMention.size > 0) {
                        const searchTerm = atMatch[1];
                        namesToMention.forEach(name => {
                            if (name.toLowerCase().includes(searchTerm.toLowerCase())) {
                                const item = document.createElement('div');
                                item.className = 'at-mention-item';
                                item.textContent = name;
                                item.addEventListener('mousedown', (evt) => {
                                    evt.preventDefault();
                                    const newText = value.substring(0, atMatch.index) + `@${name} `;
                                    commentInput.value = newText;
                                    popup.style.display = 'none';
                                    commentInput.focus();
                                });
                                popup.appendChild(item);
                            }
                        });
                        popup.style.display = popup.children.length > 0 ? 'block' : 'none';
                    } else {
                        popup.style.display = 'none';
                    }
                } else {
                    popup.style.display = 'none';
                }
            });
}

export function bindWorldBookDeletion() {
  document.getElementById('confirm-delete-world-books-btn').addEventListener('click', handleConfirmWorldBookDeletion);

document.getElementById('delete-world-books-modal').addEventListener('click', (e) => {
    
    const item = e.target.closest('.clear-posts-item');
    if (item) {
        item.classList.toggle('selected');
    }
    
    if (e.target.id === 'select-all-world-books-for-clear') {
        const isChecked = e.target.checked;
        document.querySelectorAll('#delete-world-books-list .clear-posts-item').forEach(el => {
            el.classList.toggle('selected', isChecked);
        });
    }
});

}
