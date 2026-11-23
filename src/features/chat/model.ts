import type { StoredRow } from '../../../shared/storage'
import type { AvatarGallery } from '../characters/gallery'

export type ChatMessage = {
  role: string
  content?: unknown
  timestamp?: number
  senderName?: string
  isHidden?: boolean
  isOpening?: boolean
}

export type ChatSession = {
  id: string
  createdAt: number
  history: ChatMessage[]
  longTermMemory: unknown[]
  lastMemorySummaryTimestamp: number
  composerDraft?: string
}

type ChatSettings = Record<string, unknown> & {
  aiAvatar?: string
  aiPersona?: string
  myNickname?: string
  linkedLoreBookIds?: string[]
  alternateGreetings?: string[]
  avatarGallery?: AvatarGallery
  aiAvatarLibrary?: { url: string }[]
}

type ChatContact = StoredRow & {
  id: string
  name: string
  settings: ChatSettings
  history: ChatMessage[]
}

export type DirectChat = ChatContact & {
  isGroup?: false
  originalName: string
  characterCard?: {
    firstMessage: string
    alternateGreetings: string[]
    extras?: Record<string, string>
  }
  conversationId?: string
  conversationCreatedAt?: number
  chatSessions?: ChatSession[]
  longTermMemory?: unknown[]
  lastMemorySummaryTimestamp?: number
}

export type GroupChat = ChatContact & {
  isGroup: true
  members?: Array<{
    id: string
    avatar?: string
    originalName?: string
    groupNickname?: string
  }>
}
