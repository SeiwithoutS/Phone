import { runtime, controls } from '../../legacy/runtime/state.js'
import { renderChatInterface } from '../../legacy/chat/conversation.js'
import { renderChatList } from '../../legacy/chat/list.js'
import { cancelReplyMode } from '../../legacy/chat/attachments.js'
import { exitSelectionMode } from '../../legacy/chat/messages.js'
import { openingMessage } from '../characters/characters'
import { formatChatActionNotice } from './action-notices'
import { removeBubbles, trimReplyTurns } from './reply-turns'
import type { ChatMessage, ChatSession } from './model'

type Chat = NonNullable<ReturnType<typeof getActiveChat>>
export type SessionAction =
  | { type: 'new' | 'change-opening'; greeting: string }
  | { type: 'open' | 'delete'; id: string }
  | { type: 'branch'; message: ChatMessage }

const activeId = (chat: Chat) => chat.conversationId ?? 'original'

export function getActiveChat(id = runtime.state.activeChatId) {
  return id === null ? undefined : runtime.state.chats[id]
}

export function getDirectChat(id = runtime.state.activeChatId) {
  const chat = getActiveChat(id)
  return chat && !chat.isGroup ? chat : undefined
}

function snapshot(chat: Chat): ChatSession {
  return {
    id: activeId(chat),
    createdAt: chat.conversationCreatedAt ?? chat.history[0]?.timestamp ?? Date.now(),
    history: chat.history,
    longTermMemory: chat.longTermMemory ?? [],
    lastMemorySummaryTimestamp: chat.lastMemorySummaryTimestamp ?? 0,
    composerDraft: controls.chatInput?.value || '',
    branchFrom: chat.branchFrom,
    announcements: chat.announcements,
  }
}

export function getSessions(chat: Chat) {
  return [snapshot(chat), ...(chat.chatSessions ?? [])].map(session => {
    const last = session.history.findLast(message => !message.isHidden && typeof message.content === 'string')
    return {
      id: session.id,
      active: session.id === activeId(chat),
      date: last?.timestamp ?? session.createdAt,
      count: session.history.filter(message => !message.isHidden).length,
      preview: last ? formatChatActionNotice(last, runtime.state.globalSettings?.qqActionLanguage) : '',
      branch: Boolean(session.branchFrom),
    }
  }).sort((a, b) => Number(b.active) - Number(a.active) || b.date - a.date)
}

export function canChangeOpening(chat: Chat) {
  return !chat.isGroup && (chat.history.length === 0 || (chat.history.length === 1 && chat.history[0].isOpening === true))
}

const changes = new Set<string>()
const requests = new Map<string, number>()

export function sessionChanging(chatId: string) {
  return changes.has(chatId)
}

function conversationBusy(chatId: string) {
  const call = runtime.videoCallState
  return changes.has(chatId) || requests.has(chatId) ||
    (call?.activeChatId === chatId && (call.isActive || call.isAwaitingResponse))
}

export async function withIdleConversation<T>(chatId: string, run: () => Promise<T>) {
  if (conversationBusy(chatId)) return
  changes.add(chatId)
  try { return await run() }
  finally { changes.delete(chatId) }
}

export async function withConversationRequest<T>(chatId: string | null, run: () => T | Promise<T>) {
  if (!chatId || sessionChanging(chatId)) return
  requests.set(chatId, (requests.get(chatId) || 0) + 1)
  try { return await run() }
  finally {
    const left = (requests.get(chatId) ?? 1) - 1
    if (left) requests.set(chatId, left)
    else requests.delete(chatId)
  }
}

export async function mutateConversation<T>(chat: Chat, run: () => Promise<T>) {
  if (getActiveChat() !== chat) throw new Error('Open this chat again and try once more.')
  if (conversationBusy(chat.id)) {
    throw new Error('Wait for the current reply or call to finish, then try again.')
  }
  changes.add(chat.id)
  try { return await run() }
  finally { changes.delete(chat.id) }
}

export async function storeConversation(chat: Chat, update: Partial<Chat>) {
  const saved = await runtime.db.chats.update(chat.id, update)
  if (!saved) throw new Error('This chat was deleted.')
  Object.assign(chat, update)
  runtime.lastRawAiResponse = ''
  runtime.lastResponseTimestamps = []
}

export function rerenderConversation(chat: Chat, preserveScroll = false) {
  if (getActiveChat() === chat) void renderChatInterface(chat.id, preserveScroll)
  void renderChatList()
}

