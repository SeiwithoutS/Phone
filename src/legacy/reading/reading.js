import { showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'
import { loadMoreChats } from '../chat/list.js'
import { updateReadingContextOnScroll } from '../home/status.js'
import { addNewProductCategory, addProductVariationInput, deleteProductCategory, openProductCategoryManager, openProductEditor } from '../shopping/store.js'
import { controls } from '../runtime/state.js'
import { debounce } from '../../runtime/helpers'

export function openReadingRoom() {
    if (!runtime.state.activeChatId) return;
    const chatId = runtime.state.activeChatId;
    const overlay = document.getElementById('reading-overlay');
    const windowEl = document.getElementById('reading-window');
    const restoreBtn = document.getElementById('reading-restore-btn');

    let session = runtime.readingState[chatId];

    
    if (session && session.isActive) {
        if (session.isMinimized) {
            restoreReadingRoom(); 
        }
        
        overlay.style.display = 'flex';
        return;
    }

    
    initReadingSession(chatId);
    renderReadingRoom(chatId);

    
    overlay.style.display = 'flex';
    windowEl.classList.remove('minimized');
    restoreBtn.style.display = 'none';
    
    


const phoneScreen = document.getElementById('phone-screen');
const windowRect = windowEl.getBoundingClientRect(); 


const top = (phoneScreen.clientHeight - windowRect.height) / 2;
const left = (phoneScreen.clientWidth - windowRect.width) / 2;


windowEl.style.top = `${top}px`;
windowEl.style.left = `${left}px`;
windowEl.style.transform = ''; 

}

export function initReadingSession(chatId) {
    runtime.readingState[chatId] = {
        isActive: true,
        isMinimized: false,
        title: "No book selected",
        contentLines: [],
        currentPage: 0,
        totalPages: 0,
        linesPerPage: 15,
        currentSnippet: '' 
    };
}

export function closeReadingRoom() {
    const chatId = runtime.state.activeChatId;
    if (!chatId || !runtime.readingState[chatId] || !runtime.readingState[chatId].isActive) return;

    
    document.getElementById('reading-overlay').style.display = 'none';
    document.getElementById('reading-restore-btn').style.display = 'none';
    document.getElementById('reading-window').classList.remove('minimized');

    
    runtime.readingState[chatId].isActive = false;
    console.log("读书会话已关闭。");
}

export function minimizeReadingRoom() {
    const session = runtime.readingState[runtime.state.activeChatId];
    if (!session || !session.isActive) return;

    document.getElementById('reading-window').classList.add('minimized');
    document.getElementById('reading-restore-btn').style.display = 'flex';
    session.isMinimized = true;
}

export function restoreReadingRoom() {
    const session = runtime.readingState[runtime.state.activeChatId];
    if (!session || !session.isActive) return;

    document.getElementById('reading-restore-btn').style.display = 'none';
    document.getElementById('reading-window').classList.remove('minimized');
    session.isMinimized = false;
}

export function makeDraggable(windowEl, headerEl) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let isDragging = false;
    let hasMoved = false; 
    const phoneScreen = document.getElementById('phone-screen');

    const startDrag = (e) => {
        
        if (windowEl !== headerEl && e.target.closest('button')) {
            return;
        }

        isDragging = true;
        hasMoved = false; 

        const event = e.type === 'touchstart' ? e.touches[0] : e;
        pos3 = event.clientX;
        pos4 = event.clientY;

        
        windowEl.style.top = `${windowEl.offsetTop}px`;
        windowEl.style.left = `${windowEl.offsetLeft}px`;
        windowEl.style.transform = '';

        document.addEventListener('mouseup', endDrag);
        document.addEventListener('mousemove', elementDrag);
        document.addEventListener('touchend', endDrag);
        
        document.addEventListener('touchmove', elementDrag, { passive: false });
    };

    const elementDrag = (e) => {
        if (!isDragging) return;

        const event = e.type === 'touchmove' ? e.touches[0] : e;
        const diffX = event.clientX - pos3;
        const diffY = event.clientY - pos4;

        
        if (!hasMoved && (Math.abs(diffX) > 5 || Math.abs(diffY) > 5)) {
            hasMoved = true;
        }

        
        if (hasMoved && e.cancelable) {
            e.preventDefault();
        }

        pos1 = pos3 - event.clientX;
        pos2 = pos4 - event.clientY;
        pos3 = event.clientX;
        pos4 = event.clientY;

        let newTop = windowEl.offsetTop - pos2;
        let newLeft = windowEl.offsetLeft - pos1;

        const maxTop = phoneScreen.clientHeight - windowEl.offsetHeight - 10;
        const maxLeft = phoneScreen.clientWidth - windowEl.offsetWidth - 10;
        newTop = Math.max(10, Math.min(newTop, maxTop));
        newLeft = Math.max(10, Math.min(newLeft, maxLeft));

        windowEl.style.top = newTop + "px";
        windowEl.style.left = newLeft + "px";
    };

    const endDrag = () => {
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('mousemove', elementDrag);
        document.removeEventListener('touchend', endDrag);
        document.removeEventListener('touchmove', elementDrag);

        if (!isDragging) return;
        isDragging = false;

        
        if (!hasMoved) {
            
            windowEl.click();
        }
    };

    headerEl.addEventListener('mousedown', startDrag);
    
    headerEl.addEventListener('touchstart', startDrag, { passive: false });
}

