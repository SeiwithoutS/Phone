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
export const bankBalanceEvent = 'eephone:bank-balance'
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

export function bankOpeningBalance(account?: StoredRow) {
  const balance = account?.openingBalance
  return typeof balance === 'number' && Number.isSafeInteger(balance) && balance >= 0 ? balance : startingBalance
}

export async function setBankOpeningBalance(db: LocalDatabase, actor: string, cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error('Enter a non-negative amount with at most two decimal places.')
  }
  await db.bankAccounts.put({ id: actor, openingBalance: cents })
  window.dispatchEvent(new Event(bankBalanceEvent))
}

export function balanceFor(actor: string, transfers: Transfer[], openingBalance: number) {
  return transfers.reduce((total, entry) =>
    total + (entry.to === actor ? entry.cents : 0) - (entry.from === actor ? entry.cents : 0), openingBalance)
}

export class TransferError extends Error {}

export async function postTransfer(db: LocalDatabase, transfer: Transfer, chat: ChatContact, message: ChatMessage) {
  if (!Number.isSafeInteger(transfer.cents) || transfer.cents <= 0 || transfer.from === transfer.to) {
    throw new TransferError('Enter a positive amount with at most two decimal places.')
  }
  const { id: chatId, conversationId } = chat
  const applied = await db.transaction('rw', db.bankAccounts, db.bankTransfers, db.chats, async tx => {
    if (await tx.bankTransfers.get(transfer.id)) return 'duplicate'
    const current = await tx.chats.get(chatId)
    if (!current || current.conversationId !== conversationId) return 'stale'
    if (message.role === 'assistant' && transfer.from !== 'user') {
      const sender = transfer.from === chatId ? current : await tx.chats.get(transfer.from)
      if (!sender || (sender as ChatContact).settings?.allowBankTransfers === false) return 'disabled'
    }
    const entries = await tx.bankTransfers.toArray() as Transfer[]
    const account = await tx.bankAccounts.get(transfer.from)
    if (balanceFor(transfer.from, entries, bankOpeningBalance(account)) < transfer.cents) return 'insufficient'
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
  const match = String(amount ?? '').trim().match(/^(\d+)(?:\.(\d{1,2}))?$|^\.(\d{1,2})$/)
  if (!match) return NaN
  const [, whole, fraction, fractionOnly] = match
  return Number((whole ?? '0') + (fraction ?? fractionOnly ?? '').padEnd(2, '0'))
}
