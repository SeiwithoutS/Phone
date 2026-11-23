import { runtime } from '../../legacy/runtime/state.js'
import { loreContext } from '../world-book/lore-storage'
import { filterVisiblePostsForAI } from '../../legacy/chat/sharing.js'
import { budgetSources, buildContext, contextKey, normalizeContext, wholeSources } from './budget'
import type { ContextConfig, ContextFull, ContextItem, ContextItems, ContextPlan, PromptMessage, Source } from './budget'
import type { ChatMessage, DirectChat, GroupChat } from '../chat/model'
import type { LocalDatabase } from '../../storage/database'
import type { ActorProfile, Post } from '../social/social'

type Chat = DirectChat | GroupChat
type TextBook = { id: string | number; name?: string; content?: Array<{ enabled?: boolean; content?: string; comment?: string }> }
type Npc = { id: string | number; name: string; persona?: string; associatedWith?: string[]; includeInContext?: boolean }
type Memory = { timestamp?: number; content?: string }
type QzonePost = { id: number; timestamp?: number; authorId: string; authorOriginalName?: string; content?: string;
  publicText?: string; hiddenContent?: string; imageDescription?: string; isDeleted?: boolean;
  comments?: Array<{ timestamp?: number; commenterName?: string; text?: string; meaning?: string }> }
export type ContextInput = {
  instructions: string; history?: PromptMessage[]; request?: PromptMessage[]; activity?: string[]
  extraMessages?: ChatMessage[]; rawHistory?: ChatMessage[]; task?: string; scope?: string
  excludePostId?: string; actorId?: string; standalone?: boolean; excludeLegacyFeed?: boolean
  legacyPostIds?: number[]; relatedChatIds?: string[]
  includeOnly?: Source[]
}
type Recorded = { plan: ContextPlan; task: string; at: number }
const records = new Map<string, Recorded>()

export function lastContext(scope: string) { return records.get(scope) }
export function recentContexts() { return [...records.entries()].reverse() }
export const chatContextScope = (chat: Chat) => 'chat:' + chat.id + ':' + (chat.conversationId ?? 'original')

export function recordContext(scope: string, plan: ContextPlan, task: string) {
  records.delete(scope)
  records.set(scope, { plan, task, at: Date.now() })
  if (records.size > 6) records.delete(records.keys().next().value!)
}

export function contextConfig(database = runtime.db) {
  return normalizeContext(database?.getPreference(contextKey))
}

const prefix = (heading: string, data: unknown): ContextItem => ({ message: { role: 'system', content: '[' + heading + ']\n' + JSON.stringify(data) } })
const chronological = (items: ContextItem[]) => items.sort((a, b) => (a.time ?? 0) - (b.time ?? 0))

function fullText(books: TextBook[]) {
  return books.flatMap(book => {
    const entries = book.content?.filter(entry => entry.enabled !== false && typeof entry.content === 'string' && entry.content.trim()) ?? []
    return entries.length ? [[book.name, ...entries.map(entry => [entry.comment, entry.content].filter(Boolean).join('\n'))].filter(Boolean).join('\n\n')] : []
  }).join('\n\n')
}