function emptySession(): ChatSession {
  return {
    id: crypto.randomUUID(), createdAt: Date.now(), history: [], longTermMemory: [],
    lastMemorySummaryTimestamp: 0, composerDraft: '',
  }
}

export function manualMemory(chat: { longTermMemory?: unknown[] }) {
  return (chat.longTermMemory ?? []).filter(memory => (memory as { source?: string } | null)?.source === 'manual')
}

function keepHistory(session: ChatSession, history: ChatMessage[]): ChatSession {
  const timestamps = new Set(history.map(message => message.timestamp))
  return {
    ...session,
    history,
    longTermMemory: manualMemory(session),
    lastMemorySummaryTimestamp: 0,
    announcements: session.announcements?.filter(item => timestamps.has(item.messageTimestamp)),
  }
}

function sessionChanges(session: ChatSession): Partial<Chat> {
  return {
    history: session.history,
    longTermMemory: session.longTermMemory,
    lastMemorySummaryTimestamp: session.lastMemorySummaryTimestamp,
    conversationId: session.id,
    conversationCreatedAt: session.createdAt,
    branchFrom: session.branchFrom,
    announcements: session.announcements,
  }
}

export async function deleteMessages(chat: Chat, messages: ChatMessage[], notice?: ChatMessage, range = false) {
  await mutateConversation(chat, async () => {
    const removed = new Set(messages)
    const retained = range ? trimReplyTurns(chat.history, chat.history.filter(message => !removed.has(message)))
      : removeBubbles(chat.history, removed)
    if (retained.length === chat.history.length) throw new Error('The selected messages are no longer in this chat.')
    const kept = keepHistory(snapshot(chat), retained)
    if (notice) kept.history.push(notice)
    await storeConversation(chat, sessionChanges(kept))
    if (getActiveChat() === chat) {
      exitSelectionMode()
      cancelReplyMode()
    }
    rerenderConversation(chat, true)
  })
}

export async function changeSession(chat: Chat, action: SessionAction) {
  await mutateConversation(chat, async () => {
    // Clone copies kept in the archive so editing a branch cannot change its parent.
    const current = structuredClone(snapshot(chat))
    let next = current
    let archives = chat.chatSessions ?? []
    switch (action.type) {
      case 'change-opening':
        if (chat.isGroup || !canChangeOpening(chat)) throw new Error('Start a new chat to pick a different opening.')
        next = { ...current, history: action.greeting ? [openingMessage(chat, action.greeting)] : [] }
        break
      case 'delete':
        if (action.id === current.id) {
          next = archives.reduce<ChatSession | undefined>((latest, session) =>
            !latest || session.createdAt > latest.createdAt ? session : latest, undefined) ?? emptySession()
        } else if (!archives.some(session => session.id === action.id)) {
          throw new Error('This chat file no longer exists.')
        }
        archives = archives.filter(session => session.id !== action.id && session.id !== next.id)
        break
      case 'open': {
        const found = archives.find(session => session.id === action.id)
        if (!found) throw new Error('This chat file no longer exists.')
        next = found
        archives = [...archives.filter(session => session.id !== found.id), current]
        break
      }
      case 'branch': {
        const index = chat.history.indexOf(action.message)
        if (index < 0 || action.message.timestamp === undefined) throw new Error('This message is no longer in this chat.')
        next = {
          ...keepHistory(current, trimReplyTurns(current.history, current.history.slice(0, index + 1))),
          ...{ id: crypto.randomUUID(), createdAt: Date.now(), composerDraft: '' },
          branchFrom: { sessionId: current.id, timestamp: action.message.timestamp },
        }
        archives = [...archives, current]
        break
      }
      case 'new':
        next = emptySession()
        if (!chat.isGroup && action.greeting) next.history = [openingMessage(chat, action.greeting)]
        archives = [...archives, current]
        break
    }

    const conversationChanged = action.type !== 'delete' || action.id === current.id
    await storeConversation(chat, conversationChanged ? { ...sessionChanges(next), chatSessions: archives } : { chatSessions: archives })
    if (getActiveChat() === chat && conversationChanged) {
      exitSelectionMode()
      cancelReplyMode()
      if (controls.chatInput) {
        controls.chatInput.value = next.composerDraft ?? ''
        controls.chatInput.style.height = 'auto'
      }
      rerenderConversation(chat)
    } else void renderChatList()
  })
}
