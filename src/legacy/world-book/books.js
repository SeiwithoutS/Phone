import { runtime } from '../runtime/state.js'
import { addLongPressListener, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { showScreen } from '../../app/routes'
import { cancelReplyMode } from '../chat/attachments.js'
import { startReplyToMessage } from '../chat/messages.js'
import { handleConfirmRepost, hideRepostModal } from '../qzone/feed.js'
import { renderStickerPanel } from '../stickers/stickers.js'

export function switchWorldBookCategory(categoryId) {
            
            document.querySelectorAll('#world-book-tabs .world-book-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.categoryId === categoryId);
            });
            
            document.querySelectorAll('.world-book-category-pane').forEach(pane => {
                pane.classList.toggle('active', pane.dataset.categoryId === categoryId);
            });
        }

export async function renderWorldBookScreen() {
            const tabsContainer = document.getElementById('world-book-tabs');
            const contentContainer = document.getElementById('world-book-content-container');
            const selected = tabsContainer.querySelector('.active')?.dataset.categoryId ?? 'all';
        
            
            const [books, categories] = await Promise.all([
                runtime.db.worldBooks.toArray(),
                runtime.db.worldBookCategories.orderBy('name').toArray()
            ]);
        
            tabsContainer.replaceChildren();
            contentContainer.replaceChildren();
            runtime.state.worldBooks = books; 
        
            if (books.length === 0) {
                contentContainer.innerHTML = "<p style=\"text-align:center; color: #8a8a8a; margin-top: 50px;\">Use the plus button to create your first World Info book.</p>";
                return;
            }
        
            
            const allTab = document.createElement('button');
            allTab.className = 'world-book-tab active';
            allTab.textContent = "All";
            allTab.dataset.categoryId = 'all';
            tabsContainer.appendChild(allTab);
        
            const allPane = document.createElement('div');
            allPane.className = 'world-book-category-pane active';
            allPane.dataset.categoryId = 'all';
            contentContainer.appendChild(allPane);
        
            
            categories.forEach(category => {
                const categoryTab = document.createElement('button');
                categoryTab.className = 'world-book-tab';
                categoryTab.textContent = category.name;
                categoryTab.dataset.categoryId = String(category.id);
                tabsContainer.appendChild(categoryTab);
        
                const categoryPane = document.createElement('div');
                categoryPane.className = 'world-book-category-pane';
                categoryPane.dataset.categoryId = String(category.id);
                contentContainer.appendChild(categoryPane);
            });
            
            
            const hasUncategorized = books.some(book => !book.categoryId);
            if (hasUncategorized) {
                const uncategorizedTab = document.createElement('button');
                uncategorizedTab.className = 'world-book-tab';
                uncategorizedTab.textContent = "Uncategorized";
                uncategorizedTab.dataset.categoryId = 'uncategorized';
                tabsContainer.appendChild(uncategorizedTab);
            
                const uncategorizedPane = document.createElement('div');
                uncategorizedPane.className = 'world-book-category-pane';
                uncategorizedPane.dataset.categoryId = 'uncategorized';
                contentContainer.appendChild(uncategorizedPane);
            }
        
            
            books.forEach(book => {
                let contentPreview = '暂无内容...';
                if (Array.isArray(book.content) && book.content.length > 0) {
                    const firstEntry = book.content[0];
                    contentPreview = firstEntry.comment || firstEntry.content || '';
                } else if (typeof book.content === 'string' && book.content.trim() !== '') {
                    contentPreview = book.content;
                }
        
                const card = document.createElement('div');
                card.className = 'world-book-card';
                card.innerHTML = `
                    <div class="card-title">${book.name}</div>
                    <div class="card-content-preview">${contentPreview}</div>
                `;
                
                
                const cardClickHandler = () => openWorldBookEditor(book.id);
                const cardLongPressHandler = async () => { 
                    const confirmed = await showCustomConfirm("Delete World Info", `Delete “${book.name}”?`, { confirmButtonClass: 'btn-danger' }); 
                    if (confirmed) { 
                        await runtime.db.worldBooks.delete(book.id); 
                        runtime.state.worldBooks = runtime.state.worldBooks.filter(wb => wb.id !== book.id); 
                        renderWorldBookScreen(); 
                    } 
                };
        
                card.addEventListener('click', cardClickHandler);
                addLongPressListener(card, cardLongPressHandler);
        
                
                const clonedCardForAll = card.cloneNode(true);
                clonedCardForAll.addEventListener('click', cardClickHandler);
                addLongPressListener(clonedCardForAll, cardLongPressHandler);
                allPane.appendChild(clonedCardForAll);
                
                
                const categoryKey = book.categoryId ? String(book.categoryId) : 'uncategorized';
                const targetPane = contentContainer.querySelector(`.world-book-category-pane[data-category-id="${categoryKey}"]`);
                if (targetPane) {
                    targetPane.appendChild(card);
                }
            });
        
            
            document.querySelectorAll('.world-book-tab').forEach(tab => {
                tab.addEventListener('click', () => switchWorldBookCategory(tab.dataset.categoryId));
            });
        }

