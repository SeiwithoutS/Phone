import { createAiComment, createAiPost, createAiProfile, socialActors } from './social'
import type { ActorProfile, Post, SocialActor, SocialNotification } from './social'
import type { LocalDatabase } from '../../storage/database'

const preferencesKey = 'social-ai-comments'
const defaultPostMinutes = 60
export const maxPostMinutes = 10080
const postInterval = (minutes: number) => minutes * 60000
const retryInterval = 5 * 60 * 1000

type SocialSettings = { ai: boolean; autoPost: boolean; actorId: string; nextPostAt: number; postEveryMinutes: number }
const listeners = new Set<() => void>()
const profilesPending = new Map<string, Promise<ActorProfile>>()
const pendingComments = new Set<string>()
const pendingPosts = new WeakSet<LocalDatabase>()
let activityError = ''

export function subscribeSocial(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function refreshSocial() {
  listeners.forEach(listener => listener())
}

export const isCommentPending = (postId: string) => pendingComments.has(postId)
export const getSocialActivityError = () => activityError
export const isSocialPostPending = (database: LocalDatabase) => pendingPosts.has(database)

function validPostMinutes(minutes: unknown): minutes is number {
  return typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= 1 && minutes <= maxPostMinutes
}

export function readSocialSettings(database: LocalDatabase): SocialSettings {
  const saved = database.getPreference(preferencesKey) as (Partial<SocialSettings> & { characterId?: string }) | null
  return {
    ai: saved?.ai === true,
    autoPost: saved?.autoPost === true,
    actorId: saved?.actorId ?? (saved?.characterId ? 'character:' + saved.characterId : ''),
    nextPostAt: saved?.nextPostAt ?? 0,
    postEveryMinutes: validPostMinutes(saved?.postEveryMinutes) ? saved.postEveryMinutes : defaultPostMinutes,
  }
}

export async function saveSocialSettings(database: LocalDatabase, change: Partial<SocialSettings>) {
  const settings = await database.transaction('rw', database.deviceSettings, async tx => {
    const previous = readSocialSettings(database)
    const next = { ...previous, ...change }
    if (!validPostMinutes(next.postEveryMinutes)) throw new Error('Enter a whole number of minutes from 1 to ' + maxPostMinutes + '.')
    if (!next.autoPost) next.nextPostAt = 0
    else if (!previous.autoPost || previous.actorId !== next.actorId || previous.postEveryMinutes !== next.postEveryMinutes) {
      next.nextPostAt = Date.now() + postInterval(next.postEveryMinutes)
    }
    await tx.deviceSettings.put({ id: preferencesKey, value: next })
    return next
  })
  activityError = ''
  refreshSocial()
  return settings
}

export async function ensureActorProfile(database: LocalDatabase, actor: SocialActor) {
  const existing = await database.socialProfiles.get(actor.id) as ActorProfile | undefined
  if (existing) return existing
  const pending = profilesPending.get(actor.id)
  if (pending) return pending
  const work = (async () => {
    const profile = await createAiProfile(actor)
    const stored = await database.transaction('rw', database.socialProfiles, async tx => {
      const saved = await tx.socialProfiles.get(actor.id) as ActorProfile | undefined
      if (saved) return saved
      const handles = new Set((await tx.socialProfiles.toArray()).map(row => row.handle))
      handles.add('me')
      let handle = profile.handle
      for (let suffix = 2; handles.has(handle); suffix++) {
        const ending = '_' + suffix
        handle = profile.handle.slice(0, 24 - ending.length) + ending
      }
      const result = { ...profile, handle, id: actor.id }
      await tx.socialProfiles.add(result)
      return result
    })
    refreshSocial()
    return stored
  })()
  profilesPending.set(actor.id, work)
  try { return await work }
  finally { profilesPending.delete(actor.id) }
}

function chosenActor(actors: SocialActor[], actorId: string) {
  return actorId ? actors.find(actor => actor.id === actorId) : actors[0]
}

function notification(post: Post, actor: SocialActor, author: { name: string; avatar?: string },
  type: SocialNotification['type'], text: string): SocialNotification {
  return { id: crypto.randomUUID(), actorId: actor.id, actorName: author.name, avatar: author.avatar,
    postId: post.id, type, preview: text.slice(0, 180), time: Date.now() }
}

export async function generateSocialComment(database: LocalDatabase, postId: string) {
  const settings = readSocialSettings(database)
  if (!settings.ai || pendingComments.has(postId)) return
  pendingComments.add(postId)
  refreshSocial()
  try {
    const post = await database.socialPosts.get(postId) as Post | undefined
    if (!post || post.authorId || post.comments.some(comment => comment.ai)) return
    const actor = chosenActor(await socialActors(database), settings.actorId)
    if (!actor) throw new Error('Choose an available character or NPC in Social settings.')
    const author = await database.socialProfiles.get(actor.id) as ActorProfile | undefined ?? actor
    const text = await createAiComment(post, actor)
    await database.transaction('rw', database.socialPosts, database.socialNotifications, async tx => {
      const current = readSocialSettings(database)
      if (!current.ai || current.actorId !== settings.actorId) return
      const latest = await tx.socialPosts.get(post.id) as Post | undefined
      if (!latest || latest.comments.some(comment => comment.ai)) return
      const comments = [...latest.comments, { id: crypto.randomUUID(), author: author.name, actorId: actor.id,
        text, ai: true, avatar: author.avatar, time: Date.now() }]
      await tx.socialPosts.update(post.id, { comments })
      await tx.socialNotifications.add(notification(post, actor, author, 'comment', text))
    })
  } finally {
    pendingComments.delete(postId)
    refreshSocial()
  }
}

export async function publishActorPost(database: LocalDatabase, actorId: string, schedule?: SocialSettings) {
  if (pendingPosts.has(database)) return
  pendingPosts.add(database)
  refreshSocial()
  try {
    const actor = chosenActor(await socialActors(database), actorId)
    if (!actor) throw new Error('Choose an available character or NPC in Social settings.')
    const profile = await ensureActorProfile(database, actor)
    const text = await createAiPost(actor, profile)
    return await database.transaction('rw', database.socialPosts, database.socialNotifications, database.deviceSettings, async tx => {
      const current = readSocialSettings(database)
      if (schedule && (!current.autoPost || current.actorId !== schedule.actorId || current.nextPostAt !== schedule.nextPostAt ||
        current.postEveryMinutes !== schedule.postEveryMinutes)) return
      const post: Post = { id: crypto.randomUUID(), author: profile.name, authorId: actor.id,
        text, time: Date.now(), liked: false, comments: [] }
      await tx.socialPosts.add(post)
      await tx.socialNotifications.add(notification(post, actor, profile, 'post', text))
      if (schedule) await tx.deviceSettings.put({ id: preferencesKey, value: {
        ...current, nextPostAt: post.time + postInterval(current.postEveryMinutes),
      } })
      return post
    })
  } finally {
    pendingPosts.delete(database)
    refreshSocial()
  }
}

export function startSocialActivity(database: LocalDatabase) {
  let running = false
  let retryAt = 0
  async function tick() {
    if (running || pendingPosts.has(database) || retryAt > Date.now()) return
    const settings = readSocialSettings(database)
    if (!settings.autoPost || settings.nextPostAt > Date.now()) return
    running = true
    try {
      await publishActorPost(database, settings.actorId, settings)
      activityError = ''
    } catch (error) {
      activityError = error instanceof Error ? error.message : 'Could not generate a post.'
      retryAt = Date.now() + retryInterval
    } finally {
      running = false
      refreshSocial()
    }
  }
  const timer = window.setInterval(() => void tick(), 30000)
  window.addEventListener('focus', tick)
  void tick()
  return () => {
    window.clearInterval(timer)
    window.removeEventListener('focus', tick)
  }
}
