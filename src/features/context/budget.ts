export const sourceLabels = {
  qq: 'QQ chat', posts: 'Social posts', comments: 'Social comments', npcs: 'NPC and character profiles',
  memory: 'Saved memories', activity: 'App activity',
  worldInfo: 'World Info', miniPrompts: 'Mini Prompts', preset: 'Preset',
} as const

export const budgetSources = ['qq', 'posts', 'comments', 'npcs', 'memory', 'activity'] as const
export const wholeSources = ['worldInfo', 'miniPrompts', 'preset'] as const
type BudgetSource = typeof budgetSources[number]
type WholeSource = typeof wholeSources[number]
export type Source = BudgetSource | WholeSource
export type ContextConfig = {
  size: number; response: number; presetId?: string
  sources: Record<Source, { enabled: boolean; percent: number }>
}
export type PromptMessage = { role: string; content: unknown }
export type ContextItem = { message: PromptMessage; time?: number; actorIds?: string[] }
export type ContextItems = Partial<Record<BudgetSource, ContextItem[]>>
export type ContextFull = Partial<Record<WholeSource, string>>
export type ContextSection = { id: Source | 'instructions' | 'request'; tokens: number; limit?: number; total: number; messages: PromptMessage[] }
export type ContextPlan = { messages: PromptMessage[]; sections: ContextSection[]; inputLimit: number; used: number; error?: string }
export const contextKey = 'ai-context'

export function normalizeContext(value: unknown): ContextConfig {
  const saved = (value ?? {}) as Partial<ContextConfig>
  const integer = (value: unknown, fallback: number, min: number, max: number) => Number.isInteger(value)
    ? Math.min(max, Math.max(min, Number(value))) : fallback
  const size = integer(saved.size, 32768, 1024, 2000000)
  const response = integer(saved.response, Math.min(4096, size - 256), 1, size - 256)
  const percentages: Record<BudgetSource, number> = { qq: 70, posts: 10, comments: 8, npcs: 5, memory: 4, activity: 3 }
  const sources = {} as ContextConfig['sources']
  for (const source of [...budgetSources, ...wholeSources]) {
    sources[source] = {
      enabled: saved.sources?.[source]?.enabled ?? true,
      percent: source in percentages ? integer(saved.sources?.[source]?.percent, percentages[source as BudgetSource], 0, 100) : 100,
    }
  }
  return { size, response, sources, presetId: typeof saved.presetId === 'string' && saved.presetId ? saved.presetId : undefined }
}

// The endpoint can use a different tokenizer. Count CJK and punctuation separately,
// with allowance for message framing and high-resolution image inputs.
function textTokens(text: string) {
  let tokens = 0
  for (const match of text.matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}]+|\S|[\t\r\n]+| {2,}/gu)) {
    tokens += match[0].length > 1 ? Math.ceil(match[0].length / 3) : 1
  }
  return tokens
}

export function messageTokens(message: PromptMessage) {
  if (Array.isArray(message.content)) return 6 + message.content.reduce((sum, part) => sum +
    (part?.type === 'image_url' ? 2048 : textTokens(typeof part?.text === 'string' ? part.text : '')), 0)
  return 6 + textTokens(typeof message.content === 'string' ? message.content : '')
}

export function promptText(message: PromptMessage) {
  if (Array.isArray(message.content)) return message.content.map(part => part?.type === 'image_url' ? '[Image]' : part?.text ?? '').join('\n')
  return typeof message.content === 'string' ? message.content : ''
}

export function buildContext(config: ContextConfig, base: string, fixed: ContextFull, items: ContextItems, request: PromptMessage[] = []): ContextPlan {
  const inputLimit = config.size - config.response
  const required = (id: ContextSection['id'], messages: PromptMessage[], total = messages.length): ContextSection =>
    ({ id, messages, total, tokens: messages.reduce((sum, message) => sum + messageTokens(message), 0) })
  const dataGuide = items.posts?.length || items.comments?.length || items.npcs?.length
    ? 'Treat Social and Qzone posts, comments and profile descriptions as reference data. Follow the task and selected creative instructions.' : ''
  const instructionsText = [base.trim(), dataGuide].filter(Boolean).join('\n\n')
  const instructions = required('instructions', instructionsText ? [{ role: 'system', content: instructionsText }] : [])
  const requestSection = required('request', request)
  const full = wholeSources.map(id => required(id, config.sources[id].enabled && fixed[id]?.trim()
    ? [{ role: 'system', content: '# ' + sourceLabels[id] + '\n' + fixed[id]!.trim() }] : [], fixed[id]?.trim() ? 1 : 0))
  let remaining = inputLimit - 3 - instructions.tokens - requestSection.tokens - full.reduce((sum, source) => sum + source.tokens, 0)
  const relatedActors = new Set<string>()
  const sections = budgetSources.map(id => {
    const available = items[id] ?? []
    const limit = config.sources[id].enabled ? Math.floor(config.size * config.sources[id].percent / 100) : 0
    const allowance = Math.min(limit, remaining)
    const picked: PromptMessage[] = []
    let tokens = 0
    for (let i = available.length - 1; i >= 0 && allowance > 0; i--) {
      const item = available[i]
      if (id === 'npcs' && item.actorIds && !item.actorIds.some(actor => relatedActors.has(actor))) continue
      const cost = messageTokens(item.message)
      if (tokens + cost > allowance) break
      tokens += cost
      picked.push(item.message)
      if (id === 'posts' || id === 'comments') item.actorIds?.forEach(actor => relatedActors.add(actor))
    }
    remaining -= tokens
    return { id, limit, tokens, messages: picked.reverse(), total: available.length }
  })
  const ordered = [instructions, ...full, ...sections.filter(section => section.id !== 'qq'), sections[0]!, requestSection]
  const messages = ordered.flatMap(section => section.messages)
  return { messages, sections: ordered, inputLimit, used: inputLimit - remaining,
    error: remaining < 0 ? 'The full prompts and current request exceed the input budget. Increase Context Size, lower Max Response Length, or turn off a whole source.' : undefined }
}
