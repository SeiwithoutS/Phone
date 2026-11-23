import { runtime } from '../../legacy/runtime/state.js'
import { fileDataUrl, imageSource } from '../../runtime/files'
import type { StoredRow } from '../../../shared/storage'
import type { ChatContact } from '../chat/model'
import type { LocalDatabase } from '../../storage/database'

export type StickerCategoryId = string | number
export type Sticker = StoredRow & {
  id: string; name: string; url: string; categoryId?: StickerCategoryId | null; chatIds?: string[]
}
export type StickerCategory = StoredRow & { id: StickerCategoryId; name: string }
type StickerInput = Pick<Sticker, 'name' | 'url'>

export function categoryKey(categoryId?: StickerCategoryId | null) {
  return categoryId ? String(categoryId) : 'uncategorized'
}

export function assignedStickers(stickers: Sticker[], chat?: ChatContact) {
  if (!chat) return []
  const categoryIds = chat.settings?.stickerCategoryIds ?? []
  const categories = new Set(categoryIds.map(categoryKey))
  return stickers.filter(sticker => sticker.chatIds?.includes(chat.id) || categories.has(categoryKey(sticker.categoryId)))
}

export function parseStickerLinks(text: string) {
  const stickers: StickerInput[] = []
  let skipped = 0
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim()
    if (!value) continue
    const link = value.match(/^(.+?)[:：]\s*(https?:\/\/.+)$/i)
    const shorthand = !link && (value.match(/^(.+?)\s+([\w.-]+\.[\w]+)$/) ?? value.match(/^([\u4e00-\u9fff]+)([\w.-]+\.[\w]+)$/))
    const name = (link?.[1] || (shorthand && shorthand[1]) || '').trim()
    const url = imageSource(link?.[2] || (shorthand ? 'https://files.catbox.moe/' + shorthand[2] : ''))
    if (name && url) stickers.push({ name, url })
    else skipped++
  }
  return { stickers, skipped }
}

export async function readStickerFile(file: File): Promise<StickerInput> {
  const url = imageSource(await fileDataUrl(file))
  if (!url) throw new Error('Unsupported image: ' + file.name)
  return { name: file.name.replace(/\.[^.]+$/, '') || file.name, url }
}

export async function loadStickers(database: LocalDatabase) {
  const stickers = await database.userStickers.toArray() as Sticker[]
  runtime.state.userStickers = stickers
  return stickers
}

export async function importStickers(database: LocalDatabase, stickers: StickerInput[], categoryId: StickerCategoryId | null) {
  if (!stickers.length) return
  await database.userStickers.bulkAdd(stickers.map(sticker => ({ ...sticker, id: 'sticker_' + crypto.randomUUID(), categoryId })))
}

export async function createStickerCategory(database: LocalDatabase, name: string) {
  return database.transaction('rw', database.stickerCategories, async tx => {
    if (await tx.stickerCategories.where('name').equalsIgnoreCase(name).first()) {
      throw new Error('A category with this name already exists.')
    }
    return await tx.stickerCategories.add({ name }) as StickerCategoryId
  })
}

type ChatTable = LocalDatabase['chats']

async function setCategoryLinks(table: ChatTable, id: StickerCategoryId, selected: string[]) {
  const changes: Array<[string, StickerCategoryId[]]> = []
  const wanted = new Set(selected)
  for (const chat of await table.toArray() as ChatContact[]) {
    const current = chat.settings?.stickerCategoryIds ?? []
    const bound = current.some(value => categoryKey(value) === categoryKey(id))
    if (bound === wanted.has(chat.id)) continue
    const next = bound ? current.filter(value => categoryKey(value) !== categoryKey(id)) : [...current, id]
    await table.update(chat.id, { settings: { ...chat.settings, stickerCategoryIds: next } })
    changes.push([chat.id, next])
  }
  return changes
}

function updateRuntimeLinks(changes: Array<[string, StickerCategoryId[]]>) {
  for (const [chatId, categories] of changes) {
    const chat = runtime.state.chats[chatId]
    if (chat) chat.settings.stickerCategoryIds = categories
  }
}

export async function saveStickerCategory(database: LocalDatabase, id: StickerCategoryId, selected: string[], name?: string) {
  const applied = await database.transaction('rw', database.chats, database.stickerCategories, async tx => {
    if (id !== 'uncategorized') {
      const category = await tx.stickerCategories.get(id)
      if (!category) throw new Error('This category is no longer available.')
      if (name && name !== category.name) {
        const existing = await tx.stickerCategories.where('name').equalsIgnoreCase(name).first()
        if (existing && existing.id !== id) throw new Error('A category with this name already exists.')
        await tx.stickerCategories.update(id, { name })
      }
    }
    return setCategoryLinks(tx.chats, id, selected)
  })
  updateRuntimeLinks(applied)
}

export async function deleteStickerCategory(database: LocalDatabase, id: StickerCategoryId) {
  const applied = await database.transaction('rw', database.stickerCategories, database.userStickers, database.chats, async tx => {
    await tx.userStickers.toCollection().filter(row => categoryKey(row.categoryId as StickerCategoryId) === categoryKey(id))
      .modify({ categoryId: null })
    await tx.stickerCategories.delete(id)
    return setCategoryLinks(tx.chats, id, [])
  })
  updateRuntimeLinks(applied)
}
