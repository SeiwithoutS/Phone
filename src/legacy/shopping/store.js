import { escapeHtml, imageSource } from '../../runtime/files'
import { requestContextCompletion } from '../../features/api/completion'
import { getGeminiResponseText } from '../api/client.js'
import { appendMessage } from '../chat/conversation.js'
import { getDisplayNameInGroup } from '../chat/groups.js'
import { renderChatList } from '../chat/list.js'
import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'

export async function renderShoppingProducts() {
    const gridEl = document.getElementById('product-grid');
    const tabsContainer = document.getElementById('product-category-tabs');
    const shoppingScreen = document.getElementById('shopping-screen');
    gridEl.innerHTML = '';
    tabsContainer.innerHTML = '';

    
    const [allProducts, allCategories] = await Promise.all([
        runtime.db.shoppingProducts.toArray(),
        runtime.db.shoppingCategories.orderBy('name').toArray()
    ]);

    shoppingScreen.classList.toggle('management-mode', runtime.isProductManagementMode);

    
    const allTab = document.createElement('button');
    allTab.className = 'product-category-tab'; 
    allTab.textContent = "All";
    allTab.dataset.categoryId = 'all';
    if (runtime.activeShoppingCategoryId === 'all') allTab.classList.add('active');
    tabsContainer.appendChild(allTab);

    allCategories.forEach(cat => {
        const tab = document.createElement('button');
        tab.className = 'product-category-tab'; 
        tab.textContent = cat.name;
        tab.dataset.categoryId = cat.id;
        if (runtime.activeShoppingCategoryId === cat.id) tab.classList.add('active');
        tabsContainer.appendChild(tab);
    });
    
    
    let productsToShow;
    if (runtime.activeShoppingCategoryId === 'all') {
        productsToShow = allProducts;
    } else {
        productsToShow = allProducts.filter(p => p.categoryId === runtime.activeShoppingCategoryId);
    }
    
    
    if (productsToShow.length === 0) {
        const message = runtime.activeShoppingCategoryId === 'all' 
            ? '商店空空如也，点击“管理”添加商品吧！'
            : '这个分类下还没有商品哦~';
        gridEl.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); margin-top: 50px;">${message}</p>`;
        return;
    }

    productsToShow.forEach(product => {
        const item = document.createElement('div');
        item.className = 'product-item';
        item.dataset.id = product.id;
        
        const managementControls = runtime.isProductManagementMode ? `
            <div class="product-management-overlay">
                <button class="edit-product-btn">Edit</button>
                <button class="delete-product-btn">Delete</button>
            </div>
        ` : '';

        item.innerHTML = `
            ${managementControls}
            <img src="${escapeHtml(imageSource(String(product.imageUrl || "")))}" class="product-image">
            <div class="product-info">
                <div class="product-name">${escapeHtml(String(product.name))}</div>
                <div class="product-footer">
                    <div class="product-price">${product.price.toFixed(2)}</div>
                    <button class="add-to-cart-btn">Add to Cart</button>
                </div>
            </div>
        `;
        gridEl.appendChild(item);
    });
}

export function switchShoppingCategory(categoryId) {
    runtime.activeShoppingCategoryId = categoryId;
    renderShoppingProducts(); 
updateDeleteCategoryButtonVisibility();
}

export function updateDeleteCategoryButtonVisibility() {
            const deleteBtn = document.getElementById('delete-current-category-btn');
            if (!deleteBtn) return;

            
            
            
            const isVisible = runtime.isProductManagementMode && runtime.activeShoppingCategoryId !== 'all';
            deleteBtn.style.display = isVisible ? 'flex' : 'none';
        }

