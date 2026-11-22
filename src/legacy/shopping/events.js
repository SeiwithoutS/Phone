import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { addToCart, handleCheckout, openCartScreen, openProductEditor, openShoppingScreen, openVariationSelector, renderCartItems, renderShoppingProducts, saveProduct, sendGiftMessage, showGiftReceipt, updateCartCount, updateCartItemQuantity, updateCartTotal, updateDeleteCategoryButtonVisibility, handleGenerateShoppingItems, openShoppingSettingsModal, saveShoppingSettings, switchShoppingCategory } from './store.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'
import { deleteAppearancePreset, handleAppearancePresetSelectionChange, saveAppearancePreset } from '../appearance/presets.js'

export function bindShoppingEvents() {
  document.getElementById('open-shopping-btn').addEventListener('click', openShoppingScreen);

document.getElementById('shopping-back-btn').addEventListener('click', () => showScreen('chat-interface-screen'));

document.getElementById('go-to-cart-btn').addEventListener('click', openCartScreen);

document.getElementById('cart-back-btn').addEventListener('click', openShoppingScreen);

document.getElementById('checkout-btn').addEventListener('click', handleCheckout);

document.getElementById('close-receipt-btn').addEventListener('click', () => {
            document.getElementById('gift-receipt-modal').classList.remove('visible');
        });

document.getElementById('manage-products-btn').addEventListener('click', () => {
    runtime.isProductManagementMode = !runtime.isProductManagementMode;
    const btn = document.getElementById('manage-products-btn');
    const actionBar = document.getElementById('shopping-action-bar');
    const gridEl = document.getElementById('product-grid');

    btn.style.color = runtime.isProductManagementMode ? 'var(--accent-color)' : 'var(--text-primary)';

    if (runtime.isProductManagementMode) {
        actionBar.style.display = 'flex'; 
        gridEl.style.paddingBottom = '80px'; 
    } else {
        actionBar.style.display = 'none'; 
        gridEl.style.paddingBottom = ''; 
        
        runtime.selectedProducts.clear();
        document.querySelectorAll('.product-item.selected').forEach(item => item.classList.remove('selected'));
        document.getElementById('delete-selected-products-btn').textContent = `Delete (0)`;
        document.getElementById('select-all-products-checkbox').checked = false;
    }

    
    renderShoppingProducts();
    updateDeleteCategoryButtonVisibility();
});

document.getElementById('add-new-product-btn').addEventListener('click', () => {
            if (runtime.isProductManagementMode) {
                openProductEditor(null);
            } else {
                alert("Open Manage Products before adding items.");
            }
        });

document.getElementById('product-grid').addEventListener('click', async e => {
            const productItem = e.target.closest('.product-item');
            if (!productItem) return;
            const productId = parseInt(productItem.dataset.id);
            if (isNaN(productId)) return;

            
            if (runtime.isProductManagementMode) {
                
                if (e.target.classList.contains('edit-product-btn')) {
                    openProductEditor(productId);
                    return;
                }
                
                if (e.target.classList.contains('delete-product-btn')) {
                    const product = await runtime.db.shoppingProducts.get(productId);
                    if (!product) return;
                    const confirmed = await showCustomConfirm("Delete Product", `Permanently delete “${product.name}”?`, { confirmButtonClass: 'btn-danger' });
                    if(confirmed) {
                         await runtime.db.shoppingProducts.delete(productId);
                         await renderShoppingProducts(); 
                         alert("Product deleted.");
                    }
                    return;
                }
                
                
                productItem.classList.toggle('selected');
                if (runtime.selectedProducts.has(productId)) {
                    runtime.selectedProducts.delete(productId);
                } else {
                    runtime.selectedProducts.add(productId);
                }
                document.getElementById('delete-selected-products-btn').textContent = `Delete (${runtime.selectedProducts.size})`;
                return;
            }

            
            if (e.target.classList.contains('add-to-cart-btn')) {
                const product = await runtime.db.shoppingProducts.get(productId);
                if (product.variations && product.variations.length > 0) {
                    openVariationSelector(productId);
                } else {
                    await addToCart(productId);
                    await showCustomAlert("Success", "Added to cart.");
                }
                return;
            }

            
            if (productItem.contains(e.target)) {
                 console.log(`点击了商品卡片: ${productId}`);
            }
        });

document.getElementById('cart-items-list').addEventListener('click', e => {
            const target = e.target;
            if (target.classList.contains('decrease-qty-btn')) {
                updateCartItemQuantity(parseInt(target.dataset.id), -1);
            }
            if (target.classList.contains('increase-qty-btn')) {
                updateCartItemQuantity(parseInt(target.dataset.id), 1);
            }
            if (target.classList.contains('cart-item-checkbox')) {
                updateCartTotal();
            }
        });

document.getElementById('clear-cart-btn').addEventListener('click', async () => {
            if (runtime.shoppingCart.length === 0) return;
            const confirmed = await showCustomConfirm("Clear Cart", "Remove all items from the cart?");
            if (confirmed) {
                runtime.shoppingCart = [];
                updateCartCount();
                renderCartItems();
            }
        });

document.getElementById('select-all-cart-items').addEventListener('change', function(e) {
            document.querySelectorAll('.cart-item-checkbox').forEach(cb => {
                cb.checked = e.target.checked;
            });
            updateCartTotal();
        });

document.getElementById('cancel-product-editor-btn').addEventListener('click', () => {
            document.getElementById('product-editor-modal').classList.remove('visible');
        });

document.getElementById('save-product-btn').addEventListener('click', saveProduct);

document.getElementById('product-image-input').addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => { document.getElementById('product-image-preview').src = re.target.result; };
                reader.readAsDataURL(file);
            }
        });

