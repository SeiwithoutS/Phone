import { runtime } from '../../legacy/runtime/state.js'
import { requestContextCompletion, completionText } from '../api/completion'
import { characterPrompt } from '../characters/characters'
import type { DiaryEntry, DirectChat } from './model'

const favoritesFor = (chat: DirectChat, entry: DiaryEntry) =>
  ({ type: 'char_diary', 'content.characterId': chat.id, 'content.id': entry.id })

export async function isDiaryFavorite(chat: DirectChat, entry: DiaryEntry) {
  return Boolean(await runtime.db.favorites.where(favoritesFor(chat, entry)).first())
}

export async function toggleDiaryFavorite(chat: DirectChat, entry: DiaryEntry) {
  return runtime.db.transaction('rw', runtime.db.favorites, async tx => {
    const matching = tx.favorites.where(favoritesFor(chat, entry))
    if (await matching.first()) {
      await matching.delete()
      return false
    }
    await tx.favorites.add({
      type: 'char_diary', content: { ...entry, characterId: chat.id, characterName: chat.name }, timestamp: Date.now(),
    })
    return true
  })
}

async function updateDiary(chat: DirectChat, update: (entries: DiaryEntry[]) => DiaryEntry[]) {
  const diary = await runtime.db.transaction('rw', runtime.db.chats, async tx => {
    const current = await tx.chats.get(chat.id) as DirectChat | undefined
    if (!current || current.isGroup) throw new Error('This character is no longer available.')
    const diary = update(current.diary ?? [])
    await tx.chats.update(chat.id, { diary })
    return diary
  })
  chat.diary = diary
  return diary
}

export function deleteDiaryEntry(chat: DirectChat, id: DiaryEntry['id']) {
  return updateDiary(chat, entries => entries.filter(entry => entry.id !== id))
}

export async function generateDiary(chat: DirectChat, replace: boolean) {
  const nickname = runtime.state.qzoneSettings?.nickname
  const userDisplayNameForAI = !nickname || nickname === '{{user}}' ? 'the user' : nickname
  const userPersona = chat.settings.myPersona || '(not set)'
  const instructions = `
# Character diary
Portray "${chat.name}". ${replace ? 'Invent 5–8 recent diary entries.' : 'Write one new diary entry the character might write today.'} Draw on the character's persona, memories, and recent interactions. Each entry should contain personal feelings, thoughts, and secrets. Write in the first person when describing your own thoughts and actions. Use the language established by the character, user, and relevant context.

## Date and length
Today is ${new Date().toLocaleDateString('en-GB')}. Date each entry in its title. Use today or an earlier date. Never use a future date. Write at least 300 characters of body text for each entry.

## Output (highest priority)
Return only a valid JSON array, starting with [ and ending with ]. Omit surrounding prose, explanation, and Markdown fences.
[{"title":"September 20 — Sunny","content":"My entry text.\\nContinue here."}]
Refer to the user as "${userDisplayNameForAI}" in the entries. Never leave the literal placeholder "{{user}}" in an entry.
The user's persona is ${userPersona}.
${replace ? '' : 'The array must contain exactly one object.'}

## Diary formatting
Use the diary's Markdown syntax in "content" and escape line breaks with \\n.
- \`**bold text**\` for emphasis.
- \`~~crossed-out text~~\` for a change of mind or self-correction.
- \`!h{highlighted text}\` for keywords or important information.
- \`!u{underlined text}\` for a name, place, or special term.
- \`!e{emphasized text}\` for strong emotion.
- \`!w{handwritten text}\` for a quotation, lyric, or special note.
- \`!m{messy handwriting}\` for excitement, panic, or hurried notes.
- \`||redacted text||\` to hide a secret or sensitive phrase, 2–5 characters at a time.

## Context
- Your persona: ${characterPrompt(chat)}
- Recent conversation with "${userDisplayNameForAI}" and saved memories.
`;
  const response = await requestContextCompletion(chat, {
    instructions, task: 'QQ diary · ' + chat.name, scope: 'diary:' + chat.id,
    request: [{ role: 'user', content: replace ? 'Generate the diary entries in character.' : 'Write one new diary entry in character.' }],
  }, { signal: AbortSignal.timeout(120000) })
  if (!response.ok) throw new Error('The API returned HTTP ' + response.status + '.')
  const raw = completionText(await response.json()) ?? ''
  const array = raw.match(/\[[\s\S]*\]/)?.[0]
  let entries: unknown
  try { entries = JSON.parse(array ?? '') }
  catch { throw new Error('The AI reply did not contain a valid diary JSON array.') }
  if (!Array.isArray(entries) || !entries.length || (!replace && entries.length !== 1) ||
    !entries.every(entry => typeof entry?.title === 'string' && entry.title.trim() &&
      typeof entry?.content === 'string' && entry.content.trim())) {
    throw new Error('The AI returned incomplete diary entries.')
  }
  const timestamp = Date.now()
  const generated = entries.map(({ title, content }) => ({ id: crypto.randomUUID(), timestamp, title, content }))
  return updateDiary(chat, current => replace ? generated : [...current, ...generated])
}