export function renderReadingRoom(chatId) {
    const session = runtime.readingState[chatId]; if (!session) return;
    const titleEl = document.getElementById('reading-title');
    const contentEl = document.getElementById('reading-content');
    const pageIndicator = document.getElementById('page-indicator');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    titleEl.textContent = session.title;
    if (session.contentLines.length === 0) {
        contentEl.innerHTML = "<p>Select Import<br>to load a book from a local .txt file or URL.</p>";
        session.totalPages = 0; session.currentPage = 0;
    } else {
        const startLine = session.currentPage * session.linesPerPage;
        const endLine = startLine + session.linesPerPage;
        contentEl.textContent = session.contentLines.slice(startLine, endLine).join('\n');
    }
    pageIndicator.textContent = `${session.currentPage + 1} / ${session.totalPages}`;
    prevBtn.disabled = session.currentPage === 0;
    nextBtn.disabled = session.currentPage >= session.totalPages - 1;
}

export async function showNextPage() {
    const session = runtime.readingState[runtime.state.activeChatId];
    if (session && session.currentPage < session.totalPages - 1) {
        session.currentPage++; 
        renderReadingRoom(runtime.state.activeChatId);
        document.getElementById('reading-content').scrollTop = 0;
        await saveReadingProgress(session.activeBookId, session.currentPage);

    }
}

export async function showPrevPage() {
    const session = runtime.readingState[runtime.state.activeChatId];
    if (session && session.currentPage > 0) {
        session.currentPage--; 
        renderReadingRoom(runtime.state.activeChatId);
        document.getElementById('reading-content').scrollTop = 0;
        await saveReadingProgress(session.activeBookId, session.currentPage);

    }
}

export function importBook() {
    
    document.getElementById('book-upload-input').click();
}

export async function decodeTextFile(arrayBuffer) {
    const uint8array = new Uint8Array(arrayBuffer);

    
    if (uint8array.length >= 3 && uint8array[0] === 0xEF && uint8array[1] === 0xBB && uint8array[2] === 0xBF) {
        console.log("检测到 UTF-8 BOM，使用 UTF-8 解码。");
        return new TextDecoder('utf-8').decode(uint8array);
    }
    if (uint8array.length >= 2 && uint8array[0] === 0xFF && uint8array[1] === 0xFE) {
        console.log("检测到 UTF-16 LE BOM，使用 UTF-16 LE 解码。");
        return new TextDecoder('utf-16le').decode(uint8array);
    }
    if (uint8array.length >= 2 && uint8array[0] === 0xFE && uint8array[1] === 0xFF) {
        console.log("检测到 UTF-16 BE BOM，使用 UTF-16 BE 解码。");
        return new TextDecoder('utf-16be').decode(uint8array);
    }

    
    try {
        console.log("未检测到BOM，尝试使用 UTF-8 解码...");
        
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(uint8array);
        console.log("UTF-8 解码成功。");
        return decoded;
    } catch (e) {
        console.log("UTF-8 解码失败，将尝试 GBK (ANSI) 解码...");
        
        try {
            const decoded = new TextDecoder('gbk').decode(uint8array);
            console.log("GBK 解码成功。");
            return decoded;
        } catch (err) {
             console.error("所有解码尝试均失败:", err);
             
             throw new Error("无法识别的文件编码。请尝试将文件转换为 UTF-8 格式后重新导入。");
        }
    }
}

