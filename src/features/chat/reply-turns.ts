import type { ChatMessage } from './model'

export const isReply = (message: ChatMessage) =>
  message.role === 'assistant' || message.role === 'ai'

const isVisible = (message: ChatMessage) => !message.isHidden && !message.isTemporary
export const isUserMessage = (message: ChatMessage) => message.role === 'user' && isVisible(message)
export const isVisibleReply = (message: ChatMessage) => isReply(message) && isVisible(message)

export function replyTurn(history: ChatMessage[], message: ChatMessage) {
  const index = history.indexOf(message)
  if (index < 0 || !isReply(message)) return
  if (message.replyTurnId) {
    return history.filter(item => item.replyTurnId === message.replyTurnId)
  }
  if (message.isOpening) return [message]

  // Older chats did not record request boundaries. Use the contiguous AI segment between user turns.
  const belongs = (item: ChatMessage) => !item.replyTurnId && !item.isOpening &&
    (isReply(item) || (item.role === 'system' && (item.isHidden || item.type === 'pat_message' || item.type === 'app_action_status')))
  let first = index
  let last = index + 1
  while (first > 0 && belongs(history[first - 1])) first--
  while (last < history.length && belongs(history[last])) last++
  // Keep hidden instructions immediately before/after an old reply outside the inferred turn.
  while (first < index && history[first].isHidden) first++
  while (last > index + 1 && history[last - 1].isHidden) last--
  return history.slice(first, last)
}

export function replyAnchor(history: ChatMessage[], turn: ChatMessage[]) {
  const first = turn[0]
  if (first.replyToUserTimestamp === null || turn.some(message => message.isOpening)) return
  return history.slice(0, history.indexOf(first)).findLast(message => isUserMessage(message) &&
    (first.replyToUserTimestamp === undefined || message.timestamp === first.replyToUserTimestamp))
}

export function replyForUser(history: ChatMessage[], user: ChatMessage) {
  const start = history.indexOf(user) + 1
  if (!start || !isUserMessage(user)) return
  if (user.timestamp != null) {
    const linked = history.findLast((message, index) => index >= start && isVisibleReply(message) &&
      message.replyToUserTimestamp === user.timestamp)
    if (linked) return linked
  }
  const nextUser = history.findIndex((message, index) => index >= start && isUserMessage(message))
  return history.slice(start, nextUser === -1 ? undefined : nextUser)
    .findLast(message => isVisibleReply(message) && !message.isOpening && message.replyToUserTimestamp === undefined)
}

export function withoutReplyVersions({ replyVersions, swipes, ...message }: ChatMessage): ChatMessage {
  return message
}

export function turnVersions(turn: ChatMessage[]): NonNullable<ChatMessage['replyVersions']> {
  if (turn[0].replyVersions) return turn[0].replyVersions
  // Lift previously saved per-message swipes into full versions of the original turn.
  const variants = turn.flatMap(message => message.swipes?.variants.flatMap((variant, index) =>
    index === message.swipes?.index ? [] : [turn.map(item => item === message
      ? { ...withoutReplyVersions(item), content: variant.text, plainText: variant.plainText }
      : withoutReplyVersions(item))]) ?? [])
  return { index: 0, variants: [null, ...variants] }
}

export function replyTimestamp(history: ChatMessage[]) {
  return history.reduce((next, message) => Math.max(next, (message.timestamp ?? 0) + 1), Date.now())
}

export function newReplyTurn(replyToUserTimestamp: number | null = null) {
  return { replyTurnId: crypto.randomUUID(), replyTurnTime: Date.now(), replyToUserTimestamp }
}

export function trimReplyTurns(history: ChatMessage[], kept: ChatMessage[]) {
  const keptMessages = new Set(kept)
  const cutTurns = new Set(history.filter(message => !keptMessages.has(message)).map(message => message.replyTurnId).filter(Boolean))
  const cutLegacyTurns = new Set<ChatMessage>()
  for (const message of history) {
    if (!message.replyTurnId && !keptMessages.has(message) && !cutLegacyTurns.has(message) && isReply(message)) {
      for (const item of replyTurn(history, message) ?? []) cutLegacyTurns.add(item)
    }
  }
  return kept.map(message => cutTurns.has(message.replyTurnId) || cutLegacyTurns.has(message)
    ? withoutReplyVersions(message) : message)
}

export function removeBubbles(history: ChatMessage[], removed: Set<ChatMessage>) {
  const retained = history.filter(message => !removed.has(message))
  const affected = new Map<string, Set<number | undefined>>()
  for (const message of removed) {
    if (!message.replyTurnId) continue
    const timestamps = affected.get(message.replyTurnId) ?? new Set()
    timestamps.add(message.timestamp)
    affected.set(message.replyTurnId, timestamps)
  }
  const replacements = new Map<ChatMessage, ChatMessage>()
  for (const originalHead of history) {
    const { replyTurnId, replyVersions } = originalHead
    const timestamps = replyTurnId && affected.get(replyTurnId)
    if (!timestamps || !replyVersions) continue
    const head = retained.find(message => message.replyTurnId === replyTurnId)
    if (!head) continue
    const variants = replyVersions.variants.flatMap(variant => {
      if (!variant) return [null]
      // Legacy per-bubble variants can share timestamps with the current turn.
      const remaining = variant.filter(message => !timestamps.has(message.timestamp))
      return remaining.length ? [remaining] : []
    })
    replacements.set(head, {
      ...withoutReplyVersions(head),
      replyVersions: variants.length > 1 ? { variants, index: variants.indexOf(null) } : undefined,
    })
  }
  return retained.map(message => replacements.get(message) ?? message)
}
