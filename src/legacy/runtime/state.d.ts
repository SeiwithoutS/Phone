import type { DirectChat, GroupChat } from '../../features/chat/model'
import type { LoreBook } from '../../features/world-book/lore'
import type { LocalDatabase } from '../../storage/database'

// Typed surface for React and feature modules. The legacy startup populates
// the database and settings before the phone accepts input.
export const runtime: {
  db: LocalDatabase
  defaultAvatar: string
  state: {
    chats: Record<string, DirectChat | GroupChat | undefined>
    activeChatId: string | null
    lorebooks?: LoreBook[]
    qzoneSettings?: { nickname?: string }
    apiConfig?: { proxyUrl?: string; apiKey?: string; model?: string; provider?: string }
  }
  videoCallState?: { activeChatId: string | null; isActive: boolean; isAwaitingResponse: boolean }
  lastRawAiResponse: string
  lastResponseTimestamps: number[]
}

export const controls: { chatInput?: HTMLTextAreaElement }
