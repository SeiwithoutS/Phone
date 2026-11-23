import type { DirectChat, GroupChat } from '../../features/chat/model'
import type { LoreBook } from '../../features/world-book/lore'
import type { LocalDatabase } from '../../storage/database'
import type { Sticker } from '../../features/stickers/library'

// Typed surface for React and feature modules. The legacy startup populates
// the database and settings before the phone accepts input.
export const runtime: {
  db: LocalDatabase
  defaultAvatar: string
  state: {
    chats: Record<string, DirectChat | GroupChat | undefined>
    activeChatId: string | null
    userStickers: Sticker[]
    worldBooks?: Array<{ id: string | number; name?: string; content?: Array<{ enabled?: boolean; content?: string; comment?: string }> }>
    presets?: Array<{ id: string | number; name?: string; content?: Array<{ enabled?: boolean; content?: string; comment?: string }> }>
    lorebooks?: LoreBook[]
    qzoneSettings?: { nickname?: string }
    apiConfig?: { proxyUrl?: string; apiKey?: string; model?: string; provider?: string }
    globalSettings?: { sendImagesToAi?: boolean; apiTemperature?: number; apiTopP?: number;
      apiFrequencyPenalty?: number; apiPresencePenalty?: number; apiSwipes?: number; apiStreaming?: boolean }
  }
  videoCallState?: { activeChatId: string | null; isActive: boolean; isAwaitingResponse: boolean }
  lastRawAiResponse: string
  lastResponseTimestamps: number[]
}

export const controls: { chatInput?: HTMLTextAreaElement }
