import { showChoiceModal, showCustomAlert, showCustomPrompt } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export function applyWidgetData() {
    if (!runtime.state.globalSettings.widgetData) return;
    for (const elementId in runtime.state.globalSettings.widgetData) {
        const element = document.getElementById(elementId);
        const savedValue = runtime.state.globalSettings.widgetData[elementId];
        if (element) {
            if (element.tagName === 'IMG') {
                element.src = savedValue;
            } else {
                element.textContent = savedValue;
            }
        }
    }
}

export function uploadImageLocally() {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*'; // 只接受图片文件

        input.onchange = e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = readerEvent => {
                    resolve(readerEvent.target.result); // 返回Base64字符串
                };
                reader.readAsDataURL(file);
            } else {
                resolve(null); // 用户关闭了文件选择框
            }
        };

        input.click();
    });
}

export async function handleEditText(element) {
    const elementId = element.id;
    const currentValue = element.textContent;
    const newValue = await showCustomPrompt("Edit Text", "Enter the new text", currentValue);
    if (newValue !== null && newValue.trim() !== "") {
        const trimmedValue = newValue.trim();
        element.textContent = trimmedValue;
        runtime.state.globalSettings.widgetData[elementId] = trimmedValue;
        await runtime.db.globalSettings.put(runtime.state.globalSettings);
        alert("Text updated.");

    }
}

export async function handleEditImage(element) {
    const elementId = element.id;

    // 步骤1：让用户选择上传方式
    const choice = await showChoiceModal("修改图片", [
        { text: '📁 从本地上传', value: 'local' },
        { text: '🌐 使用网络URL', value: 'url' }
    ]);

    let newValue = null;


    if (choice === 'local') {

        newValue = await uploadImageLocally();
    } else if (choice === 'url') {

        newValue = await showCustomPrompt("Edit Image", "Enter an image URL", element.src, "url");
    }


    if (newValue && newValue.trim()) {
        const trimmedValue = newValue.trim();
        element.src = trimmedValue;
        runtime.state.globalSettings.widgetData[elementId] = trimmedValue;
        await runtime.db.globalSettings.put(runtime.state.globalSettings);
        alert("Image updated.");
    } else if (choice === 'url' && newValue !== null) {
        alert("Enter a valid image URL.");
    }
}

export function setupHomeScreenPagination() {
            const pagesContainer = document.getElementById('home-screen-pages-container');
            const pages = document.getElementById('home-screen-pages');
            const dots = document.querySelectorAll('.pagination-dot');
            let startX = 0, startY = 0; 
            let currentX = 0;
            let isDragging = false;
            let isClick = true; 

            const updatePagination = () => {
                pages.style.transform = `translateX(-${runtime.currentPage * (100 / runtime.totalPages)}%)`;
                dots.forEach((dot, index) => {
                    dot.classList.toggle('active', index === runtime.currentPage);
                });
            };

            const onDragStart = (e) => {
                isDragging = true;
                isClick = true; 
                startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
                startY = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
                pages.style.transition = 'none';
            };

            const onDragMove = (e) => {
                if (!isDragging) return;
                
                const currentY = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
                currentX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
                const diffX = currentX - startX;
                const diffY = currentY - startY;

                
                if (isClick && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
                    isClick = false;
                }

                
                if (Math.abs(diffX) > Math.abs(diffY)) {
                     if(e.cancelable) e.preventDefault();
                     pages.style.transform = `translateX(calc(-${runtime.currentPage * (100 / runtime.totalPages)}% + ${diffX}px))`;
                }
            };

            const onDragEnd = (e) => {
                if (!isDragging) return;
                isDragging = false;
                pages.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

                
                if (isClick) {
                    updatePagination(); 
                    
                    return; 
                }

                
                const diffX = currentX - startX;
                if (Math.abs(diffX) > pagesContainer.offsetWidth / 4) {
                    if (diffX > 0 && runtime.currentPage > 0) {
                        runtime.currentPage--;
                    } else if (diffX < 0 && runtime.currentPage < runtime.totalPages - 1) {
                        runtime.currentPage++;
                    }
                }
                updatePagination();
            };

            pagesContainer.addEventListener('mousedown', onDragStart);
            pagesContainer.addEventListener('mousemove', onDragMove);
            pagesContainer.addEventListener('mouseup', onDragEnd);
            pagesContainer.addEventListener('mouseleave', onDragEnd);

            
            pagesContainer.addEventListener('touchstart', onDragStart, { passive: false });
            pagesContainer.addEventListener('touchmove', onDragMove, { passive: false });
            pagesContainer.addEventListener('touchend', onDragEnd);
        }

export async function handleWidgetImageChange(imageId) {
    const element = document.getElementById(imageId);
    if (!element) return;

    
    const choice = await showChoiceModal("更换图片", [
        { text: '📁 从本地上传', value: 'local' },
        { text: '🌐 使用网络URL', value: 'url' }
    ]);

    let newUrl = null;

    
    if (choice === 'local') {
        
        newUrl = await uploadImageLocally();
    } else if (choice === 'url') {
        
        newUrl = await showCustomPrompt("Change Image", "Enter an image URL", element.src, "url");
    }

    
    if (newUrl && newUrl.trim()) {
        const trimmedUrl = newUrl.trim();
        
        
        element.src = trimmedUrl;
        
        
        if (!runtime.state.globalSettings.widgetData) {
            runtime.state.globalSettings.widgetData = {};
        }
        runtime.state.globalSettings.widgetData[imageId] = trimmedUrl;
        
        
        await runtime.db.globalSettings.put(runtime.state.globalSettings);
        
        
        await showCustomAlert("Success", "Widget image updated.");
    }
}
