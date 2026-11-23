import { runtime } from '../../legacy/runtime/state.js'
import { renderChatList } from '../../legacy/chat/list.js'
import { rerenderConversation, withIdleConversation } from '../chat/sessions'
import { deliveryStatus, marketGiftEvent, saveMarketGift } from './market'
import type { GiftDraft, MarketOrder } from './market'
import type { LocalDatabase } from '../../storage/database'

export async function updateOrderGift(database: LocalDatabase, order: MarketOrder, action: 'save' | 'send' | 'deliver', draft?: GiftDraft) {
  if (!order.chatId) return
  const chatId = order.chatId
  return withIdleConversation(chatId, async () => {
    const result = await saveMarketGift(database, order.id, action, draft)
    if (!result) return
    const chat = runtime.state.chats[chatId]
    if (chat && result.history) {
      chat.history = result.history
      if (document.querySelector('#chat-interface-screen.active')) rerenderConversation(chat, true)
      void renderChatList()
    }
    window.dispatchEvent(new CustomEvent(marketGiftEvent, { detail: result.order }))
    return result.order
  })
}

export function startMarketDelivery(database: LocalDatabase) {
  let running = false
  let active = true
  async function check() {
    if (running) return
    running = true
    try {
      const orders = await database.marketOrders.toArray() as MarketOrder[]
      for (const order of orders) {
        if (!active) break
        if (order.chatId && order.gift?.auto && !order.gift.sentAt && deliveryStatus(order) === 'Delivered') {
          await updateOrderGift(database, order, 'deliver')
        }
      }
    } catch (error) {
      console.warn('Marketplace could not check gift deliveries.', error)
    } finally {
      running = false
    }
  }
  const refresh = () => { void check() }
  const timer = window.setInterval(refresh, 15_000)
  window.addEventListener('focus', refresh)
  refresh()
  return () => {
    active = false
    clearInterval(timer)
    window.removeEventListener('focus', refresh)
  }
}