export async function handleDeleteCurrentCategory() {
            if (runtime.activeShoppingCategoryId === 'all') return; 

            const categoryId = runtime.activeShoppingCategoryId;
            const category = await runtime.db.shoppingCategories.get(categoryId);
            if (!category) {
                alert("The category could not be found.");
                return;
            }

            const confirmMessage = `确定要永久删除分类 “${category.name}” 吗？\n\n此操作【不会】删除分类下的商品，它们将被移至“未分类”。`;
            const confirmed = await showCustomConfirm("Delete Category", confirmMessage, {
                confirmButtonClass: 'btn-danger',
                confirmText: "Confirm Delete"
            });

            if (confirmed) {
                
                await deleteProductCategory(categoryId);
                
                
                runtime.activeShoppingCategoryId = 'all';
                await renderShoppingProducts();
                
                
                updateDeleteCategoryButtonVisibility();

                await showCustomAlert("Success", `Category “${category.name}” deleted.`);
            }
        }

export async function openShoppingScreen() {
    runtime.activeShoppingCategoryId = 'all'; 
    await renderShoppingProducts();
    showScreen('shopping-screen');
updateDeleteCategoryButtonVisibility();
}

export async function addToCart(productId, quantity = 1, variation = null) {
            
            const existingItem = variation
                ? runtime.shoppingCart.find(item => item.productId === productId && item.variation?.name === variation.name)
                : runtime.shoppingCart.find(item => item.productId === productId && !item.variation);

            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                const product = await runtime.db.shoppingProducts.get(productId);
                if (product) {
                    runtime.shoppingCart.push({ productId: product.id, quantity: quantity, variation: variation });
                }
            }
            updateCartCount();
        }

export function updateCartItemQuantity(productId, change) {
            const itemIndex = runtime.shoppingCart.findIndex(item => item.productId === productId);
            if (itemIndex > -1) {
                runtime.shoppingCart[itemIndex].quantity += change;
                if (runtime.shoppingCart[itemIndex].quantity <= 0) {
                    runtime.shoppingCart.splice(itemIndex, 1);
                }
                updateCartCount();
                renderCartItems();
            }
        }

export function updateCartCount() {
            const totalItems = runtime.shoppingCart.reduce((sum, item) => sum + item.quantity, 0);
            document.getElementById('cart-count').textContent = totalItems;
            document.getElementById('cart-title').textContent = `Cart (${totalItems})`;
            document.getElementById('checkout-btn').textContent = `Checkout (${totalItems})`;
        }

export function openCartScreen() {
            renderCartItems();
            showScreen('cart-screen');
        }

export async function renderCartItems() {
            const listEl = document.getElementById('cart-items-list');
            listEl.innerHTML = '';
            let total = 0;
        
            if (runtime.shoppingCart.length === 0) {
                listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); margin-top: 50px;\">The cart is empty.</p>";
            } else {
                const productIds = runtime.shoppingCart.map(item => item.productId);
                const products = await runtime.db.shoppingProducts.where('id').anyOf(productIds).toArray();
                const productMap = new Map(products.map(p => [p.id, p]));
        
                runtime.shoppingCart.forEach(item => {
                    const product = productMap.get(item.productId);
                    if (product) {
                        const itemEl = document.createElement('div');
                        itemEl.className = 'cart-item';
                        
                        
                        const variationHtml = item.variation
                            ? `<div class="cart-item-variation" style="font-size: 0.75rem; color: #8a8a8a; margin-top: 4px;">Variant: ${item.variation.name}</div>`
                            : '';
                        
                        itemEl.innerHTML = `
                            <input type="checkbox" class="cart-item-checkbox" data-id="${product.id}" checked>
                            <img src="${escapeHtml(imageSource(String(item.variation?.imageUrl || product.imageUrl || "")))}" class="cart-item-image">
                            <div class="cart-item-info">
                                <div class="cart-item-name">${escapeHtml(String(product.name))}</div>
                                ${variationHtml}
                                <div class="cart-item-footer">
                                    <div class="cart-item-price">¥${(item.variation?.price || product.price).toFixed(2)}</div>
                                    <div class="quantity-control">
                                        <button class="quantity-btn decrease-qty-btn" data-id="${product.id}">-</button>
                                        <span class="quantity-display">${item.quantity}</span>
                                        <button class="quantity-btn increase-qty-btn" data-id="${product.id}">+</button>
                                    </div>
                                </div>
                            </div>
                        `;
                        listEl.appendChild(itemEl);
                    }
                });
            }
            updateCartTotal();
        }