export async function handleBookFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        
        const arrayBuffer = await file.arrayBuffer();
        
        const textContent = await decodeTextFile(arrayBuffer);

        const title = file.name.replace(/\.txt$/i, '');

        const newBookId = await runtime.db.readingLibrary.add({
            title: title,
            content: textContent,
            lastOpened: Date.now()
        });

        await loadBookFromLibrary(newBookId);
        if (document.getElementById('reading-library-modal').classList.contains('visible')) {
            renderBookLibrary();
        }
    } catch (error) {
        
        console.error("导入书籍失败:", error);
        await showCustomAlert("Import Failed", error.message);
    } finally {
        event.target.value = null;
    }
}

export async function handlePageJump() {
    const chatId = runtime.state.activeChatId;
    if (!chatId) return;
    const session = runtime.readingState[chatId];
    if (!session || session.totalPages <= 1) return;

    const targetPageStr = await showCustomPrompt(
        "Jump to Page", 
        `Enter a page number (1–${session.totalPages})`,
        session.currentPage + 1
    );

    if (targetPageStr === null) return;

    const targetPage = parseInt(targetPageStr);

    if (isNaN(targetPage) || targetPage < 1 || targetPage > session.totalPages) {
        alert("Enter a valid page number.");
        return;
    }

    session.currentPage = targetPage - 1;
    renderReadingRoom(chatId);
    
    saveReadingProgress(session.activeBookId, session.currentPage);
}

export async function saveReadingProgress(bookId, pageNumber) {
    if (!bookId) return;
    try {
        
        await runtime.db.readingLibrary.update(bookId, { currentPage: pageNumber });
    } catch (error) {
        console.error(`保存书籍(ID: ${bookId})的阅读进度失败:`, error);
    }
}

export function processImportedText(title, textContent) {
    const chatId = runtime.state.activeChatId;
    if (!chatId) return;

    const session = runtime.readingState[chatId];
    session.title = title.replace(/\.txt$/i, '');
    session.contentLines = textContent.split(/\r\n?|\n/);
    session.totalPages = Math.ceil(session.contentLines.length / session.linesPerPage);
    session.currentPage = 0;

    renderReadingRoom(chatId);
}

export async function openBookLibrary() {
    
    document.getElementById('reading-library-search-input').value = '';

    await renderBookLibrary(); 
    document.getElementById('reading-library-modal').classList.add('visible');
}