export function createWorldBookGroup(groupName, books) {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'world-book-group-container';
            
            groupContainer.innerHTML = `
                <div class="world-book-group-header">
                    <span class="arrow">▼</span>
                    <span class="group-name">${groupName}</span>
                </div>
                <div class="world-book-group-content"></div>
            `;
        
            const contentEl = groupContainer.querySelector('.world-book-group-content');
            books.sort((a,b) => a.name.localeCompare(b.name, 'zh-CN')); 
            
            books.forEach(book => {
                
                let contentPreview = '暂无内容...';
                
                
                if (Array.isArray(book.content) && book.content.length > 0) {
                    
                    
                    const firstEntry = book.content[0];
                    contentPreview = firstEntry.comment || firstEntry.content || '';
                } 
                
                else if (typeof book.content === 'string' && book.content.trim() !== '') {
                    
                    contentPreview = book.content;
                }
                
        
                const item = document.createElement('div');
                item.className = 'list-item';
                item.dataset.bookId = book.id;
                
                item.innerHTML = `
                    <div class="item-title">${book.name}</div>
                    <div class="item-content">${String(contentPreview).substring(0, 50)}</div>
                `;
                item.addEventListener('click', () => openWorldBookEditor(book.id));
                addLongPressListener(item, async () => { 
                    const confirmed = await showCustomConfirm("Delete World Info", `Permanently delete “${book.name}”?`, { confirmButtonClass: 'btn-danger' }); 
                    if (confirmed) { 
                        await runtime.db.worldBooks.delete(book.id); 
                        runtime.state.worldBooks = runtime.state.worldBooks.filter(wb => wb.id !== book.id); 
                        renderWorldBookScreen(); 
                    } 
                });
                contentEl.appendChild(item);
            });
        
            return groupContainer;
        }

function openWorldBookEditor(bookId) {
  showScreen('world-book-editor-screen', { bookId })
}

export function updateCachedWorldBook(book) {
  const index = runtime.state.worldBooks.findIndex(item => item.id === book.id)
  if (index !== -1) runtime.state.worldBooks[index] = book
}

export async function addNewCategory() {
            const input = document.getElementById('new-category-name-input');
            const name = input.value.trim();
            if (!name) {
                alert("Enter a category name.");
                return;
            }
            const existing = await runtime.db.worldBookCategories.where('name').equals(name).first();
            if (existing) {
                alert(`The category “${name}” already exists.`);
                return;
            }
            await runtime.db.worldBookCategories.add({ name });
            input.value = '';
            await renderCategoryListInManager();
        }

export async function deleteCategory(categoryId) {
            const confirmed = await showCustomConfirm(
                "Confirm Delete", 
                "Delete this category? Its World Info books will become uncategorized.", 
                { confirmButtonClass: 'btn-danger' }
            );
            if (confirmed) {
                await runtime.db.worldBookCategories.delete(categoryId);
                
                const booksToUpdate = await runtime.db.worldBooks.where('categoryId').equals(categoryId).toArray();
                for (const book of booksToUpdate) {
                    book.categoryId = null;
                    await runtime.db.worldBooks.put(book);
                    const bookInState = runtime.state.worldBooks.find(wb => wb.id === book.id);
                    if(bookInState) bookInState.categoryId = null;
                }
                await renderCategoryListInManager();
            }
        }

