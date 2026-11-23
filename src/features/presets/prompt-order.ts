import { keywords, record, string } from '../world-book/lore.js'

export const promptSlots = {
  worldInfo: 'World Info',
  miniPrompts: 'Mini Prompts',
  qq: 'Chat history',
} as const
export type PromptSlot = keyof typeof promptSlots
export type PromptEntry = {
  comment: string; keys: string[]; content: string; enabled: boolean
  role?: 'system' | 'user' | 'assistant'; slot?: PromptSlot; identifier?: string
}

export const defaultPromptEntries: PromptEntry[] = [
  { comment: 'Main prompt', keys: [], content: '', enabled: true },
  { comment: 'World Info', keys: [], content: '', enabled: true, slot: 'worldInfo' },
  { comment: 'Mini Prompts', keys: [], content: '', enabled: true, slot: 'miniPrompts' },
  { comment: 'Chat history', keys: [], content: '', enabled: true, slot: 'qq' },
  { comment: 'Post-history instructions', keys: [], content: '', enabled: true },
]

export function promptSlot(value: unknown): PromptSlot | undefined {
  return value === 'worldInfo' || value === 'miniPrompts' || value === 'qq' ? value : undefined
}

export function promptRole(value: unknown) {
  return value === 'assistant' || value === 'user' ? value : 'system' as const
}

export function readTavernPreset(raw: unknown): PromptEntry[] {
  const wrapper = record(raw)
  const preset = Array.isArray(record(wrapper.data).prompts) ? record(wrapper.data) : wrapper
  if (!Array.isArray(preset.prompts)) {
    const entries = record(preset.entries)
    const keys = Array.isArray(preset.order) ? preset.order.map(String) : Object.keys(entries)
    return keys.flatMap(key => {
      const entry = record(entries[key])
      const content = string(entry.content)
      return content.trim() ? [{ comment: string(entry.comment), keys: keywords(entry.key), content, enabled: entry.disable !== true }] : []
    })
  }
  const prompts = preset.prompts.map(record)
  const byId = new Map(prompts.map(prompt => [string(prompt.identifier), prompt]))
  const orderList = Array.isArray(preset.prompt_order) ? preset.prompt_order.map(record) : []
  const orders = orderList.filter(order => Array.isArray(order.order) && order.order.length)
  const global = orders.find(order => String(order.character_id) === '100001')
  const longest = orders.reduce<Record<string, unknown> | undefined>((best, order) =>
    !best || (order.order as unknown[]).length > (best.order as unknown[]).length ? order : best, undefined)
  const selected = global ?? longest
  const items = selected ? (selected.order as unknown[]).map(record) : orderList.some(item => item.identifier) ? orderList : prompts
  return items.flatMap(item => {
    const identifier = string(item.identifier)
    const prompt = byId.get(identifier) ?? item
    const slot = identifier === 'chatHistory' ? 'qq' :
      identifier === 'worldInfoBefore' || identifier === 'worldInfoAfter' ? 'worldInfo' : undefined
    const content = string(prompt.content)
    const comment = string(prompt.name) || (slot ? promptSlots[slot] : identifier)
    return slot || content.trim() ? [{
      comment, content, keys: [], enabled: item.enabled !== false, identifier, slot, role: promptRole(prompt.role),
    }] : []
  })
}

export type PromptStep = { slot: PromptSlot; enabled: boolean } | { message: { role: string; content: string } }

export function promptSteps(entries: unknown): PromptStep[] {
  return (Array.isArray(entries) ? entries : []).flatMap<PromptStep>(raw => {
    const entry = record(raw)
    const slot = promptSlot(entry.slot)
    if (slot) return [{ slot, enabled: entry.enabled !== false }]
    const content = string(entry.content).trim()
    return entry.enabled !== false && content ? [{ message: { role: promptRole(entry.role), content } }] : []
  })
}
