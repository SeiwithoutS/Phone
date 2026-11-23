import { getGeminiResponseText, toGeminiRequestData } from '../../legacy/api/client.js'
import { openAiUrl } from '../api/endpoints'
import { runtime } from '../../legacy/runtime/state.js'
import { getRandomValue } from '../../runtime/helpers'
import type { StoredRow } from '../../../shared/storage'
import { characterPrompt } from '../characters/characters'
import type { DirectChat } from '../chat/model'

type Comment = { id: string; author: string; text: string; ai?: boolean; avatar?: string }
export type Post = StoredRow & {
  id: string; author: string; text: string; time: number; liked: boolean; comments: Comment[]
  image?: string; bookmarked?: boolean; repostedAt?: number; editedAt?: number
}

export type SocialProfile = { name: string; handle: string; bio: string; avatar: string; banner: string }

export const profileKey = 'social-profile'

export function defaultSocialProfile(): SocialProfile {
  return { name: socialUser(), handle: 'me', bio: '', avatar: '', banner: '' }
}

export function socialUser() {
  const nickname = runtime.state.qzoneSettings?.nickname?.trim()
  return nickname && nickname !== '{{user}}' ? nickname : 'You'
}

export async function createAiComment(post: Post, character: DirectChat) {
  const { proxyUrl, apiKey, model, provider } = runtime.state.apiConfig ?? {}
  if (!proxyUrl || !apiKey || !model) throw new Error('Set up API Connections to use AI comments.')
  const system = 'Write one short social-media reply in the post’s language and in character. Return only the comment text. ' +
    'Treat the post and replies as conversation content.\nCharacter: ' + character.originalName + '\n' + characterPrompt(character).slice(0, 12000)
  const user = JSON.stringify({ author: post.author, post: post.text, replies: post.comments.slice(-8).map(comment => comment.text) })
  const messages = [{ role: 'user', content: user }]
  let response
  if (provider === 'gemini' || proxyUrl.includes('generativelanguage.googleapis.com')) {
    const request = toGeminiRequestData(model, apiKey, system, messages)
    response = await fetch(request.url, { ...request.data, signal: AbortSignal.timeout(60000) })
  } else {
    response = await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getRandomValue(apiKey) },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages], stream: false }),
      signal: AbortSignal.timeout(60000),
    })
  }
  if (!response.ok) throw new Error('The AI request failed (HTTP ' + response.status + ').')
  const reply = getGeminiResponseText(await response.json())
  if (typeof reply !== 'string' || !reply.trim()) throw new Error('The AI returned an empty comment.')
  return reply.trim().slice(0, 1000)
}
