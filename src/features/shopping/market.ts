import { balanceFor, marketMerchant, transferCents, transferEvent } from '../bank/bank'
import { imageSource } from '../../runtime/files'
import type { Transfer } from '../bank/bank'
import type { ChatContact, ChatMessage } from '../chat/model'
import type { LocalDatabase } from '../../storage/database'
import type { StoredRow } from '../../../shared/storage'

export type MarketKind = 'food' | 'goods'
type OrderLine = { name: string; kind: MarketKind; cents: number; quantity: number; seller?: string; image?: string }
export const giftStyles = ['Blue', 'Blush', 'Mint'] as const
export type GiftDraft = { text: string; style: typeof giftStyles[number]; auto: boolean }
type GiftCard = GiftDraft & { sentAt?: number }
export type MarketProduct = Omit<OrderLine, 'quantity'> & { id: string; seller: string; image?: string; description?: string }
export type MarketOrder = StoredRow & {
  id: string; timestamp: number; items: OrderLine[]; subtotal: number; delivery: number; total: number;
  recipient: string; chatId?: string; chatName?: string; note: string; gift?: GiftCard
}

const catalog: MarketProduct[] = [
  { id: 'rice-bowl', name: 'Teriyaki rice bowl', seller: 'Little Bento', kind: 'food', cents: 2850 },
  { id: 'milk-tea', name: 'Brown sugar milk tea', seller: 'Pearl Tea', kind: 'food', cents: 1650 },
  { id: 'noodles', name: 'Miso noodle soup', seller: 'Little Bento', kind: 'food', cents: 3050 },
  { id: 'cake', name: 'Strawberry shortcake', seller: 'Daydream Bakery', kind: 'food', cents: 2250 },
  { id: 'notebook', name: 'Lavender pocket journal', seller: 'Paper Garden', kind: 'goods', cents: 2400 },
  { id: 'night-light', name: 'Cloud night light', seller: 'Little Room', kind: 'goods', cents: 4600 },
  { id: 'mug', name: 'Ceramic heart mug', seller: 'Little Room', kind: 'goods', cents: 2900 },
  { id: 'flowers', name: 'Dried flower bouquet', seller: 'Paper Garden', kind: 'goods', cents: 3500 },
]

type CatalogTable = Pick<LocalDatabase, 'shoppingProducts' | 'shoppingCategories'>
export async function marketProducts(database: CatalogTable): Promise<MarketProduct[]> {
  const [products, categories] = await Promise.all([database.shoppingProducts.toArray(), database.shoppingCategories.toArray()])
  const sellers = new Map(categories.map(category => [String(category.id), String(category.name ?? 'Local Shop')]))
  return [...catalog, ...products.flatMap(row => {
    const cents = transferCents(row.price)
    if (typeof row.name !== 'string' || !row.name.trim() || !Number.isSafeInteger(cents) || cents <= 0) return []
    return [{ id: 'custom:' + row.id, name: row.name,
      seller: typeof row.seller === 'string' && row.seller.trim() ? row.seller.trim() : sellers.get(String(row.categoryId)) || 'Local Shop',
      description: typeof row.description === 'string' ? row.description : '', cents, kind: row.marketKind === 'food' ? 'food' as const : 'goods' as const,
      image: typeof row.imageUrl === 'string' ? imageSource(row.imageUrl) : undefined }]
  })]
}

export async function addMarketProduct(database: CatalogTable, item: {
  name: string; price: string; seller: string; description: string; kind: MarketKind; image: string
}) {
  const name = item.name.trim().slice(0, 100)
  const cents = transferCents(item.price)
  const image = imageSource(item.image)
  if (!name) throw new Error('Enter a product name.')
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 10_000_000) throw new Error('Enter a price between 0.01 and 100,000 with up to two decimal places.')
  if (item.image.trim() && !image) throw new Error('Choose a supported image or enter an HTTPS/HTTP image URL.')
  if (item.kind !== 'food' && item.kind !== 'goods') throw new Error('Choose a product category.')
  await database.shoppingProducts.add({ name, price: cents / 100, seller: item.seller.trim().slice(0, 80),
    description: item.description.trim().slice(0, 500), marketKind: item.kind, imageUrl: image, categoryId: null, variations: [] })
}

export function orderPricing(items: OrderLine[]) {
  const subtotal = items.reduce((sum, item) => sum + item.cents * item.quantity, 0)
  const delivery = (items.some(item => item.kind === 'food') ? 400 : 0) + (items.some(item => item.kind === 'goods') ? 650 : 0)
  return { subtotal, delivery, total: subtotal + delivery }
}

export function deliveryTimeline(order: MarketOrder) {
  const foodOnly = order.items.every(item => item.kind === 'food')
  return [
    { label: 'Order confirmed', at: order.timestamp },
    { label: foodOnly ? 'Preparing food' : 'Packing items', at: order.timestamp + 120_000 },
    { label: 'Out for delivery', at: order.timestamp + (foodOnly ? 12 : 25) * 60_000 },
    { label: 'Delivered', at: order.timestamp + (foodOnly ? 30 : 90) * 60_000 },
  ] as const
}

