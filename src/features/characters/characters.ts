import { renderChatList } from '../../legacy/chat/list.js'
import { runtime } from '../../legacy/runtime/state.js'
import type { ChatMessage, DirectChat, GroupChat } from '../chat/model'
import type { CharacterDraft } from './card'
import { normalizeGallery } from './gallery'

export function getCharacters() {
  return Object.values(runtime.state.chats).filter((chat): chat is DirectChat => Boolean(chat && !chat.isGroup))
}

export function getCharacterDraft(chat: DirectChat): CharacterDraft {
  return {
    id: chat.id,
    name: chat.originalName || chat.name,
    nickname: chat.originalName !== chat.name ? chat.name : '',
    avatar: chat.settings.aiAvatar === runtime.defaultAvatar ? '' : chat.settings.aiAvatar || '',
    description: chat.settings.aiPersona || '',
    firstMessage: chat.characterCard?.firstMessage ?? '',
    alternateGreetings: chat.characterCard?.alternateGreetings ?? chat.settings.alternateGreetings ?? [],
    extras: chat.characterCard?.extras,
    gallery: normalizeGallery(chat.settings.avatarGallery ?? {
      photos: chat.settings.aiAvatarLibrary?.map(avatar => avatar.url).filter(Boolean),
    }),
  }
}

export function characterPrompt(chat: DirectChat | GroupChat) {
  const extras = chat.isGroup ? undefined : chat.characterCard?.extras
  return [chat.settings.aiPersona, extras?.personality, extras?.scenario, extras?.mes_example,
    extras?.system_prompt, extras?.post_history_instructions].filter(Boolean).join('\n\n')
}

export function greetingOptions(chat: DirectChat) {
  const { firstMessage, alternateGreetings } = getCharacterDraft(chat)
  return [firstMessage, ...alternateGreetings].map(value => cleanGreeting(value, chat)).filter(Boolean)
}

function cleanGreeting(text: string, chat: DirectChat) {
  let value = text.trim()
  // Import text and line breaks from card HTML. The message renderer escapes the resulting text.
  if (/<(?:[a-z][\w:-]*[\s/>]|\/[a-z])/i.test(value)) {
    const html = value.replace(/<br\s*\/?>|<\/(?:p|div|li|blockquote|h[1-6])>/gi, '\n')
    const document = new DOMParser().parseFromString(html, 'text/html')
    document.querySelectorAll('script,style,template').forEach(node => node.remove())
    value = document.body.textContent.trim()
  }
  return value.replace(/\{\{(char|user)\}\}/gi, (_, name) =>
    name.toLowerCase() === 'char' ? chat.originalName : (chat.settings.myNickname || runtime.state.qzoneSettings?.nickname || 'Me'))
}

export function openingMessage(chat: DirectChat, text: string): ChatMessage {
  return {
    role: 'assistant',
    senderName: chat.originalName,
    content: text,
    timestamp: Date.now(),
    isOpening: true,
  }
}

export async function saveCharacter(draft: CharacterDraft) {
  const name = draft.name.trim()
  if (!name) throw new Error('Enter a character name.')
  const existing = draft.id ? runtime.state.chats[draft.id] : undefined
  if (draft.id && (!existing || existing.isGroup)) throw new Error('This character was deleted.')
  // Character names are also displayed in legacy HTML-based features.
  if (/[<>"]/.test(name) || /[<>"]/.test(draft.nickname)) {
    throw new Error('Names cannot include angle brackets or double quotes.')
  }

  const now = Date.now()
  const id = draft.id || 'chat_' + crypto.randomUUID()
  const lorebook = draft.lorebook ? { ...draft.lorebook, sourceCharacterId: id } : undefined
  const avatarGallery = normalizeGallery(draft.gallery)
  const linkedLoreBookIds = [...new Set([...(existing?.settings.linkedLoreBookIds || []), ...(lorebook ? [lorebook.id] : [])])]
  const preferred = runtime.state.personaPresets.find(entry => entry.id === runtime.db.getPreference('default-persona'))
  const defaults = {
    myPersona: preferred?.persona || '', myNickname: preferred?.name || 'Me', maxMemory: 10, myAvatar: preferred?.avatar || runtime.defaultAvatar,
    userLocation: preferred?.location ?? '', userTimeZone: preferred?.timeZone ?? '',
    background: '', theme: 'default', fontSize: 13, customCss: '', linkedWorldBookIds: [],
    aiAvatarLibrary: [], myAvatarLibrary: [], enableBackgroundActivity: true, actionCooldownMinutes: 15,
    enableTimePerception: true, isOfflineMode: false, offlineMinLength: 100, offlineMaxLength: 300,
    offlinePresetId: null, timeZone: '',
  }
  const next: DirectChat = {
    id, isPinned: false, unreadCount: 0,
    relationship: { status: 'friend', blockedTimestamp: null, applicationReason: '' },
    status: { text: 'Online', lastUpdate: now, isBusy: false },
    history: [], musicData: { totalTime: 0 }, longTermMemory: [], thoughtsHistory: [],
    ...existing,
    isGroup: false,
    name: draft.nickname.trim() || name,
    originalName: name,
    settings: {
      ...defaults, ...existing?.settings, aiPersona: draft.description, aiAvatar: draft.avatar || runtime.defaultAvatar, linkedLoreBookIds, avatarGallery,
    },
    characterCard: {
      firstMessage: draft.firstMessage.trim(),
      alternateGreetings: draft.alternateGreetings.map(text => text.trim()).filter(Boolean),
      extras: draft.extras,
    },
  }
  const initial = greetingOptions(next)[0]
  if (!existing && initial) next.history.push(openingMessage(next, initial))

  const updatedGroups: GroupChat[] = []
  if (existing) {
    for (const group of Object.values(runtime.state.chats)) {
      if (!group?.isGroup || !group.members?.some(member => member.id === id)) continue
      const members = group.members.map(member => member.id !== id ? member : {
        ...member, avatar: next.settings.aiAvatar, originalName: name,
        groupNickname: member.groupNickname === existing.name ? next.name : member.groupNickname,
      })
      updatedGroups.push({ ...group, members })
    }
  }

  const profile = {
    name: next.name,
    originalName: next.originalName,
    characterCard: next.characterCard,
  }
  const characterSettings = { aiPersona: draft.description, aiAvatar: next.settings.aiAvatar, linkedLoreBookIds, avatarGallery }
  await runtime.db.transaction('rw', runtime.db.chats, runtime.db.lorebooks, async tx => {
    if (existing) {
      const stored = await tx.chats.get(id)
      if (!stored) throw new Error('This character was deleted.')
      await tx.chats.update(id, { ...profile, settings: { ...(stored.settings as DirectChat['settings'] | undefined), ...characterSettings } })
    } else {
      await tx.chats.add(next)
    }
    for (const { id, members } of updatedGroups) await tx.chats.update(id, { members })
    if (lorebook) await tx.lorebooks.put(lorebook)
  })
  if (existing) {
    Object.assign(existing, profile)
    Object.assign(existing.settings, characterSettings)
  } else runtime.state.chats[id] = next
  for (const group of updatedGroups) {
    const current = runtime.state.chats[group.id]
    if (current?.isGroup) current.members = group.members
  }
  if (lorebook) (runtime.state.lorebooks ??= []).push(lorebook)
  void renderChatList()
  return id
}