function fullSources(chat: Chat | undefined, rawHistory: ChatMessage[], extraMessages: ChatMessage[], config: ContextConfig): ContextFull {
  const miniIds = new Set((chat?.settings.linkedWorldBookIds as Array<string | number> | undefined ?? []).map(String))
  const miniPrompts = (runtime.state.worldBooks ?? []).filter(book => miniIds.has(String(book.id)))
  const presetId = config.presetId ?? (chat?.settings.isOfflineMode === true ? chat.settings.offlinePresetId : undefined)
  const preset = (runtime.state.presets ?? []).find(item => String(item.id) === String(presetId))
  return {
    worldInfo: chat ? loreContext({ settings: chat.settings, history: rawHistory }, extraMessages).replace(/^\n# World Info\n/, '') : '',
    miniPrompts: fullText(miniPrompts), preset: preset ? fullText([preset]) : '',
  }
}

function actorsForPost(post: Post) { return [post.authorId].filter((id): id is string => Boolean(id)) }

async function socialItems(database: LocalDatabase, chat: Chat | undefined, input: ContextInput, includeFeed: boolean) {
  const [allPosts, allProfiles, allNpcs, legacyPosts] = await Promise.all([
    includeFeed && !input.legacyPostIds ? database.socialPosts.orderBy('time').toArray() : [],
    database.socialProfiles.toArray(), database.npcs.toArray(),
    includeFeed && (chat || input.legacyPostIds) && !input.excludeLegacyFeed ? database.qzonePosts.orderBy('timestamp').toArray() : [],
  ])
  const posts: ContextItem[] = []
  const comments: ContextItem[] = []
  const profiles = new Map((allProfiles as ActorProfile[]).map(profile => [profile.id, profile]))
  const npcs = new Map((allNpcs as Npc[]).map(npc => ['npc:' + npc.id, npc]))
  const linkedIds = new Set([chat?.id, ...(chat?.isGroup ? (chat.members ?? []).map(member => member.id) : [])].filter(Boolean))
  const engaged = new Map<string, number>()
  for (const post of allPosts as Post[]) {
    const time = post.time || 0
    const actorIds = actorsForPost(post)
    for (const id of actorIds) engaged.set(id, time)
    const photos = (post.photos ?? []).map(photo => photo.description).filter(Boolean)
    const lastActivity = Math.max(time, ...(post.comments ?? []).map(comment => comment.time ?? 0))
    if (post.id !== input.excludePostId) posts.push({ ...prefix('Social post', { id: post.id, author: post.author, actorId: post.authorId, text: post.text, photos }), time: lastActivity, actorIds })
    for (const comment of post.comments ?? []) {
      const commenter = comment.actorId ?? (comment.ai ? [...npcs].find(([, npc]) => npc.name === comment.author)?.[0] : undefined)
      const commentTime = comment.time || time
      if (commenter) engaged.set(commenter, Math.max(engaged.get(commenter) ?? 0, commentTime))
      comments.push({ ...prefix('Social comment', { postId: post.id, postAuthor: post.author, author: comment.author,
        actorId: commenter, text: comment.text }), time: commentTime, actorIds: [...actorIds, ...(commenter ? [commenter] : [])] })
    }
  }
  const legacyActor = (name?: string) => name ? [...npcs].find(([, npc]) => npc.name === name)?.[0] : undefined
  const viewers = chat?.isGroup ? (chat.members ?? []).flatMap(member => {
    const contact = runtime.state.chats[member.id]
    return contact ? [contact] : []
  }) : chat ? [chat] : []
  let visible = (legacyPosts as QzonePost[]).filter(post => !post.isDeleted)
  if (input.legacyPostIds) {
    const ids = new Set(input.legacyPostIds)
    visible = visible.filter(post => ids.has(post.id))
  }
  for (const viewer of viewers) visible = filterVisiblePostsForAI(visible, viewer) as QzonePost[]
  for (const post of viewers.length || input.legacyPostIds ? visible : []) {
    const time = post.timestamp ?? 0
    const id = post.authorId?.startsWith('npc_') ? 'npc:' + post.authorId.slice(4) : undefined
    if (id) engaged.set(id, Math.max(engaged.get(id) ?? 0, time))
    const author = post.authorOriginalName || runtime.state.chats[post.authorId]?.name || (post.authorId === 'user' ? 'User' : post.authorId)
    const body = post.publicText || (typeof post.content === 'string' && !/^data:/i.test(post.content) ? post.content : '')
    posts.push({ ...prefix('Qzone post', { id: post.id, author, text: body, photo: post.imageDescription || post.hiddenContent }), time,
      actorIds: id ? [id] : [] })
    for (const comment of post.comments ?? []) {
      if (!comment?.commenterName) continue
      const actor = legacyActor(comment.commenterName)
      const at = comment.timestamp ?? time
      if (actor) engaged.set(actor, Math.max(engaged.get(actor) ?? 0, at))
      const text = comment.meaning || (typeof comment.text === 'string' && !/^data:/i.test(comment.text) ? comment.text : '[Attachment]')
      comments.push({ ...prefix('Qzone comment', { postId: post.id, author: comment.commenterName, text }), time: at, actorIds: actor ? [actor] : [] })
    }
  }
  const actors: ContextItem[] = []
  const contacts = new Set((input.relatedChatIds ?? []).map(id => 'character:' + id))
  for (const id of new Set([...engaged.keys(), ...npcs.keys(), ...contacts])) {
    const npc = npcs.get(id)
    if (npc?.includeInContext === false) continue
    const character = id.startsWith('character:') ? runtime.state.chats[id.slice('character:'.length)] : undefined
    const profile = profiles.get(id)
    const associated = npc?.associatedWith?.some(id => linkedIds.has(id)) || contacts.has(id)
    if ((!associated && !engaged.has(id)) || (!profile && !npc && !character)) continue
    actors.push({ ...prefix('Social identity', { id, name: profile?.name || npc?.name || character?.name, handle: profile?.handle,
      bio: profile?.bio, persona: npc?.persona || character?.settings.aiPersona }),
      time: associated ? Number.MAX_SAFE_INTEGER : engaged.get(id), actorIds: associated ? undefined : [id] })
  }
  return { posts: chronological(posts), comments: chronological(comments), npcs: chronological(actors) }
}

export function chatHistoryMessages(chat: Chat, history: ChatMessage[] = chat.history): PromptMessage[] {
  return history.filter(message => !message.isTemporary).flatMap(message => {
    const source = typeof message.content === 'string' ? message.content : ''
    const text = message.type === 'share_card' ? '[Shared item]' :
      message.meaning ? '[Sticker: ' + message.meaning + ']' :
      Array.isArray(message.content) ? '[Photo: ' + (message.imageDescription || 'No description') + ']' :
      /^data:/i.test(source) ? '[Attachment]' : source
    return text ? [{ role: message.role === 'ai' ? 'assistant' : message.role,
      content: (chat.isGroup && message.senderName ? message.senderName + ': ' : '') + text }] : []
  })
}

export function latestUserTurn(messages: PromptMessage[]) {
  const previousReply = messages.findLastIndex(message => message.role === 'assistant' || message.role === 'ai')
  const lastUser = messages.findLastIndex(message => message.role === 'user')
  return lastUser > previousReply ? { history: [...messages.slice(0, lastUser), ...messages.slice(lastUser + 1)], request: [messages[lastUser]!] }
    : { history: messages, request: [] }
}

export async function assembleContext(chat: Chat | undefined, input: ContextInput, database = runtime.db, config: ContextConfig = contextConfig(database)) {
  if (input.standalone) return buildContext(config, input.instructions, {}, {}, input.request)
  if (input.includeOnly) {
    const sources = { ...config.sources }
    for (const source of [...budgetSources, ...wholeSources]) {
      if (!input.includeOnly.includes(source)) sources[source] = { ...sources[source], enabled: false }
    }
    config = { ...config, sources }
  }
  const rawHistory = input.rawHistory ?? chat?.history ?? []
  const history = input.history ?? (chat ? chatHistoryMessages(chat, rawHistory) : [])
  const items: ContextItems = {
    qq: history.map(message => ({ message })),
    memory: chronological(((chat?.longTermMemory ?? []) as Memory[]).filter(memory => memory.content)
      .map(memory => ({ ...prefix('Saved memory', memory.content), time: memory.timestamp }))),
    activity: (input.activity ?? []).filter(value => value.trim()).map(value => ({ message: { role: 'system', content: value.trim() } })),
  }
  if (database && ['posts', 'comments', 'npcs'].some(key => config.sources[key as 'posts' | 'comments' | 'npcs'].enabled)) {
    Object.assign(items, await socialItems(database, chat, input, config.sources.posts.enabled || config.sources.comments.enabled))
  }
  return buildContext(config, input.instructions, fullSources(chat, rawHistory, input.extraMessages ?? [], config), items, input.request)
}
