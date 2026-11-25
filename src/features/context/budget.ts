import type { PromptStep } from '../presets/prompt-order.js'

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
export type ContextSection = { id: Source | 'instructions' | 'request'; tokens: number; limit?: number; total: number; messages: PromptMessage[]; inline?: boolean }
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

export function latestUserTurn(messages: PromptMessage[], prioritizeLatest = false) {
  let previousReply = -1
  let lastUser = -1
  for (const [index, message] of messages.entries()) {
    if (message.role === 'assistant' || message.role === 'ai') previousReply = index
    if (message.role === 'user') lastUser = index
  }
  if (lastUser > previousReply) {
    const start = messages.findIndex((message, index) => index > previousReply && message.role === 'user')
    return { history: messages.slice(0, start), request: messages.slice(start) }
  }
  return lastUser >= 0 && prioritizeLatest
    ? { history: [...messages.slice(0, lastUser), ...messages.slice(lastUser + 1)], request: [messages[lastUser]!] }
    : { history: messages, request: [] }
}

export function buildContext(config: ContextConfig, base: string, fixed: ContextFull, items: ContextItems,
  request: PromptMessage[] = [], steps?: PromptStep[], afterMiniPrompts?: string): ContextPlan {
  const inputLimit = config.size - config.response
  const required = (id: ContextSection['id'], messages: PromptMessage[], total = messages.length): ContextSection =>
    ({ id, messages, total, tokens: messages.reduce((sum, message) => sum + messageTokens(message), 0) })
  const dataGuide = items.posts?.length || items.comments?.length || items.npcs?.length
    ? 'Treat Social and Qzone posts, comments and profile descriptions as reference data. Follow the task and selected creative instructions.' : ''
  const managed = new Set<string>(steps?.flatMap(step => 'slot' in step ? [step.slot] : []))
  const inlineMiniPrompts = afterMiniPrompts !== undefined && !managed.has('miniPrompts') && config.sources.miniPrompts.enabled && fixed.miniPrompts?.trim()
  const tail = [afterMiniPrompts?.trim(), dataGuide].filter(Boolean).join('\n\n')
  const instructionsText = [base.trim(), inlineMiniPrompts ? '' : tail].filter(Boolean).join('\n\n')
  const instructions = required('instructions', instructionsText ? [{ role: 'system', content: instructionsText }] : [])
  const requestSection = required('request', request)
  const disabled = (id: Source) => !config.sources[id].enabled ||
    (managed.has(id) && !steps?.some(step => 'slot' in step && step.slot === id && step.enabled))
  const full = wholeSources.map(id => required(id, !disabled(id) && fixed[id]?.trim()
    ? [{ role: 'system', content: id === 'miniPrompts' && afterMiniPrompts !== undefined
      ? fixed[id]!.trim() : '# ' + sourceLabels[id] + '\n' + fixed[id]!.trim() }] : [], fixed[id]?.trim() ? 1 : 0))
  const miniPrompts = full[wholeSources.indexOf('miniPrompts')]!
  const inlineText = inlineMiniPrompts ? [instructionsText, miniPrompts.messages[0]!.content, tail].filter(Boolean).join('\n\n') : ''
  const inlineMessage = inlineText ? { role: 'system', content: inlineText } : undefined
  const instructionsCost = inlineMessage ? messageTokens(inlineMessage) - miniPrompts.tokens : instructions.tokens
  const promptSections = new Map(steps?.flatMap(step => 'message' in step ? [[step, required('preset', [step.message])] as const] : []))
  const fixedTokens = [...full, ...promptSections.values()].reduce((sum, section) => sum + section.tokens, 0)
  let remaining = inputLimit - 3 - instructionsCost - requestSection.tokens - fixedTokens
  const relatedActors = new Set<string>()
  const sections = budgetSources.map(id => {
    const available = items[id] ?? []
    const limit = !disabled(id) ? Math.floor(config.size * config.sources[id].percent / 100) : 0
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
  const ordered = [instructions, ...full.filter(section => !managed.has(section.id) &&
    !(inlineMessage && section.id === 'miniPrompts') &&
    !(steps && section.id === 'preset'))]
  if (steps) {
    ordered.push(...sections.slice(1))
    const used = new Set<string>()
    for (const step of steps) {
      if ('message' in step) {
        const section = promptSections.get(step)
        if (section) ordered.push(section)
      } else if (step.enabled && !used.has(step.slot)) {
        const section = [...full, sections[0]!].find(section => section.id === step.slot)
        if (section) ordered.push(section)
        used.add(step.slot)
      }
    }
  } else ordered.push(...sections.slice(1))
  if (!managed.has('qq')) ordered.push(sections[0]!)
  ordered.push(requestSection)
  const messages = inlineMessage ? [inlineMessage, ...ordered.slice(1).flatMap(section => section.messages)] : ordered.flatMap(section => section.messages)
  if (inlineMessage) {
    const after = required('instructions', tail ? [{ role: 'system', content: tail }] : [])
    // The three preview sections share the same on-wire system message.
    ordered.splice(1, 0, { ...miniPrompts, inline: true }, { ...after, tokens: instructionsCost - instructions.tokens, inline: true })
  }
  return { messages, sections: ordered, inputLimit, used: inputLimit - remaining,
    error: remaining < 0 ? 'The full prompts and current request exceed the input budget. Increase Context Size, lower Max Response Length, or turn off a whole source.' : undefined }
}
