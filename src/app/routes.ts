import { matchRoutes } from 'react-router-dom'

export const screenPaths = {
  "home-screen": "/",
  "chat-list-screen": "/chats",
  "chat-interface-screen": "/chats/:chatId",
  "contact-picker-screen": "/chats/contacts",
  "member-management-screen": "/chats/members",
  "chat-settings-screen": "/chats/settings",
  "search-history-screen": "/chats/search",
  "character-edit-screen": "/edit/:characterId?",
  "lorebook-screen": "/world-info",
  "social-screen": "/social",
  "world-book-screen": "/world-books",
  "world-book-editor-screen": "/world-books/editor",
  "character-selection-screen": "/characters",
  "character-phone-screen": "/characters/phone",
  "preset-screen": "/presets",
  "preset-editor-screen": "/presets/editor",
  "tutorial-screen": "/tutorial",
  "api-settings-screen": "/settings/api",
  "wallpaper-screen": "/settings/appearance",
  "font-settings-screen": "/settings/fonts",
  "album-screen": "/albums",
  "album-photos-screen": "/albums/photos",
  "browser-screen": "/links",
  "video-call-screen": "/calls/active",
  "outgoing-call-screen": "/calls/outgoing",
  "call-history-screen": "/calls/history",
  "long-term-memory-screen": "/memories",
  "shopping-screen": "/shop",
  "product-detail-screen": "/shop/product",
  "cart-screen": "/shop/cart"
} as const

export type ScreenId = keyof typeof screenPaths

const matches = (Object.keys(screenPaths) as ScreenId[]).map(id => ({ id, path: screenPaths[id] }))
const contextualScreens: Partial<Record<ScreenId, ScreenId>> = {
  'album-photos-screen': 'album-screen',
  'browser-screen': 'home-screen',
  'character-phone-screen': 'character-selection-screen',
  'chat-settings-screen': 'chat-list-screen',
  'contact-picker-screen': 'chat-list-screen',
  'long-term-memory-screen': 'chat-list-screen',
  'member-management-screen': 'chat-list-screen',
  'outgoing-call-screen': 'chat-list-screen',
  'preset-editor-screen': 'preset-screen',
  'product-detail-screen': 'shopping-screen',
  'search-history-screen': 'chat-list-screen',
  'video-call-screen': 'chat-list-screen',
  'world-book-editor-screen': 'world-book-screen',
}

export function resolveScreen(pathname: string) {
  const match = matchRoutes(matches, pathname)?.at(-1)
  if (!match) return undefined
  const id = match.route.id
  const parent = contextualScreens[id]
  return { id, chatId: match.params.chatId, requiresContext: Boolean(parent), fallback: parent && screenPaths[parent] }
}

type ScreenState = { bookId?: string | number }
type NavigateScreen = (id: ScreenId, state?: ScreenState) => void
let navigateScreen: NavigateScreen | undefined

export function bindScreenNavigation(navigate: NavigateScreen) {
  navigateScreen = navigate
  return () => {
    if (navigateScreen === navigate) navigateScreen = undefined
  }
}

export function showScreen(id: ScreenId, state?: ScreenState) {
  navigateScreen?.(id, state)
}