document.getElementById('chat-messages').addEventListener('click', e => {
            const giftCard = e.target.closest('.gift-card');
            if (giftCard) {
                const bubble = giftCard.closest('.message-bubble');
                if (bubble) {
                    showGiftReceipt(parseInt(bubble.dataset.timestamp));
                }
            }
        });

document.getElementById('cancel-gift-recipient-btn').addEventListener('click', () => {
            document.getElementById('gift-recipient-modal').classList.remove('visible');
        });

document.getElementById('confirm-gift-recipient-btn').addEventListener('click', async () => {
            
            const selectedRecipients = Array.from(document.querySelectorAll('#gift-recipient-list .contact-picker-item.selected'))
                .map(item => item.dataset.recipientName);
            
            if (selectedRecipients.length === 0) {
                alert("Select at least one recipient.");
                return;
            }
            
            
            const selectedItems = runtime.shoppingCart.filter(item => 
                document.querySelector(`.cart-item-checkbox[data-id="${item.productId}"]:checked`)
            );
            
            
            await sendGiftMessage(selectedItems, selectedRecipients);
            
            
            document.getElementById('gift-recipient-modal').classList.remove('visible');
        });
}

export function bindShoppingVariations() {
  document.getElementById('cancel-variation-selection-btn').addEventListener('click', () => {
            document.getElementById('variation-selection-modal').classList.remove('visible');
        });

document.getElementById('variation-decrease-qty').addEventListener('click', () => {
            const display = document.getElementById('variation-quantity-display');
            let qty = parseInt(display.textContent);
            if (qty > 1) display.textContent = qty - 1;
        });

document.getElementById('variation-increase-qty').addEventListener('click', () => {
            const display = document.getElementById('variation-quantity-display');
            display.textContent = parseInt(display.textContent) + 1;
        });

document.getElementById('product-category-tabs').addEventListener('click', (e) => {
    
    if (e.target.classList.contains('product-category-tab')) {
        
        const categoryId = e.target.dataset.categoryId === 'all' ? 'all' : parseInt(e.target.dataset.categoryId);
        
        
        switchShoppingCategory(categoryId);
    }
});

document.getElementById('generate-shopping-items-btn').addEventListener('click', handleGenerateShoppingItems);

document.getElementById('shopping-settings-btn').addEventListener('click', openShoppingSettingsModal);

document.getElementById('save-shopping-settings-btn').addEventListener('click', saveShoppingSettings);

document.getElementById('cancel-shopping-settings-btn').addEventListener('click', () => {
    document.getElementById('shopping-settings-modal').classList.remove('visible');
});

document.getElementById('select-all-products-checkbox').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    
    const visibleItems = document.querySelectorAll('#product-grid .product-item');

    visibleItems.forEach(item => {
        const productId = parseInt(item.dataset.id);
        item.classList.toggle('selected', isChecked);
        if (isChecked) {
            runtime.selectedProducts.add(productId);
        } else {
            runtime.selectedProducts.delete(productId);
        }
    });
    document.getElementById('delete-selected-products-btn').textContent = `Delete (${runtime.selectedProducts.size})`;
});

document.getElementById('delete-selected-products-btn').addEventListener('click', async () => {
    if (runtime.selectedProducts.size === 0) {
        alert("Select products to delete.");
        return;
    }

    const confirmed = await showCustomConfirm(
        "Confirm Delete",
        `Permanently delete ${runtime.selectedProducts.size} selected products?`,
        { confirmButtonClass: 'btn-danger' }
    );

    if (confirmed) {
        await runtime.db.shoppingProducts.bulkDelete([...runtime.selectedProducts]);

        
        document.getElementById('manage-products-btn').click(); 
        
        await renderShoppingProducts();

        await showCustomAlert("Success", "Selected products deleted.");
    }
});

document.getElementById('appearance-preset-select').addEventListener('change', handleAppearancePresetSelectionChange);

document.getElementById('save-appearance-preset-btn').addEventListener('click', saveAppearancePreset);

document.getElementById('delete-appearance-preset-btn').addEventListener('click', deleteAppearancePreset);

document.getElementById('novelai-switch').addEventListener('change', (e) => {
    const detailsDiv = document.getElementById('novelai-details');
    detailsDiv.style.display = e.target.checked ? 'block' : 'none';
});
}