export async function renderBookLibrary(searchTerm = '') {
    const listEl = document.getElementById('reading-library-list');
    let books = await runtime.db.readingLibrary.orderBy('lastOpened').reverse().toArray();
    listEl.innerHTML = '';

    
    if (searchTerm) {
        books = books.filter(book => 
            book.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    
    if (books.length === 0) {
        const message = searchTerm 
            ? '找不到匹配的书籍' 
            : '书库是空的，点击“导入新书”添加第一本吧！';
        listEl.innerHTML = `<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">${message}</p>`;
        return;
    }

    books.forEach(book => {
        const item = document.createElement('div');
        item.className = 'existing-group-item'; 
        item.innerHTML = `
            <span class="group-name" style="cursor:pointer;" data-book-id="${book.id}">${book.title}</span>
            <button class="delete-group-btn" data-book-id="${book.id}" title="Delete Book">×</button>
        `;
        listEl.appendChild(item);
    });
}

export async function loadBookFromLibrary(bookId) {
    const chatId = runtime.state.activeChatId;
    if (!chatId) return;

    const book = await runtime.db.readingLibrary.get(bookId);
    if (!book) {
        alert("Book not found.");
        return;
    }

    await runtime.db.readingLibrary.update(bookId, { lastOpened: Date.now() });

    const session = runtime.readingState[chatId];
    session.activeBookId = bookId; 
    session.title = book.title;
    session.contentLines = book.content.split(/\r\n?|\n/).map(line => line.replace(/ +/g, ' '));
    session.totalPages = Math.ceil(session.contentLines.length / session.linesPerPage);
    
    
    
    session.currentPage = book.currentPage || 0;
    

    renderReadingRoom(chatId);
    
    document.getElementById('reading-content').scrollTop = 0; 
    document.getElementById('reading-library-modal').classList.remove('visible');
}

export async function deleteBookFromLibrary(bookId) {
    const book = await runtime.db.readingLibrary.get(bookId);
    if (!book) return;

    const confirmed = await showCustomConfirm("Delete Book", `Delete “${book.title}”?`, { confirmButtonClass: 'btn-danger' });
    if (confirmed) {
        await runtime.db.readingLibrary.delete(bookId);
        await renderBookLibrary(); 
    }
}

export function bindReadingEvents() {
  document.getElementById('read-together-btn').addEventListener('click', openReadingRoom);

controls.restoreBtn = document.getElementById('reading-restore-btn')

makeDraggable(controls.restoreBtn, controls.restoreBtn);

document.getElementById('close-reading-btn').addEventListener('click', closeReadingRoom);

document.getElementById('open-reading-library-btn').addEventListener('click', openBookLibrary);

document.getElementById('next-page-btn').addEventListener('click', showNextPage);

document.getElementById('prev-page-btn').addEventListener('click', showPrevPage);

document.getElementById('book-upload-input').addEventListener('change', handleBookFileUpload);

document.getElementById('minimize-reading-btn').addEventListener('click', minimizeReadingRoom);

document.getElementById('reading-restore-btn').addEventListener('click', restoreReadingRoom);

makeDraggable(document.getElementById('reading-window'), document.querySelector('#reading-window .reading-header'));

document.getElementById('open-reading-library-btn').addEventListener('click', openBookLibrary);

document.getElementById('close-reading-library-btn-header').addEventListener('click', () => {
    document.getElementById('reading-library-modal').classList.remove('visible');
});

document.getElementById('import-new-book-btn-header').addEventListener('click', importBook);

document.getElementById('reading-library-list').addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('group-name')) { 
        const bookId = parseInt(target.dataset.bookId);
        loadBookFromLibrary(bookId);
    } else if (target.classList.contains('delete-group-btn')) { 
        const bookId = parseInt(target.dataset.bookId);
        deleteBookFromLibrary(bookId);
    }
});

document.getElementById('page-indicator').addEventListener('click', handlePageJump);

document.getElementById('reading-library-search-input').addEventListener('input', (e) => {
    
    renderBookLibrary(e.target.value);
});

controls.debouncedUpdateReadingContext = debounce(updateReadingContextOnScroll, 300)

document.getElementById('reading-content').addEventListener('scroll', controls.debouncedUpdateReadingContext);

document.getElementById('api-temperature-slider').addEventListener('input', (e) => {
    document.getElementById('api-temperature-value').textContent = e.target.value;
});

controls.chatListContainer = document.getElementById('messages-view')

controls.chatListContainer.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = controls.chatListContainer;
    
    if (scrollHeight - scrollTop <= clientHeight + 150 && !runtime.isLoadingMoreChats) {
        loadMoreChats();
    }
});

document.getElementById('manage-product-categories-btn').addEventListener('click', openProductCategoryManager);

document.getElementById('close-product-category-manager-btn').addEventListener('click', () => {
    document.getElementById('product-category-manager-modal').classList.remove('visible');
    
    
    openProductEditor(runtime.editingProductId); 
});

document.getElementById('add-new-product-category-btn').addEventListener('click', addNewProductCategory);

document.getElementById('existing-product-categories-list').addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-group-btn')) {
                deleteProductCategory(parseInt(e.target.dataset.id));
            }
        });

document.getElementById('add-product-variation-btn').addEventListener('click', () => addProductVariationInput());
}
