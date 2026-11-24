import { balanceFor, bankOpeningBalance, marketMerchant, transferCents, transferEvent } from '../bank/bank'
import { imageSource } from '../../runtime/files'
import type { Transfer } from '../bank/bank'
import type { ChatContact, ChatMessage } from '../chat/model'
import type { LocalDatabase } from '../../storage/database'
import type { StoredRow } from '../../../shared/storage'

export type MarketKind = 'food' | 'goods'
type OrderLine = { name: string; kind: MarketKind; cents: number; quantity: number; seller?: string; image?: string; description?: string }
export const giftStyles = ['Blue', 'Blush', 'Mint'] as const
export type GiftDraft = { text: string; style: typeof giftStyles[number]; auto: boolean }
type GiftCard = GiftDraft & { sentAt?: number }
type MarketListing = Omit<OrderLine, 'quantity'> & { seller: string }
export type MarketProduct = MarketListing & { id: string }
export type MarketOrder = StoredRow & {
  id: string; timestamp: number; items: OrderLine[]; subtotal: number; delivery: number; total: number;
  recipient: string; chatId?: string; chatName?: string; buyerId?: string; note: string; gift?: GiftCard
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
  const cents = productCents(item.price)
  const image = imageSource(item.image)
  if (!name) throw new Error('Enter a product name.')
  if (cents === undefined) throw new Error('Enter a price between 0.01 and 100,000 with up to two decimal places.')
  if (item.image.trim() && !image) throw new Error('Choose a supported image or enter an HTTPS/HTTP image URL.')
  if (item.kind !== 'food' && item.kind !== 'goods') throw new Error('Choose a product category.')
  await database.shoppingProducts.add(productRow({ name, cents, image, kind: item.kind,
    seller: item.seller.trim().slice(0, 80), description: item.description.trim().slice(0, 500) }))
}

function productCents(price: unknown) {
  if (typeof price !== 'number' && typeof price !== 'string') return
  const cents = transferCents(typeof price === 'string' ? price.trim() : price)
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 10_000_000 ? cents : undefined
}

function productRow(product: MarketListing) {
  return { name: product.name, price: product.cents / 100, seller: product.seller, description: product.description ?? '',
    marketKind: product.kind, imageUrl: product.image ?? '', categoryId: null, variations: [] }
}

function readProposedProduct(value: unknown): MarketListing | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const item = value as Record<string, unknown>
  const name = typeof item.name === 'string' ? item.name.trim() : ''
  const description = typeof item.description === 'string' ? item.description.trim() : ''
  const seller = typeof item.seller === 'string' ? item.seller.trim() : ''
  const cents = productCents(item.price)
  if (!name || !description || name.length > 100 || description.length > 500 ||
    seller.length > 80 || cents === undefined || (item.kind !== 'food' && item.kind !== 'goods')) return
  return { name, description, cents, seller, kind: item.kind }
}

const productKey = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
const validQuantity = (quantity: number) => Number.isInteger(quantity) && quantity >= 1 && quantity <= 20

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

type OrderRequest = { id: string; cart: Record<string, number>; recipient: string; note: string } & (
  { expectedTotal: number; chat?: ChatContact; sendGiftOnDelivery?: boolean; buyer?: undefined; newItem?: undefined } |
  { buyer: ChatContact; expectedTotal?: undefined; chat?: undefined; sendGiftOnDelivery?: undefined;
    newItem?: { product: unknown; quantity: number } }
)

export class MarketOrderError extends Error {}

export async function placeOrder(database: LocalDatabase, request: OrderRequest) {
  const { id, chat } = request
  const payer = request.buyer?.id ?? 'user'
  const result = await database.transaction('rw', database.marketOrders, database.bankAccounts, database.bankTransfers, database.chats,
    database.shoppingProducts, database.shoppingCategories, async tx => {
      const saved = await tx.marketOrders.get(id) as MarketOrder | undefined
      if (saved) return { order: saved }
      const contact = chat ?? request.buyer
      const current = contact ? await tx.chats.get(contact.id) as ChatContact | undefined : undefined
      if (request.buyer && (!current || current.conversationId !== request.buyer.conversationId ||
        current.isGroup || current.settings?.isOfflineMode || current.settings?.allowStorePurchases !== true || !canShareOrder(current))) {
        return { error: 'Shopping is unavailable for this character.' }
      }
      if (chat && (!current || current.conversationId !== chat.conversationId)) return { error: 'The chat changed. Reopen it to place this order.' }
      if (chat && !canShareOrder(current)) return { error: 'This conversation cannot receive orders.' }

      const products = new Map((await marketProducts(tx)).map(product => [product.id, product]))
      const items: OrderLine[] = []
      let newProduct: MarketListing | undefined
      for (const [productId, quantity] of Object.entries(request.cart)) {
        const product = products.get(productId)
        if (!product || !validQuantity(quantity)) {
          return { error: 'A cart item is no longer available or has an invalid quantity.' }
        }
        const { name, kind, cents, seller, image, description } = product
        items.push({ name, kind, cents, quantity, seller, image, description })
      }
      if (request.newItem) {
        const { product, quantity } = request.newItem
        const proposed = readProposedProduct(product)
        if (items.length || !proposed || !validQuantity(quantity)) {
          return { error: 'The new product needs a valid name, unit price, category, description, and quantity.' }
        }
        const matched = [...products.values()].find(item => item.kind === proposed.kind &&
          productKey(item.name) === productKey(proposed.name) &&
          (!proposed.seller || productKey(item.seller) === productKey(proposed.seller)))
        const listing = matched ?? { ...proposed, seller: proposed.seller || 'Local Shop' }
        if (!matched) newProduct = listing
        const { name, kind, cents, seller, image, description } = listing
        items.push({ name, kind, cents, quantity, seller, image, description })
      }
      if (!items.length) return { error: 'Add at least one item to your cart.' }
      const pricing = orderPricing(items)
      if (!Number.isSafeInteger(pricing.total)) return { error: 'The order total is too large.' }
      if (!request.buyer && pricing.total !== request.expectedTotal) return { error: 'A price changed. Review your cart and try again.' }
      const transfers = await tx.bankTransfers.toArray() as Transfer[]
      const account = await tx.bankAccounts.get(payer)
      if (balanceFor(payer, transfers, bankOpeningBalance(account)) < pricing.total) return { error: 'Insufficient Bank balance.' }
      const timestamp = Date.now()
      const order: MarketOrder = { id, timestamp, items, ...pricing, recipient: request.recipient.trim().slice(0, 80) || 'You',
        chatId: chat?.id, chatName: chat ? current?.name : undefined, note: request.note.trim().slice(0, 240),
        buyerId: request.buyer?.id, gift: chat ? { text: '', style: 'Blue', auto: request.sendGiftOnDelivery !== false } : undefined }
      const charge: Transfer = { id: 'order:' + id, orderId: id, from: payer, to: marketMerchant, cents: order.total,
        note: items.map(item => item.quantity + ' × ' + item.name).join(', '), timestamp }

      if (newProduct) await tx.shoppingProducts.add(productRow(newProduct))
      await tx.marketOrders.add(order)
      await tx.bankTransfers.add(charge)
      return { order, charge }
    })
  if (result.error !== undefined) throw new MarketOrderError(result.error)
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
