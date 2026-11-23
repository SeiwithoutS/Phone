import { runtime, controls } from '../../legacy/runtime/state.js'
import { renderChatInterface } from '../../legacy/chat/conversation.js'
import { renderChatList } from '../../legacy/chat/list.js'
import { cancelReplyMode } from '../../legacy/chat/attachments.js'
import { exitSelectionMode } from '../../legacy/chat/messages.js'
import { openingMessage } from '../characters/characters'
import type { ChatSession, DirectChat } from './model'

export type SessionAction = 'new' | 'change-opening' | 'open'

const activeId = (chat: DirectChat) => chat.conversationId ?? 'original'

export function getDirectChat(chatId = runtime.state.activeChatId) {
  const chat = chatId === null ? undefined : runtime.state.chats[chatId]
  return chat && !chat.isGroup ? chat : undefined
}

function snapshot(chat: DirectChat): ChatSession {
  return {
    id: activeId(chat),
    createdAt: chat.conversationCreatedAt ?? chat.history[0]?.timestamp ?? Date.now(),
    history: chat.history,
    longTermMemory: chat.longTermMemory || [],
    lastMemorySummaryTimestamp: chat.lastMemorySummaryTimestamp ?? 0,
    composerDraft: controls.chatInput?.value || '',
  }
}

export function getSessions(chat: DirectChat) {
  return [snapshot(chat), ...(chat.chatSessions ?? [])].map(session => {
    const last = session.history.findLast(message => !message.isHidden && typeof message.content === 'string')
    return {
      id: session.id,
      active: session.id === activeId(chat),
      date: last?.timestamp ?? session.createdAt,
      count: session.history.filter(message => !message.isHidden).length,
      preview: typeof last?.content === 'string' ? last.content : '',
    }
  }).sort((a, b) => b.date - a.date)
}

export function canChangeOpening(chat: DirectChat) {
  return chat.history.length === 0 || (chat.history.length === 1 && chat.history[0].isOpening === true)
}

const changes = new Set<string>()
const requests = new Map<string, number>()

export function sessionChanging(chatId: string) {
  return changes.has(chatId)
}

export async function withConversationRequest<T>(chatId: string | null, run: () => T | Promise<T>) {
  if (!chatId || sessionChanging(chatId)) return
  requests.set(chatId, (requests.get(chatId) || 0) + 1)
  try {
    return await run()
  } finally {
    const left = (requests.get(chatId) ?? 1) - 1
    if (left) requests.set(chatId, left)
    else requests.delete(chatId)
  }
}

export async function changeSession(chat: DirectChat, action: SessionAction, value: string) {
  if (getDirectChat() !== chat || changes.has(chat.id)) return
  const call = runtime.videoCallState
  if (requests.has(chat.id) || (call?.activeChatId === chat.id && (call.isActive || call.isAwaitingResponse))) {
    throw new Error('Wait for the current reply or call to finish before changing chats.')
  }

  const current = snapshot(chat)
  let next = current
  let archives = chat.chatSessions ?? []
  if (action === 'change-opening') {
    if (!canChangeOpening(chat)) throw new Error('Start a new chat to pick a different opening.')
    next = { ...current, history: value ? [openingMessage(chat, value)] : [] }
  } else {
    if (action === 'open') {
      const archived = archives.find(session => session.id === value)
      if (!archived) return
      next = archived
    } else {
      next = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        history: value ? [openingMessage(chat, value)] : [],
        longTermMemory: [],
        lastMemorySummaryTimestamp: 0,
        composerDraft: '',
      }
    }
    archives = [...archives.filter(session => session.id !== next.id), current]
  }

  const update = {
    history: next.history,
    longTermMemory: next.longTermMemory,
    lastMemorySummaryTimestamp: next.lastMemorySummaryTimestamp,
    conversationId: next.id,
    conversationCreatedAt: next.createdAt,
    chatSessions: archives,
  }
  changes.add(chat.id)
  try {
    const saved = await runtime.db.chats.update(chat.id, update)
    if (!saved) throw new Error('This character was deleted.')
    Object.assign(chat, update)
    if (getDirectChat() === chat) {
      exitSelectionMode()
      cancelReplyMode()
      runtime.lastRawAiResponse = ''
      runtime.lastResponseTimestamps = []
      if (controls.chatInput) {
        controls.chatInput.value = next.composerDraft ?? ''
        controls.chatInput.style.height = 'auto'
      }
      await renderChatInterface(chat.id)
    }
    void renderChatList()
  } finally {
    changes.delete(chat.id)
  }
}
