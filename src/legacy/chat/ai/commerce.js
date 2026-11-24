import { postTransfer, transferCents, TransferError } from '../../../features/bank/bank'
import { MarketOrderError, placeOrder } from '../../../features/shopping/market'
import { runtime } from '../../runtime/state.js'

export async function createMarketOrderMessage(chat, msgData, baseMessage) {
    if (chat.isGroup || chat.settings.isOfflineMode || chat.settings.allowStorePurchases !== true) return null;
    const productId = typeof msgData.productId === 'string' ? msgData.productId.trim() : '';
    const quantity = msgData.quantity ?? 1;
    try {
        const hasProposal = msgData.product != null;
        if (Boolean(productId) === hasProposal) {
            throw new MarketOrderError('Provide either a catalog product ID or the details of one new product.');
        }
        const order = await placeOrder(runtime.db, {
            id: crypto.randomUUID(),
            cart: productId ? { [productId]: quantity } : {},
            newItem: hasProposal ? { product: msgData.product, quantity } : undefined,
            buyer: chat,
            recipient: msgData.recipient === 'user' ? chat.settings.myNickname || 'You' : chat.name,
            note: typeof msgData.reason === 'string' ? msgData.reason : '',
        });
        const item = order.items[0];
        return {
            ...baseMessage, type: 'market_order', orderId: order.id,
            orderTotal: order.total, orderRecipient: order.recipient, content: item.quantity + ' × ' + item.name
        };
    } catch (error) {
        if (!(error instanceof MarketOrderError)) throw error;
        return {
            ...baseMessage, role: 'system', type: 'app_action_status',
            content: 'Marketplace order failed: ' + error.message
        };
    }
}

export async function createTransferMessage(chat, actor, msgData, baseMessage) {
    if (!actor || actor.settings.allowBankTransfers === false) return null;
    const recipient = typeof msgData.receiver === 'string' ? msgData.receiver.trim() : '';
    if (chat.isGroup && recipient && !['user', 'You', chat.settings.myNickname || '我',
        runtime.state.qzoneSettings?.nickname].includes(recipient)) return null;
    const cents = transferCents(msgData.amount);
    if (!Number.isSafeInteger(cents) || cents <= 0) return null;
    const note = typeof msgData.note === 'string' ? msgData.note.slice(0, 240) : '';
    const id = crypto.randomUUID();
    const aiMessage = { ...baseMessage, type: 'transfer', amount: cents / 100, note, receiverName: 'You' };
    aiMessage.bankTransferId = id;
    aiMessage.status = 'accepted';
    try {
        if (!await postTransfer(runtime.db, {
            id, from: actor.id, to: 'user', cents, note, timestamp: aiMessage.timestamp
        }, chat, aiMessage)) return null;
    } catch (error) {
        if (!(error instanceof TransferError)) throw error;
        return {
            ...baseMessage, role: 'system', type: 'app_action_status',
            content: 'Bank transfer failed: ' + error.message
        };
    }
    return aiMessage;
}
