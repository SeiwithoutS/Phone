import { logActivity } from '../../runtime/activity-log'
import type { LocalDatabase } from '../../storage/database'
import type { StoredRow } from '../../../shared/storage'
import type { ChatContact, ChatMessage } from '../chat/model'

export const startingBalance = 100_000
export const marketMerchant = 'merchant:marketplace'
export type Transfer = StoredRow & {
  id: string; from: string; to: string; cents: number; note: string; timestamp: number
  orderId?: string
}
export const transferEvent = 'eephone:bank-transfer'
export const bankCurrencies = ['VND', 'USD', 'CNY', 'EUR', 'JPY', 'KRW', 'GBP', 'THB'] as const
export type BankCurrency = typeof bankCurrencies[number]
const currencyKey = 'bank-currency'
export const currencyEvent = 'eephone:bank-currency'

export function bankCurrency(database?: LocalDatabase): BankCurrency {
  const stored = database?.getPreference(currencyKey)
  return bankCurrencies.find(code => code === stored) ?? 'VND'
}

export async function setBankCurrency(database: LocalDatabase, currency: BankCurrency) {
  if (!bankCurrencies.includes(currency)) return
  await database.deviceSettings.put({ id: currencyKey, value: currency })
  window.dispatchEvent(new Event(currencyEvent))
}

const amountFormats = new Map<string, Intl.NumberFormat>()
export function bankAmount(cents: number, currency: BankCurrency = 'VND') {
  const digits = ['VND', 'JPY', 'KRW'].includes(currency) && cents % 100 === 0 ? 0 : 2
  const key = currency + digits
  let format = amountFormats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits })
    amountFormats.set(key, format)
  }
  return format.format(cents / 100)
}

export function balanceFor(actor: string, transfers: Transfer[]) {
  return transfers.reduce((total, entry) =>
    total + (entry.to === actor ? entry.cents : 0) - (entry.from === actor ? entry.cents : 0), startingBalance)
}

export class TransferError extends Error {}

export async function postTransfer(db: LocalDatabase, transfer: Transfer, chat: ChatContact, message: ChatMessage) {
  if (!Number.isSafeInteger(transfer.cents) || transfer.cents <= 0 || transfer.from === transfer.to) {
    throw new TransferError('Enter a positive amount with at most two decimal places.')
  }
  const { id: chatId, conversationId } = chat
  const applied = await db.transaction('rw', db.bankTransfers, db.chats, async tx => {
    if (await tx.bankTransfers.get(transfer.id)) return 'duplicate'
    const current = await tx.chats.get(chatId)
    if (!current || current.conversationId !== conversationId) return 'stale'
    const entries = await tx.bankTransfers.toArray() as Transfer[]
    if (balanceFor(transfer.from, entries) < transfer.cents) return 'insufficient'
    await tx.bankTransfers.add(transfer)
    await tx.chats.update(chatId, { history: [...(Array.isArray(current.history) ? current.history : []), message] })
    return 'applied'
  })
  if (applied === 'stale') throw new TransferError('This conversation changed. Open it again to transfer money.')
  if (applied === 'insufficient') throw new TransferError('Insufficient balance.')
  if (applied === 'applied') {
    logActivity('bank.transfer', 'ok')
    window.dispatchEvent(new CustomEvent<Transfer>(transferEvent, { detail: transfer }))
  }
  return applied === 'applied'
}

export function transferCents(amount: unknown) {
  const text = String(amount ?? '').trim()
  return /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text) ? Math.round(Number(text) * 100) : NaN
}