export async function updateCartTotal() {
            let total = 0;
            const selectedCheckboxes = document.querySelectorAll('.cart-item-checkbox:checked');
            const selectedProductIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.id));
        
            if (selectedProductIds.length > 0) {
                const products = await runtime.db.shoppingProducts.where('id').anyOf(selectedProductIds).toArray();
                const productMap = new Map(products.map(p => [p.id, p]));
                
                runtime.shoppingCart.forEach(cartItem => {
                    if (selectedProductIds.includes(cartItem.productId)) {
                        const product = productMap.get(cartItem.productId);
                        if (product) {
                            
                            const price = cartItem.variation ? cartItem.variation.price : product.price;
                            total += price * cartItem.quantity;
                        }
                    }
                });
            }
            document.getElementById('cart-total').textContent = `Total: ¥${total.toFixed(2)}`;
        }

export async function openGiftRecipientPicker() {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat || !chat.isGroup) return;
        
            const modal = document.getElementById('gift-recipient-modal');
            const listEl = document.getElementById('gift-recipient-list');
            listEl.innerHTML = '';
        
            
            const myNickname = chat.settings.myNickname || '我';
            const members = chat.members.filter(m => m.groupNickname !== myNickname);
        
            members.forEach(member => {
                const item = document.createElement('div');
                item.className = 'contact-picker-item';
                
                item.dataset.recipientName = member.originalName; 
        
                item.innerHTML = `
                    <div class="checkbox"></div>
                    <img src="${member.avatar || runtime.defaultGroupMemberAvatar}" class="avatar">
                    <span class="name">${member.groupNickname}</span>
                `;
                listEl.appendChild(item);
            });
            
            
            document.getElementById('select-all-recipients').checked = false;
            modal.classList.add('visible');
        }

export async function handleCheckout() {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const selectedItems = runtime.shoppingCart.filter(item => 
                document.querySelector(`.cart-item-checkbox[data-id="${item.productId}"]:checked`)
            );
            if (selectedItems.length === 0) {
                alert("Select items to check out.");
                return;
            }
        
            if (chat.isGroup) {
                
                openGiftRecipientPicker();
            } else {
                
                const confirmed = await showCustomConfirm( "Send Gift", `Send the selected items as a gift?`, { confirmText: '送出礼物' });
                if (confirmed) {
                    await sendGiftMessage(selectedItems); 
                }
            }
        }

