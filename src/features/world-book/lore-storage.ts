import { runtime } from '../../legacy/runtime/state.js'
import type { ChatMessage } from '../chat/model'
import { activeLore } from './lore'
import type { LoreBook } from './lore'

export function getLoreBooks() {
  return runtime.state.lorebooks || []
}

export function loreContext(
  chat: { settings: { linkedLoreBookIds?: string[] }; history: ChatMessage[] },
  extraMessages: ChatMessage[] = [],
) {
  const lore = activeLore(getLoreBooks(), chat.settings.linkedLoreBookIds || [], [...chat.history, ...extraMessages])
  return lore ? '\n# World Info\n' + lore + '\n' : ''
}

export async function saveLoreBook(book: LoreBook, selectedIds: string[], remove = false) {
  const links = new Map<string, string[]>()
  await runtime.db.transaction('rw', runtime.db.lorebooks, runtime.db.chats, async tx => {
    if (remove) await tx.lorebooks.delete(book.id)
    else await tx.lorebooks.put(book)
    for (const chat of Object.values(runtime.state.chats)) {
      if (!chat) continue
      const stored = await tx.chats.get(chat.id)
      if (!stored) continue
      const settings = stored.settings as typeof chat.settings | undefined
      const current = settings?.linkedLoreBookIds ?? []
      const linked = !remove && selectedIds.includes(chat.id)
      if (linked === current.includes(book.id)) continue
      const linkedLoreBookIds = current.filter(id => id !== book.id)
      if (linked) linkedLoreBookIds.push(book.id)
      await tx.chats.update(chat.id, { settings: { ...settings, linkedLoreBookIds } })
      links.set(chat.id, linkedLoreBookIds)
    }
  })
  runtime.state.lorebooks = await runtime.db.lorebooks.toArray() as LoreBook[]
  for (const [id, linkedLoreBookIds] of links) {
    const chat = runtime.state.chats[id]
    if (chat) chat.settings.linkedLoreBookIds = linkedLoreBookIds
  }
}