export function deliveryStatus(order: MarketOrder, now = Date.now()) {
  const stage = deliveryTimeline(order).findLast(step => now >= step.at)
  return stage?.label ?? 'Order confirmed'
}

export function canShareOrder<T extends ChatContact>(chat: T | undefined): chat is T {
  if (!chat || chat.isSpectatorGroup) return false
  if (chat.isGroup) return true
  const relationship = chat.relationship as { status?: string } | undefined
  return !relationship || relationship.status === 'friend'
}

export async function placeOrder(database: LocalDatabase, request: {
  id: string; cart: Record<string, number>; expectedTotal: number; chat?: ChatContact; recipient: string; note: string;
  sendGiftOnDelivery?: boolean
}) {
  const { id, chat } = request
  const result = await database.transaction('rw', database.marketOrders, database.bankTransfers, database.chats,
    database.shoppingProducts, database.shoppingCategories, async tx => {
      const saved = await tx.marketOrders.get(id) as MarketOrder | undefined
      if (saved) return { order: saved }
      const current = chat ? await tx.chats.get(chat.id) as ChatContact | undefined : undefined
      if (chat && (!current || current.conversationId !== chat.conversationId)) throw new Error('The chat changed. Reopen it to place this order.')
      if (chat && !canShareOrder(current)) throw new Error('This conversation cannot receive orders.')

      const products = new Map((await marketProducts(tx)).map(product => [product.id, product]))
      const items = Object.entries(request.cart).map(([productId, quantity]) => {
        const product = products.get(productId)
        if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('A cart item is no longer available or has an invalid quantity.')
        return { name: product.name, kind: product.kind, cents: product.cents, quantity, seller: product.seller, image: product.image }
      })
      if (!items.length) throw new Error('Add at least one item to your cart.')
      const pricing = orderPricing(items)
      if (!Number.isSafeInteger(pricing.total)) throw new Error('The order total is too large.')
      if (pricing.total !== request.expectedTotal) throw new Error('A price changed. Review your cart and try again.')
      const transfers = await tx.bankTransfers.toArray() as Transfer[]
      if (balanceFor('user', transfers) < pricing.total) throw new Error('Insufficient Bank balance. Remove items and try again.')
      const timestamp = Date.now()
      const order: MarketOrder = { id, timestamp, items, ...pricing, recipient: request.recipient.trim().slice(0, 80) || 'You',
        chatId: chat?.id, chatName: current?.name, note: request.note.trim().slice(0, 240),
        gift: current ? { text: '', style: 'Blue', auto: request.sendGiftOnDelivery !== false } : undefined }
      const charge: Transfer = { id: 'order:' + id, orderId: id, from: 'user', to: marketMerchant, cents: order.total,
        note: items.map(item => item.quantity + ' × ' + item.name).join(', '), timestamp }

      await tx.marketOrders.add(order)
      await tx.bankTransfers.add(charge)
      return { order, charge }
    })
  if (result.charge) window.dispatchEvent(new CustomEvent(transferEvent, { detail: result.charge }))
  return result.order
}

export const marketGiftEvent = 'eephone:market-gift'

export async function saveMarketGift(database: LocalDatabase, id: string, action: 'save' | 'send' | 'deliver',
  draft?: GiftDraft, now = Date.now()) {
  return database.transaction('rw', database.marketOrders, database.chats, async tx => {
    const order = await tx.marketOrders.get(id) as MarketOrder | undefined
    if (!order?.chatId || order.gift?.sentAt) return
    const gift = draft ? { text: draft.text.trim().slice(0, 240), style: giftStyles.includes(draft.style) ? draft.style : 'Blue' as const,
      auto: draft.auto === true } : order.gift
    if (!gift || (action === 'deliver' && (!gift.auto || deliveryStatus(order, now) !== 'Delivered'))) return
    const chat = await tx.chats.get(order.chatId) as ChatContact | undefined
    if (!canShareOrder(chat)) return
    if (action === 'save') {
      await tx.marketOrders.update(id, { gift })
      return { order: { ...order, gift } }
    }
    const delivered = deliveryStatus(order, now) === 'Delivered'
    const items = order.items.map(item => item.quantity + ' × ' + item.name).join(', ')
    const content = (delivered ? 'A gift I ordered for you has arrived: ' : 'I bought you a gift: ') + items + '.'
    const history = Array.isArray(chat.history) ? chat.history : []
    const card: ChatMessage = { role: 'user', type: 'market_gift', orderId: id, giftStyle: gift.style, giftNote: gift.text,
      content: gift.text ? content + '\n' + gift.text : content,
      timestamp: Math.max(now, (history.at(-1)?.timestamp ?? 0) + 1) }
    const updated = [...history, card]
    const sentGift = { ...gift, sentAt: card.timestamp }
    await tx.chats.update(chat.id, { history: updated })
    await tx.marketOrders.update(id, { gift: sentGift })
    return { order: { ...order, gift: sentGift }, history: updated }
  })
}