export async function sendGiftMessage(itemsToSend, recipients = null) {
            if (!runtime.state.activeChatId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            
            const productIds = itemsToSend.map(item => item.productId);
            const products = await runtime.db.shoppingProducts.where('id').anyOf(productIds).toArray();
            const productMap = new Map(products.map(p => [p.id, p]));
            
const itemsForMessage = itemsToSend.map(cartItem => {
    const product = productMap.get(cartItem.productId);
    if (cartItem.variation) {
        
        return {
            name: `${product.name} - ${cartItem.variation.name}`, 
            price: cartItem.variation.price,
            imageUrl: cartItem.variation.imageUrl || product.imageUrl, 
            quantity: cartItem.quantity
        };
    } else {
        
        return {
            name: product.name,
            price: product.price,
            imageUrl: product.imageUrl,
            quantity: cartItem.quantity
        };
    }
});
            const giftMessage = {
                role: 'user', type: 'gift', timestamp: Date.now(),
                items: itemsForMessage,
                total: itemsForMessage.reduce((sum, item) => sum + item.price * item.quantity, 0),
                recipients: recipients 
            };
            
            chat.history.push(giftMessage);
        
            
            if (recipients && recipients.length > 0) {
                const recipientDisplayNames = recipients.map(originalName => getDisplayNameInGroup(chat, originalName)).join('、');
                const hiddenMessage = {
                    role: 'system',
                    content: `[System notice: The user (${chat.settings.myNickname || 'You'}) sent a gift to ${recipientDisplayNames}. If you received it, thank them. Other characters may react in their own way.]`,
                    timestamp: Date.now() + 1,
                    isHidden: true
                };
                chat.history.push(hiddenMessage);
            }
        
            await runtime.db.chats.put(chat);
            
            appendMessage(giftMessage, chat);
            renderChatList();
            
            
            runtime.shoppingCart = runtime.shoppingCart.filter(item => !itemsToSend.some(sent => sent.productId === item.productId));
            updateCartCount();
            showScreen('chat-interface-screen');
            
            await showCustomAlert("Success", "Gift sent.");
        }

export function showGiftReceipt(timestamp) {
            
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const message = chat.history.find(m => m.timestamp === timestamp);
            if (!message || message.type !== 'gift') return;
            const receiptBody = document.getElementById('gift-receipt-body');
            let itemsHtml = '';
            message.items.forEach(item => {
                itemsHtml += `<tr><td class="item-name">${escapeHtml(String(item.name))}</td><td class="item-qty">${item.quantity}</td><td class="item-price">¥${item.price.toFixed(2)}</td><td class="item-subtotal">¥${(item.price * item.quantity).toFixed(2)}</td></tr>`;
            });
            receiptBody.innerHTML = `<div class="receipt-header"><h3>Shopping Center</h3><p>Purchased: ${new Date(message.timestamp).toLocaleString()}</p></div><table class="receipt-items-table"><thead><tr><th class="item-name">Item</th><th class="item-qty">Quantity</th><th class="item-price">Unit Price</th><th class="item-subtotal">Subtotal</th></tr></thead><tbody>${itemsHtml}</tbody></table><div class="receipt-total">Total: ¥${message.total.toFixed(2)}</div><div class="receipt-footer">Thank you for shopping.</div>`;
            document.getElementById('gift-receipt-modal').classList.add('visible');
        }

export async function openProductEditor(productId = null) {
            runtime.editingProductId = productId;
            const modal = document.getElementById('product-editor-modal');
            const title = document.getElementById('product-editor-title');
            const nameInput = document.getElementById('product-name-input');
            const priceInput = document.getElementById('product-price-input');
            const descInput = document.getElementById('product-description-input');
            const imagePreview = document.getElementById('product-image-preview');
            const categorySelect = document.getElementById('product-category-select');
            const variationsContainer = document.getElementById('product-variations-container');
            
            
            variationsContainer.innerHTML = '';
            
            
            categorySelect.innerHTML = "<option value=\"\">Uncategorized</option>";
            const categories = await runtime.db.shoppingCategories.toArray();
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                categorySelect.appendChild(option);
            });

            if (productId) {
                title.textContent = "Edit Product";
                const product = await runtime.db.shoppingProducts.get(productId);
                nameInput.value = product.name;
                priceInput.value = product.price;
                descInput.value = product.description || '';
                imagePreview.src = product.imageUrl;
                categorySelect.value = product.categoryId || '';
                
                
                if (product.variations && product.variations.length > 0) {
                    product.variations.forEach(v => addProductVariationInput(v));
                }

            } else {
                title.textContent = "Add Product";
                nameInput.value = '';
                priceInput.value = '';
                descInput.value = '';
                imagePreview.src = 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1756206115802_qdqqd_0c99bh.jpeg';
                categorySelect.value = '';
            }
            modal.classList.add('visible');
        }

export async function saveProduct() {
            const name = document.getElementById('product-name-input').value.trim();
            const price = parseFloat(document.getElementById('product-price-input').value);
            const description = document.getElementById('product-description-input').value.trim();
            const imageUrl = document.getElementById('product-image-preview').src;
            const categoryId = parseInt(document.getElementById('product-category-select').value) || null;

            if (!name) { alert("Enter a product name."); return; }
            if (isNaN(price) || price < 0) { alert("Enter a valid default price."); return; }

            
            const variations = [];
            document.querySelectorAll('.variation-block').forEach(block => {
                const varName = block.querySelector('.variation-name-input').value.trim();
                const varPrice = parseFloat(block.querySelector('.variation-price-input').value);
                const varImageUrl = block.querySelector('.variation-image-preview').src;

                if (varName && !isNaN(varPrice) && varPrice >= 0) {
                    variations.push({
                        name: varName,
                        price: varPrice,
                        imageUrl: varImageUrl.includes('placeholder.png') ? null : varImageUrl
                    });
                }
            });

            const productData = { name, price, description, imageUrl, categoryId, variations };
            
            if (runtime.editingProductId) {
                await runtime.db.shoppingProducts.update(runtime.editingProductId, productData);
            } else {
                await runtime.db.shoppingProducts.add(productData);
            }
            document.getElementById('product-editor-modal').classList.remove('visible');
            await renderShoppingProducts();
        }

