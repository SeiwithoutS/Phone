import { runtime } from '../../legacy/runtime/state.js'
import { imageSource } from '../../runtime/files'
import type { DirectChat } from '../chat/model'

export type AvatarGallery = {
  photos: string[]
  mode: 'off' | 'timer' | 'calls'
  minutes: number
  everyCalls: number
  shuffle: boolean
  startedAt: number
}

export function normalizeGallery(gallery?: Partial<AvatarGallery>): AvatarGallery {
  return {
    photos: [...new Set((Array.isArray(gallery?.photos) ? gallery.photos : []).filter(photo => typeof photo === 'string')
      .map(imageSource).filter(Boolean))],
    mode: gallery?.mode === 'timer' || gallery?.mode === 'calls' ? gallery.mode : 'off',
    minutes: Math.min(1440, Math.max(1, Math.floor(gallery?.minutes || 30))),
    everyCalls: Math.min(99, Math.max(1, Math.floor(gallery?.everyCalls || 1))),
    shuffle: gallery?.shuffle === true,
    startedAt: gallery?.startedAt || Date.now(),
  }
}

const counterKey = (id: string) => 'avatar-gallery-calls:' + id

function readCount(value: unknown, gallery: AvatarGallery) {
  const counter = value as { startedAt?: number; calls?: number } | undefined
  return counter?.startedAt === gallery.startedAt && Number.isSafeInteger(counter.calls) ? counter.calls! : 0
}

export function characterAvatar(chat: DirectChat, now = Date.now()): string {
  const gallery = chat.settings.avatarGallery
  const main = chat.settings.aiAvatar || ''
  if (!gallery || gallery.mode === 'off') return main || runtime.defaultAvatar
  const photos = [...new Set([main, ...gallery.photos].filter(Boolean))]
  if (photos.length < 2) return photos[0] || runtime.defaultAvatar
  const steps = gallery.mode === 'calls'
    ? Math.floor(readCount(runtime.db.getPreference(counterKey(chat.id)), gallery) / Math.max(1, gallery.everyCalls))
    : Math.floor(Math.max(0, now - gallery.startedAt) / (Math.max(1, gallery.minutes) * 60000))
  if (gallery.shuffle) {
    let seed = gallery.startedAt | 0
    // Keep the main image first and shuffle the rest for this gallery configuration.
    for (let i = photos.length - 1; i > 1; i--) {
      seed = (Math.imul(1664525, seed) + 1013904223) | 0
      const index = 1 + (seed >>> 0) % i
      const photo = photos[index]
      photos[index] = photos[i]
      photos[i] = photo
    }
  }
  return photos[steps % photos.length]
}

export async function registerAvatarCall(chat: DirectChat) {
  const gallery = chat.settings.avatarGallery
  if (gallery?.mode !== 'calls' || !gallery.photos.length) return
  const stored = runtime.db.deviceSettings
  const id = counterKey(chat.id)
  await runtime.db.transaction('rw', stored, async tx => {
    const count = readCount((await tx.deviceSettings.get(id))?.value, gallery)
    await tx.deviceSettings.put({ id, value: { startedAt: gallery.startedAt, calls: count + 1 } })
  })
  refreshCharacterAvatars()
}

export function refreshCharacterAvatars() {
  const now = Date.now()
  const sources = new Map<string, string>()
  for (const image of document.querySelectorAll<HTMLImageElement>('img[data-qq-character-avatar]')) {
    const id = image.dataset.qqCharacterAvatar
    if (!id) continue
    const chat = runtime.state.chats[id]
    if (!chat || chat.isGroup || !chat.settings.avatarGallery) continue
    const source = sources.get(id) ?? characterAvatar(chat, now)
    sources.set(id, source)
    if (image.getAttribute('src') !== source) image.src = source
  }
}
