import { showCustomAlert } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'
import { handleDataClearNext, openDataClearWizard } from '../backup/clear-data.js'
import { handlePresetImport } from '../presets/presets.js'

export function renderButtonOrderEditor() {
    const editor = document.getElementById('button-order-editor');
    if (!editor) return;

    editor.innerHTML = '';

    
    
    let buttonOrder = runtime.state.globalSettings.chatActionButtonsOrder || runtime.DEFAULT_BUTTON_ORDER;
    
    buttonOrder.forEach(buttonId => {
        const originalButton = document.getElementById(buttonId);
        if (originalButton) {
            const item = document.createElement('div');
            item.className = 'draggable-button-item';
            item.draggable = true;
            item.dataset.buttonId = buttonId;
            item.innerHTML = originalButton.innerHTML; 
            editor.appendChild(item);
        }
    });
}

export function initializeButtonOrderEditor() {
    const editor = document.getElementById('button-order-editor');
    if (!editor) return;

    let draggingItem = null; 

    
    const handleDragStart = (e) => {
        const target = e.target.closest('.draggable-button-item');
        if (!target) return;
        
        draggingItem = target;
        draggingItem.classList.add('dragging');

        
        if (e.cancelable) e.preventDefault();
    };

    const handleDragMove = (e) => {
        if (!draggingItem) return;

        
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        
        const afterElement = getDragAfterElement(editor, clientX);
        
        if (afterElement == null) {
            editor.appendChild(draggingItem);
        } else {
            editor.insertBefore(draggingItem, afterElement);
        }
    };

    const handleDragEnd = () => {
        if (!draggingItem) return;

        draggingItem.classList.remove('dragging');
        draggingItem = null;
        
        
        saveButtonOrder();
    };

    
    
    editor.addEventListener('mousedown', handleDragStart);
    editor.addEventListener('touchstart', handleDragStart, { passive: false });

    
    editor.addEventListener('mousemove', handleDragMove);
    editor.addEventListener('touchmove', handleDragMove, { passive: false });

    
    editor.addEventListener('mouseup', handleDragEnd);
    editor.addEventListener('mouseleave', handleDragEnd); 
    editor.addEventListener('touchend', handleDragEnd);
}

export function getDragAfterElement(container, x) {
    
    const draggableElements = [...container.querySelectorAll('.draggable-button-item:not(.dragging)')];

    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        
        const offset = x - box.left - box.width / 2;
        
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

export async function saveButtonOrder() {
    const editor = document.getElementById('button-order-editor');
    const newOrder = Array.from(editor.querySelectorAll('.draggable-button-item')).map(item => item.dataset.buttonId);
    
    runtime.state.globalSettings.chatActionButtonsOrder = newOrder;
    await runtime.db.globalSettings.put(runtime.state.globalSettings);

    
    
}

export function applyButtonOrder() {
    const buttonOrder = runtime.state.globalSettings.chatActionButtonsOrder;
    if (!buttonOrder || !Array.isArray(buttonOrder) || buttonOrder.length === 0) {
        return; 
    }

    const container = document.getElementById('chat-input-actions-top');
    if (!container) return;

    
    buttonOrder.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            container.appendChild(button);
        }
    });
}

export async function resetButtonOrder() {
    
    runtime.state.globalSettings.chatActionButtonsOrder = null;
    await runtime.db.globalSettings.put(runtime.state.globalSettings);

    
    renderButtonOrderEditor();

    
    applyButtonOrder();

    
    await showCustomAlert("Success", "Default button order restored.");
}

export function bindChatButtonOrder() {
  document.getElementById('import-preset-btn').addEventListener('click', () => {
            document.getElementById('import-preset-input').click();
        });

document.getElementById('import-preset-input').addEventListener('change', handlePresetImport);

document.getElementById('reset-button-order-btn').addEventListener('click', resetButtonOrder);

document.getElementById('clear-specific-data-btn').addEventListener('click', openDataClearWizard);

document.getElementById('cancel-clear-wizard-btn-step1').addEventListener('click', () => {
    document.getElementById('data-clear-wizard-modal').classList.remove('visible');
});

document.getElementById('go-to-clear-step2-btn').addEventListener('click', handleDataClearNext);
}