export async function openProductCategoryManager() {
    await renderProductCategoriesInManager();
    document.getElementById('product-category-manager-modal').classList.add('visible');
}

export async function renderProductCategoriesInManager() {
    const listEl = document.getElementById('existing-product-categories-list');
    const categories = await runtime.db.shoppingCategories.toArray();
    listEl.innerHTML = '';
    if (categories.length === 0) {
        listEl.innerHTML = "<p style=\"text-align: center; color: var(--text-secondary);\">No categories yet.</p>";
        return;
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

export async function addNewProductCategory() {
    const input = document.getElementById('new-product-category-name-input');
    const name = input.value.trim();
    if (!name) return alert("Enter a category name.");
    const existing = await runtime.db.shoppingCategories.where('name').equals(name).first();
    if (existing) return alert(`The category “${name}” already exists.`);
    
    await runtime.db.shoppingCategories.add({ name });
    input.value = '';
    await renderProductCategoriesInManager();
}

export async function deleteProductCategory(categoryId) {
    const confirmed = await showCustomConfirm("Confirm Delete", "Delete this category? Its products will become uncategorized.", { confirmButtonClass: 'btn-danger' });
    if (confirmed) {
        await runtime.db.shoppingCategories.delete(categoryId);
        await runtime.db.shoppingProducts.where('categoryId').equals(categoryId).modify({ categoryId: null });
        await renderProductCategoriesInManager();
    }
}

export function addProductVariationInput(variation = {}) {
    const container = document.getElementById('product-variations-container');
    const block = document.createElement('div');
    block.className = 'message-editor-block variation-block'; // 复用样式
    block.innerHTML = `
        <button class="delete-block-btn" title="删除此款式">×</button>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
                <label style="font-size: 0.8em;">Variant Name</label>
                <input type="text" class="variation-name-input" placeholder="例如: 红色" value="${variation.name || ''}">
            </div>
            <div class="form-group">
                <label style="font-size: 0.8em;">Price (¥)</label>
                <input type="number" class="variation-price-input" min="0" step="0.01" value="${variation.price || ''}">
            </div>
        </div>
        <div class="form-group">
            <label style="font-size: 0.8em;">Variant Image (optional)</label>
            <div class="avatar-upload">
                <img class="variation-image-preview" src="${variation.imageUrl || 'https://i.postimg.cc/PqYp5T5M/image.png'}">
                <button type="button" class="form-button-secondary upload-variation-image-btn" style="margin: 0; padding: 8px 12px;">Upload</button>
                <input type="file" class="variation-image-input" accept="image/*" hidden>
            </div>
        </div>
    `;

    block.querySelector('.delete-block-btn').addEventListener('click', () => block.remove());
    block.querySelector('.upload-variation-image-btn').addEventListener('click', () => {
        block.querySelector('.variation-image-input').click();
    });
    block.querySelector('.variation-image-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (re) => { block.querySelector('.variation-image-preview').src = re.target.result; };
            reader.readAsDataURL(file);
        }
    });
    
    container.appendChild(block);
    return block;
}

