import { runtime } from '../runtime/state.js'

let active
const queue = []

function showDialog(render) {
    return new Promise(resolve => {
        queue.push({ render, resolve });
        if (!active) openNextDialog();
    });
}

function openNextDialog() {
    active = queue.shift();
    if (!active) return;

    const footer = runtime.modalConfirmBtn.parentElement;
    footer.querySelectorAll('[data-dialog-choice]').forEach(button => button.remove());
    footer.style.flexDirection = 'row';
    runtime.modalConfirmBtn.hidden = false;
    runtime.modalCancelBtn.hidden = false;
    runtime.modalConfirmBtn.style.display = '';
    runtime.modalCancelBtn.style.display = '';
    runtime.modalConfirmBtn.textContent = 'Confirm';
    runtime.modalConfirmBtn.classList.remove('btn-danger');
    runtime.modalCancelBtn.textContent = 'Cancel';
    runtime.modalBody.replaceChildren();
    active.previousFocus = document.activeElement;
    active.focus = active.render(footer);
    runtime.modalOverlay.classList.add('visible');
    (active.focus ?? runtime.modalConfirmBtn).focus();
}

function finish(value) {
    if (!active) return;
    const { resolve, previousFocus } = active;
    runtime.modalOverlay.classList.remove('visible');
    active = undefined;
    if (!queue.length && previousFocus instanceof HTMLElement) previousFocus.focus();
    resolve(value);
    openNextDialog();
}

export function hideCustomModal() {
    finish(null);
}

export function bindDialogDismissal() {
    runtime.modalOverlay.addEventListener('click', event => {
        if (event.target === runtime.modalOverlay) hideCustomModal();
    });
    document.addEventListener('keydown', event => {
        if (!active || event.key !== 'Escape') return;
        event.preventDefault();
        hideCustomModal();
    });
}

function describe(title, message) {
    runtime.modalTitle.textContent = title;
    const text = document.createElement('div');
    text.style.whiteSpace = 'pre-wrap';
    text.innerHTML = message;
    runtime.modalBody.append(text);
}

export function showCustomConfirm(title, message, options = {}) {
    return showDialog(() => {
        describe(title, message);
        const { modalConfirmBtn: confirm, modalCancelBtn: cancel } = runtime;
        confirm.textContent = options.confirmText || 'Confirm';
        cancel.textContent = options.cancelText || 'Cancel';
        if (options.confirmButtonClass) confirm.classList.add(options.confirmButtonClass);
        confirm.onclick = () => finish(true);
        cancel.onclick = () => finish(false);
        return options.confirmButtonClass === 'btn-danger' ? cancel : confirm;
    });
}

export function showCustomAlert(title, message) {
    return showDialog(() => {
        describe(title, message);
        runtime.modalCancelBtn.style.display = 'none';
        runtime.modalConfirmBtn.textContent = 'OK';
        runtime.modalConfirmBtn.onclick = () => finish(true);
    });
}

export function showCustomPrompt(title, placeholder, initialValue = '', type = 'text', extraHtml = '') {
    return showDialog(() => {
        runtime.modalTitle.textContent = title;
        runtime.modalBody.innerHTML = extraHtml;
        const multiline = type === 'textarea';
        const input = document.createElement(multiline ? 'textarea' : 'input');
        if (multiline) input.rows = 4;
        else input.type = type;
        input.id = 'custom-prompt-input';
        input.placeholder = placeholder;
        input.value = initialValue;
        runtime.modalBody.append(input);
        runtime.modalConfirmBtn.onclick = () => finish(input.value);
        runtime.modalCancelBtn.onclick = hideCustomModal;
        input.addEventListener('keydown', event => {
            if (!multiline && event.key === 'Enter' && !event.isComposing) {
                event.preventDefault();
                finish(input.value);
            }
        });
        runtime.modalBody.querySelectorAll('.format-btn').forEach(button => {
            button.addEventListener('click', () => {
                try {
                    input.value = JSON.stringify(JSON.parse(button.dataset.template), null, 2);
                    input.focus();
                } catch (error) {
                    console.error('Invalid format template', error);
                }
            });
        });
        return input;
    });
}

export function showChoiceModal(title, options) {
    return showDialog(footer => {
        runtime.modalTitle.textContent = title;
        footer.style.flexDirection = 'column';
        runtime.modalConfirmBtn.style.display = 'none';
        runtime.modalCancelBtn.onclick = hideCustomModal;
        for (const option of options) {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.dialogChoice = '';
            button.textContent = option.text;
            button.onclick = () => finish(option.value);
            footer.insertBefore(button, runtime.modalCancelBtn);
        }
        return footer.querySelector('[data-dialog-choice]') ?? runtime.modalCancelBtn;
    });
}

export function addLongPressListener(element, callback) { let pressTimer; const startPress = (e) => { if(runtime.isSelectionMode) return; e.preventDefault(); pressTimer = window.setTimeout(() => callback(e), 500); }; const cancelPress = () => clearTimeout(pressTimer); element.addEventListener('mousedown', startPress); element.addEventListener('mouseup', cancelPress); element.addEventListener('mouseleave', cancelPress); element.addEventListener('touchstart', startPress, { passive: true }); element.addEventListener('touchend', cancelPress); element.addEventListener('touchmove', cancelPress); }

export function showLoader(container, position = 'top') {
    
    if (container.querySelector('.loader-container')) return;
    const loader = document.createElement('div');
    loader.className = 'loader-container';
    loader.innerHTML = '<div class="spinner"></div>';
    
    if (position === 'bottom') {
        container.appendChild(loader);
    } else {
        container.prepend(loader);
    }
}

export function hideLoader(container) {
    const loader = container.querySelector('.loader-container');
    if (loader) {
        loader.remove();
    }
}
