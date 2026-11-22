export const schema = {
  doubanPosts: { autoIncrement: true },
  chats: { autoIncrement: false },
  apiConfig: { autoIncrement: false },
  globalSettings: { autoIncrement: false },
  userStickers: { autoIncrement: false },
  worldBooks: { autoIncrement: false },
  worldBookCategories: { autoIncrement: true },
  musicLibrary: { autoIncrement: false },
  personaPresets: { autoIncrement: false },
  qzoneSettings: { autoIncrement: false },
  qzonePosts: { autoIncrement: true },
  qzoneAlbums: { autoIncrement: true },
  qzonePhotos: { autoIncrement: true },
  favorites: { autoIncrement: true },
  qzoneGroups: { autoIncrement: true },
  memories: { autoIncrement: true },
  callRecords: { autoIncrement: true },
  shoppingProducts: { autoIncrement: true },
  shoppingCategories: { autoIncrement: true },
  apiPresets: { autoIncrement: true },
  renderingRules: { autoIncrement: true },
  appearancePresets: { autoIncrement: true },
  stickerCategories: { autoIncrement: true },
  customAvatarFrames: { autoIncrement: true },
  presets: { autoIncrement: false },
  presetCategories: { autoIncrement: true },
  readingLibrary: { autoIncrement: true },
  npcs: { autoIncrement: true },
  deviceSettings: { autoIncrement: false },
} as const

export type TableName = keyof typeof schema
export type Key = string | number
export type StoredRow = Record<string, unknown> & { id: Key }
export interface TableData { nextId: number; rows: StoredRow[] }
export type Tables = Partial<Record<TableName, TableData>>

export interface Snapshot {
  version: 1
  revision: number
  tables: Tables
}