export async function openVariationSelector(productId) {
    const product = await runtime.db.shoppingProducts.get(productId);
    if (!product || !product.variations || product.variations.length === 0) return;

    const modal = document.getElementById('variation-selection-modal');
    document.getElementById('variation-product-image').src = product.imageUrl;
    document.getElementById('variation-product-name').textContent = product.name;
    
    const optionsContainer = document.getElementById('variation-options-container');
    optionsContainer.innerHTML = '';
    
    product.variations.forEach((variation, index) => {
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'variation-select';
        radio.id = `var-${productId}-${index}`;
        radio.value = index;
        radio.style.display = 'none';
        if (index === 0) radio.checked = true;

        const label = document.createElement('label');
        label.htmlFor = `var-${productId}-${index}`;
        label.textContent = variation.name;
        label.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #ccc;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.2s;
        `;
        
        optionsContainer.appendChild(radio);
        optionsContainer.appendChild(label);
    });

    const updateSelectionUI = () => {
        const selectedRadio = optionsContainer.querySelector('input[name="variation-select"]:checked');
        optionsContainer.querySelectorAll('label').forEach(lbl => {
            lbl.style.borderColor = '#ccc';
            lbl.style.color = '#333';
            lbl.style.backgroundColor = 'white';
        });
        if (selectedRadio) {
            const selectedLabel = optionsContainer.querySelector(`label[for="${selectedRadio.id}"]`);
            selectedLabel.style.borderColor = 'var(--accent-color)';
            selectedLabel.style.color = 'var(--accent-color)';
            selectedLabel.style.backgroundColor = '#e7f3ff';

            const selectedVariation = product.variations[parseInt(selectedRadio.value)];
            document.getElementById('variation-selected-price').textContent = `¥${selectedVariation.price.toFixed(2)}`;
            if (selectedVariation.imageUrl) {
                document.getElementById('variation-product-image').src = selectedVariation.imageUrl;
            } else {
                document.getElementById('variation-product-image').src = product.imageUrl;
            }
        }
    };
    
    optionsContainer.addEventListener('change', updateSelectionUI);
    updateSelectionUI(); 
    
    document.getElementById('variation-quantity-display').textContent = '1';

    const confirmBtn = document.getElementById('confirm-variation-selection-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', async () => {
        const selectedRadio = optionsContainer.querySelector('input[name="variation-select"]:checked');
        const quantity = parseInt(document.getElementById('variation-quantity-display').textContent);
        if (selectedRadio) {
            const selectedVariation = product.variations[parseInt(selectedRadio.value)];
            await addToCart(productId, quantity, selectedVariation);
            modal.classList.remove('visible');
            await showCustomAlert("Success", "Added to cart.");
        }
    });

    modal.classList.add('visible');
}

export function openShoppingSettingsModal() {
    const modal = document.getElementById('shopping-settings-modal');
    
    // 从全局设置中读取已保存的值，如果没有就使用默认值
    document.getElementById('shopping-category-count-input').value = runtime.state.globalSettings.shoppingCategoryCount || 3;
    document.getElementById('shopping-product-count-input').value = runtime.state.globalSettings.shoppingProductCount || 8;
    
    modal.classList.add('visible');
}

export async function saveShoppingSettings() {
    const categoryInput = document.getElementById('shopping-category-count-input');
    const productInput = document.getElementById('shopping-product-count-input');
    
    const categoryCount = parseInt(categoryInput.value);
    const productCount = parseInt(productInput.value);

  
    if (isNaN(categoryCount) || isNaN(productCount) || categoryCount < 1 || productCount < 1) {
        alert("Enter a positive whole number.");
        return;
    }

 
    runtime.state.globalSettings.shoppingCategoryCount = categoryCount;
    runtime.state.globalSettings.shoppingProductCount = productCount;
    await runtime.db.globalSettings.put(runtime.state.globalSettings);

 
    document.getElementById('shopping-settings-modal').classList.remove('visible');
    await showCustomAlert("Saved", "Shopping generation settings saved.");
}

export async function handleGenerateShoppingItems() {
 
    if (!runtime.state.activeChatId) {
        await showCustomAlert("Operation Failed", "Open a character chat before generating products.");
        return;
    }
    const chat = runtime.state.chats[runtime.state.activeChatId];

    const confirmed = await showCustomConfirm(
        `Generate Products for “${chat.name}”?`,
        "Generate products and categories with the AI and add them to the current store?",
        { confirmText: '确认生成' }
    );

    if (!confirmed) return;

    await showCustomAlert("Please wait…", `Generating products for “${chat.name}”…`);


    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;

    if (!proxyUrl || !model) {
        await showCustomAlert("API Connection Required", "Configure a connection in API Connections.");
        return;
    }

    const categoryCount = runtime.state.globalSettings.shoppingCategoryCount || 3;
    const productCount = runtime.state.globalSettings.shoppingProductCount || 8;

const existingCategories = await runtime.db.shoppingCategories.toArray();
    let existingCategoriesContext = "";
    if (existingCategories.length > 0) {
        existingCategoriesContext = `
# Reuse existing categories (highest priority)
Check these categories first. Reuse an existing name exactly whenever a product fits. Create a new name only if none of these categories fit.
${existingCategories.map(category => JSON.stringify(category.name)).join(', ')}
`;
    }    
 
    const userNickname = runtime.state.qzoneSettings.nickname || '我';
    const systemPrompt = `
# Plan products for a character
Design products and categories for "${chat.name}". Draw on the character's personality, memories, and recent conversations. Choose plausible, varied products they would genuinely want, buy, or make. Use the language established by the character, user, and relevant context.

## Output (highest priority)
Return only a valid JSON object, starting with { and ending with }. Omit surrounding prose, explanation, and Markdown fences.
{"categories":[{"name":"Category name","products":[{"name":"Product name","price":99.80,"description":"Describe the product in at least 50 characters.","variations":[{"name":"First style","price":108.80,"image_prompt":"English keywords for the first style"},{"name":"Second style","price":118.80,"image_prompt":"English keywords for the second style"}],"image_prompt":"realistic product photo, high quality, on a clean white background"}]}]}
- Generate ${categoryCount} categories and ${productCount} products per category.
- Give each product 2–4 variations. Use English keywords for the product and variation images. Use a realistic, high-quality product photo on a clean white background for the main image.

## Context
- Character name: ${chat.name}
- Character persona: ${chat.settings.aiPersona}
${existingCategoriesContext}
Use the recent conversation supplied for this character.
`;

    try {
        const messagesForApi = [{ role: 'user', content: "Generate the catalog using the character and rules above." }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt, request: messagesForApi,
            task: 'Shop generation · ' + chat.name, scope: 'shop:' + chat.id });

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        const jsonMatch = aiResponseContent.match(/({[\s\S]*})/);
        if (!jsonMatch) throw new Error("AI返回的内容中未找到有效的JSON对象。");
        const generatedData = JSON.parse(jsonMatch[0]);

        if (!generatedData.categories || !Array.isArray(generatedData.categories)) {
            throw new Error("AI返回的JSON格式不正确，缺少 'categories' 数组。");
        }

        // (增量添加逻辑保持不变)
        await runtime.db.transaction('rw', runtime.db.shoppingProducts, runtime.db.shoppingCategories, async tx => {
            for (const category of generatedData.categories) {
                let categoryId;
                const existingCategory = await tx.shoppingCategories.where('name').equalsIgnoreCase(category.name).first();
                if (existingCategory) {
                    categoryId = existingCategory.id;
                } else {
                    categoryId = await tx.shoppingCategories.add({ name: category.name });
                }
                const productsToAdd = category.products.map(product => {
                    return {
                        name: product.name,
                        price: product.price || 0,
                        description: product.description || '',
                        imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(product.image_prompt)}`,
                        variations: (product.variations || []).map(v => ({
                            ...v,
                            imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(v.image_prompt)}`
                        })),
                        categoryId: categoryId
                    };
                });
                if (productsToAdd.length > 0) {
                    await tx.shoppingProducts.bulkAdd(productsToAdd);
                }
            }
        });

        runtime.activeShoppingCategoryId = 'all';
        await renderShoppingProducts();
        await showCustomAlert("Generation Complete", `Products for “${chat.name}” were added to the store.`);

    } catch (error) {
        console.error("生成购物中心商品失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate products. Check API Connections or retry. Error: ${error.message}`);
    }
}