export async function openWorldBookDeletionModal() {
    const modal = document.getElementById('delete-world-books-modal');
    const listEl = document.getElementById('delete-world-books-list');
    const selectAllCheckbox = document.getElementById('select-all-world-books-for-clear');
    listEl.innerHTML = '';
    selectAllCheckbox.checked = false; 

    const books = await runtime.db.worldBooks.toArray();

    if (books.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">There are no World Info books to delete.</p>";
    } else {
        books.forEach(book => {
            const item = document.createElement('div');
            item.className = 'clear-posts-item'; 
            item.dataset.bookId = book.id;
            item.innerHTML = `
                <div class="checkbox"></div>
                <span class="name">${book.name}</span>
            `;
            listEl.appendChild(item);
        });
    }
    
    modal.classList.add('visible');
}

export async function handleConfirmWorldBookDeletion() {
    const selectedItems = document.querySelectorAll('#delete-world-books-list .clear-posts-item.selected');
    if (selectedItems.length === 0) {
        alert("Select at least one World Info book.");
        return;
    }

    const idsToDelete = Array.from(selectedItems).map(item => item.dataset.bookId);
    
    const confirmed = await showCustomConfirm(
        "Confirm Cleanup",
        `Permanently delete ${selectedItems.length} World Info books and unlink them from all characters?`,
        { confirmButtonClass: 'btn-danger', confirmText: "Confirm Delete" }
    );

    if (!confirmed) return;
    
    await showCustomAlert("Please wait…", "Deleting…");

    try {
        await runtime.db.transaction('rw', runtime.db.worldBooks, runtime.db.chats, async tx => {
            
            await tx.worldBooks.bulkDelete(idsToDelete);

            
            const allChats = await tx.chats.toArray();
            for (const chat of allChats) {
                if (chat.settings && Array.isArray(chat.settings.linkedWorldBookIds)) {
                    const originalCount = chat.settings.linkedWorldBookIds.length;
                    
                    chat.settings.linkedWorldBookIds = chat.settings.linkedWorldBookIds.filter(id => !idsToDelete.includes(id));
                    
                    
                    if (chat.settings.linkedWorldBookIds.length < originalCount) {
                        await tx.chats.put(chat);
                    }
                }
            }
        });
        
        
        runtime.state.worldBooks = runtime.state.worldBooks.filter(book => !idsToDelete.includes(book.id));
        
        document.getElementById('delete-world-books-modal').classList.remove('visible');
        await showCustomAlert("Deleted", `Deleted ${selectedItems.length} World Info books.`);

    } catch (error) {
        console.error("删除世界书失败:", error);
        await showCustomAlert("Deletion Failed", `Operation failed: ${error.message}`);
    }
}

export async function openCategoryManager() {
            await renderCategoryListInManager();
            document.getElementById('world-book-category-manager-modal').classList.add('visible');
        }

export async function renderCategoryListInManager() {
            const listEl = document.getElementById('existing-categories-list');
            const categories = await runtime.db.worldBookCategories.toArray();
            listEl.innerHTML = '';
            if (categories.length === 0) {
                listEl.innerHTML = "<p style=\"text-align: center; color: var(--text-secondary);\">No categories yet.</p>";
            }
            categories.forEach(cat => {
                
                const item = document.createElement('div');
                item.className = 'existing-group-item'; 
                item.innerHTML = `
                    <span class="group-name">${cat.name}</span>
                    <span class="delete-group-btn" data-id="${cat.id}">×</span>
                `;
                listEl.appendChild(item);
            });
        }

export function bindWorldBookEditor() {
  document.getElementById('add-world-book-btn').addEventListener('click', async () => { const name = await showCustomPrompt("Create World Info", "Enter a name for this World Info book"); if (name && name.trim()) { const newBook = { id: 'wb_' + Date.now(), name: name.trim(), content: [] }; await runtime.db.worldBooks.add(newBook); runtime.state.worldBooks.push(newBook); openWorldBookEditor(newBook.id); } });


}

export function bindWorldBookCategories() {
  document.getElementById('manage-world-book-categories-btn').addEventListener('click', openCategoryManager);

document.getElementById('close-category-manager-btn').addEventListener('click', () => {
            document.getElementById('world-book-category-manager-modal').classList.remove('visible');
            renderWorldBookScreen(); 
        });

document.getElementById('add-new-category-btn').addEventListener('click', addNewCategory);

document.getElementById('existing-categories-list').addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-group-btn')) {
                const categoryId = parseInt(e.target.dataset.id);
                deleteCategory(categoryId);
            }
        });

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

document.getElementById('sticker-search-input').addEventListener('input', () => {
    
    renderStickerPanel(false); 
});
}
