import type { LocalDatabase } from '../../storage/database'

export type ReplyRules = { minimum: number; maximum: number; style: string }

export const defaultReplyRules: Readonly<ReplyRules> = {
  minimum: 3, maximum: 10, style: 'Chat like a real person.',
}

export function validReplyRange(minimum: number, maximum: number) {
  return Number.isSafeInteger(minimum) && Number.isSafeInteger(maximum) && minimum >= 1 && maximum >= minimum
}

const replyRulesKey = (characterId?: string) =>
  characterId ? 'qq-online-reply-rules:' + characterId : 'qq-online-reply-rules'

export function savedReplyRules(database: LocalDatabase, characterId?: string): ReplyRules | undefined {
  const saved = database.getPreference(replyRulesKey(characterId))
  if (!saved || typeof saved !== 'object') return
  const { minimum, maximum, style } = saved as Partial<ReplyRules>
  if (typeof minimum === 'number' && typeof maximum === 'number' && validReplyRange(minimum, maximum) && typeof style === 'string') {
    return { minimum, maximum, style }
  }
}

export function effectiveReplyRules(database: LocalDatabase, characterId: string) {
  return savedReplyRules(database, characterId) ?? savedReplyRules(database) ?? defaultReplyRules
}

export async function saveReplyRules(database: LocalDatabase, rules: ReplyRules | undefined, characterId?: string) {
  const id = replyRulesKey(characterId)
  if (!rules) {
    await database.deviceSettings.delete(id)
    return
  }
  if (!validReplyRange(rules.minimum, rules.maximum)) throw new Error('Enter a valid reply length range.')
  await database.deviceSettings.put({ id, value: { ...rules, style: rules.style.trim() } })
}

export function replyRhythm({ minimum, maximum, style }: Readonly<ReplyRules> = defaultReplyRules) {
  const instructions = style.trim()
  const useDefaultRhythm = instructions === defaultReplyRules.style
  const messageLength = useDefaultRhythm ? 'short ' : ''
  const count = minimum === maximum
    ? `Write ${minimum} ${messageLength}${minimum === 1 ? 'message' : 'messages'} per reply.`
    : `Split what you want to say into ${minimum}-${maximum} ${messageLength}messages per reply${useDefaultRhythm
      ? ' and vary the number from one reply to the next' : ''}.`
  return [instructions, count, 'Keep the interaction online and do not develop an offline storyline.'].filter(Boolean).join(' ')
}
