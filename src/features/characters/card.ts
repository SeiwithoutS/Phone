import { openImageArchive } from '../../runtime/dependencies'
import { fileDataUrl, imageSource } from '../../runtime/files'
import { readLoreBook, record, string } from '../world-book/lore'
import type { LoreBook } from '../world-book/lore'
import type { AvatarGallery } from './gallery'

export type CharacterDraft = {
  id?: string
  name: string
  nickname: string
  avatar: string
  description: string
  firstMessage: string
  alternateGreetings: string[]
  extras?: Record<string, string>
  lorebook?: LoreBook
  gallery?: AvatarGallery
}

export const blankCharacter = (): CharacterDraft => ({
  name: '', nickname: '', avatar: '', description: '', firstMessage: '', alternateGreetings: [],
})

export function parsePngCard(buffer: ArrayBuffer): unknown {
  const view = new DataView(buffer)
  const decoder = new TextDecoder()
  if (view.byteLength < 8 || view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) {
    throw new Error('This file is not a PNG.')
  }
  const chunks = new Map<string, string>()
  for (let offset = 8; offset + 12 <= view.byteLength;) {
    const length = view.getUint32(offset)
    if (length > view.byteLength - offset - 12) throw new Error('The PNG is incomplete.')
    const type = decoder.decode(new Uint8Array(buffer, offset + 4, 4))
    if (type === 'IEND') break
    if (type === 'tEXt') {
      const bytes = new Uint8Array(buffer, offset + 8, length)
      const separator = bytes.indexOf(0)
      if (separator > 0) {
        const key = decoder.decode(bytes.subarray(0, separator)).toLowerCase()
        if (key === 'ccv3' || key === 'chara') chunks.set(key, decoder.decode(bytes.subarray(separator + 1)))
      }
    }
    offset += length + 12
  }
  for (const key of ['ccv3', 'chara']) {
    const encoded = chunks.get(key)
    if (!encoded) continue
    try {
      const bytes = Uint8Array.from(atob(encoded.trim()), char => char.charCodeAt(0))
      return JSON.parse(decoder.decode(bytes))
    } catch {
      if (key === 'chara' || !chunks.has('chara')) throw new Error('The PNG contains invalid character-card metadata.')
    }
  }
  throw new Error('This PNG contains no character card. Choose the original card file.')
}

export async function readCharacterCard(file: File): Promise<CharacterDraft> {
  const ext = file.name.split('.').at(-1)?.toLowerCase()
  let raw: unknown
  let avatar = ''
  if (ext === 'png') {
    raw = parsePngCard(await file.arrayBuffer())
    avatar = await fileDataUrl(file.slice(0, file.size, 'image/png'))
  } else if (ext === 'json') {
    raw = JSON.parse((await file.text()).replace(/^\uFEFF/, ''))
  } else if (ext === 'charx') {
    const archive = await openImageArchive(file)
    const cardEntry = archive.file('card.json') ?? archive.file(/(?:^|\/)card\.json$/i)[0]
    const json = await cardEntry?.async('string')
    if (!json) throw new Error('This CHARX archive is missing card.json.')
    raw = JSON.parse(json.replace(/^\uFEFF/, ''))
    const folder = cardEntry.name.slice(0, -'card.json'.length)
    for (const asset of avatarAssets(cardFields(raw))) {
      const uri = string(asset.uri).trim()
      const path = uri.replace(/^(?:embedd?ed:\/\/|__asset:)/i, '').replace(/\\/g, '/').replace(/^(?:\.\/|\/)+/, '')
      const image = archive.file(folder + path) ?? archive.file(path)
      const ext = string(asset.ext).replace(/^\./, '').toLowerCase() || path.split('.').at(-1)?.toLowerCase()
      const mime = ext && imageMime(ext)
      if (image && mime) {
        avatar = await fileDataUrl(new Blob([await image.async('arraybuffer')], { type: mime }))
        break
      }
      avatar = imageSource(uri)
      if (avatar) break
    }
    if (!avatar) {
      const fallback = archive.file(/(?:^|\/)(?:avatar|icon|thumbnail|cover)\.(?:png|apng|jpe?g|jfif|webp|gif|avif|bmp)$/i)[0]
      const mime = fallback && imageMime(fallback.name.split('.').at(-1)!.toLowerCase())
      if (fallback && mime) avatar = await fileDataUrl(new Blob([await fallback.async('arraybuffer')], { type: mime }))
    }
  } else {
    throw new Error('Choose a PNG, JSON or CHARX character card.')
  }
  const data = cardFields(raw)
  const name = string(data.name).trim()
  if (!name) throw new Error('The card is missing a character name.')
  const extension = record(data.extensions)
  const embedded = data.character_book ?? extension.character_book ?? data.lorebook ?? data.world_info ?? data.char_book
  const lorebook = readLoreBook(embedded, name + ' lorebook')
  const extras = Object.fromEntries(['personality', 'scenario', 'mes_example', 'system_prompt', 'post_history_instructions']
    .map(key => [key, string(data[key])]).filter(([, value]) => value))
  return {
    name,
    nickname: string(data.nickname ?? extension.nickname),
    avatar: avatar || imageSource(string(data.avatar)) ||
      avatarAssets(data).map(asset => imageSource(string(asset.uri))).find(Boolean) || '',
    description: string(data.description),
    firstMessage: string(data.first_mes),
    alternateGreetings: Array.isArray(data.alternate_greetings) ? data.alternate_greetings.map(string).filter(text => text.trim()) : [],
    extras,
    lorebook,
  }
}

function cardFields(raw: unknown) {
  const root = record(raw)
  return { ...root, ...record(root.data) }
}

function avatarAssets(data: Record<string, unknown>) {
  const assets = Array.isArray(data.assets) ? data.assets.map(record) : []
  return assets.filter(asset => ['icon', 'avatar'].includes(string(asset.type).toLowerCase()))
    .sort((a, b) => Number(string(b.name).toLowerCase() === 'main') - Number(string(a.name).toLowerCase() === 'main'))
}

function imageMime(ext: string) {
  if (['jpg', 'jpeg', 'jfif'].includes(ext)) return 'image/jpeg'
  return ['png', 'apng', 'webp', 'gif', 'avif', 'bmp'].includes(ext) ? 'image/' + ext : ''
}
