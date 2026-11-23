import type { Key, StoredRow } from '../../../shared/storage'

export type LoreEntry = {
  id: string
  comment: string
  keys: string[]
  secondaryKeys: string[]
  content: string
  enabled: boolean
  constant: boolean
  caseSensitive: boolean
  wholeWords: boolean
  selectiveLogic: number
  order: number
}

export type LoreBook = StoredRow & {
  id: string
  name: string
  sourceCharacterId?: string
  scanDepth: number
  content: LoreEntry[]
}

export const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export const string = (value: unknown) => typeof value === 'string' ? value : ''
export const keywords = (value: unknown) =>
  (typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value.map(string) : []).map(key => key.trim()).filter(Boolean)

export function makeLoreEntry(raw: unknown = {}, index = 0): LoreEntry {
  const item = record(raw)
  const extensions = record(item.extensions)
  return {
    id: crypto.randomUUID(),
    comment: string(item.comment || item.name),
    keys: keywords(item.keys ?? item.key),
    secondaryKeys: item.selective === false ? [] : keywords(item.secondary_keys ?? item.keysecondary ?? item.secondaryKeys),
    content: string(item.content),
    enabled: item.enabled !== false && item.disable !== true,
    constant: item.constant === true,
    caseSensitive: (item.case_sensitive ?? item.caseSensitive ?? extensions.case_sensitive) === true,
    wholeWords: (item.matchWholeWords ?? item.wholeWords ?? extensions.match_whole_words) === true,
    selectiveLogic: Number(item.selectiveLogic ?? extensions.selectiveLogic ?? 0) || 0,
    order: Number(item.insertion_order ?? item.order ?? index) || 0,
  }
}

export function readLoreBook(raw: unknown, fallbackName: string): LoreBook | undefined {
  const book = record(raw)
  const entries = Array.isArray(book.entries) ? book.entries : Object.values(record(book.entries))
  if (!entries.length && !('entries' in book)) return
  const depth = Number(book.scan_depth ?? book.scanDepth)
  return {
    id: crypto.randomUUID(),
    name: string(book.name).trim() || fallbackName,
    scanDepth: Number.isFinite(depth) ? Math.min(100, Math.max(1, Math.trunc(depth))) : 5,
    content: entries.map(makeLoreEntry).filter(entry => entry.content.trim()),
  }
}

type LoreMessage = { content?: unknown; role?: string; isHidden?: boolean }

export function activeLore(books: LoreBook[], ids: Key[], messages: LoreMessage[]) {
  const recent = messages.filter(message => !message.isHidden && message.role !== 'system')
  return books.filter(book => ids.includes(book.id)).flatMap(book => {
    const context = recent.slice(-(book.scanDepth || 5)).flatMap(message =>
      Array.isArray(message.content) ? message.content.map(part => string(record(part).text)) : [string(message.content)]).join('\n')
    const active = book.content.filter(entry => entry.enabled && entry.content.trim() && (entry.constant || entryMatches(entry, context)))
      .sort((a, b) => a.order - b.order)
    return active.length ? ['## ' + book.name + '\n' + active.map(entry => entry.content).join('\n\n')] : []
  }).join('\n\n')
}

function entryMatches(entry: LoreEntry, context: string) {
  const text = entry.caseSensitive ? context : context.toLowerCase()
  const matches = (key: string) => {
    const needle = entry.caseSensitive ? key : key.toLowerCase()
    if (!entry.wholeWords) return text.includes(needle)
    const literal = needle.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')
    return new RegExp('(?:^|[^\\p{L}\\p{N}_])' + literal + '(?=$|[^\\p{L}\\p{N}_])', 'u').test(text)
  }
  if (!entry.keys.some(matches)) return false
  const keys = entry.secondaryKeys
  if (!keys.length) return true
  if (entry.selectiveLogic === 1) return !keys.every(matches)
  if (entry.selectiveLogic === 2) return !keys.some(matches)
  if (entry.selectiveLogic === 3) return keys.every(matches)
  return keys.some(matches)
}
