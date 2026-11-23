import type { StoredRow } from '../../../shared/storage'
import type { AvatarGallery } from '../characters/gallery'

export type ChatMessage = {
  role: string
  content?: unknown
  timestamp?: number
  senderName?: string
  isHidden?: boolean
  isOpening?: boolean
  type?: string
  isTemporary?: boolean
  plainText?: boolean
  meaning?: string
  imageDescription?: string
  swipes?: { variants: Array<{ text: string; plainText?: boolean }>; index: number }
}

export type ChatSession = {
  id: string
  createdAt: number
  history: ChatMessage[]
  longTermMemory: unknown[]
  lastMemorySummaryTimestamp: number
  composerDraft?: string
  branchFrom?: { sessionId: string; timestamp: number }
  announcements?: Array<{ messageTimestamp: number }>
}

type ChatSettings = Record<string, unknown> & {
  aiAvatar?: string
  aiPersona?: string
  myNickname?: string
  linkedLoreBookIds?: string[]
  alternateGreetings?: string[]
  avatarGallery?: AvatarGallery
  aiAvatarLibrary?: { url: string }[]
  stickerCategoryIds?: Array<string | number>
}

export type ChatContact = StoredRow & {
  id: string
  name: string
  settings: ChatSettings
  history: ChatMessage[]
  conversationId?: string
  conversationCreatedAt?: number
  chatSessions?: ChatSession[]
  longTermMemory?: unknown[]
  lastMemorySummaryTimestamp?: number
  branchFrom?: ChatSession['branchFrom']
  announcements?: ChatSession['announcements']
}

export type DirectChat = ChatContact & {
  isGroup?: false
  originalName: string
  characterCard?: {
    firstMessage: string
    alternateGreetings: string[]
    extras?: Record<string, string>
  }
}

export type GroupChat = ChatContact & {
  isGroup: true
  members?: Array<{
    id: string
    avatar?: string
    originalName?: string
    groupNickname?: string
    persona?: string
  }>
}
