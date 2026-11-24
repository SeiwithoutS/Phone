import type { DirectChat, GroupChat } from './model'
import { localClock, localDateKey, resolveTimeZone, timeDifference } from './location'

export const chatFeatureSwitches = {
  'chat-social-posts': ['allowSocialPosts', true],
  'chat-store-purchases': ['allowStorePurchases', false],
  'chat-bank-transfers': ['allowBankTransfers', true],
  'chat-live-status': ['showCharacterStatus', true],
  'chat-auto-messages': ['scheduledMessages', false],
  'chat-holiday-awareness': ['holidayAwareness', false],
} as const

export function parseCalendarDates(value: string) {
  return value.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const [date, type, ...nameParts] = line.split(',').map(part => part.trim())
    const name = nameParts.join(', ')
    const millis = Date.parse(date + 'T00:00:00Z')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(millis) ||
       new Date(millis).toISOString().slice(0, 10) !== date || !['holiday', 'workday'].includes(type) || !name) {
      throw new Error('Use a valid YYYY-MM-DD date, holiday or workday, and a name on each calendar line.')
    }
    return { date, type, name }
  })
}

export function chatFeatureContext(chat: DirectChat | GroupChat | undefined, interactive: boolean) {
  if (!chat) return ''
  const settings = chat.settings
  const context: string[] = []
  const charZone = resolveTimeZone(chat.isGroup ? '' : settings.characterLocation, settings.timeZone).zone
  const userZone = resolveTimeZone(settings.userLocation, settings.userTimeZone).zone
  if (!chat.isGroup && settings.characterLocation) context.push('Character location: ' + settings.characterLocation)
  if (settings.userLocation) context.push('User location: ' + settings.userLocation)
  if (settings.enableTimePerception && (settings.userLocation || settings.userTimeZone || charZone !== userZone)) {
    const now = new Date()
    context.push('User local time: ' + localClock(userZone, now) + ' (' + userZone + '). ' +
      (chat.isGroup ? 'Group clock (' : 'Character clock (') + charZone + '): ' + timeDifference(charZone, userZone, now) + '.')
  }
  if (chat.isGroup) return context.join('\n')
  if (settings.allowSocialPosts === false) context.push('Do not create or repost Social posts for this character.')
  if (settings.showCharacterStatus === false) context.push('Omit update_status actions.')
  if (settings.holidayAwareness === true) {
    const today = localDateKey(charZone)
    let entries: ReturnType<typeof parseCalendarDates> = []
    try { entries = parseCalendarDates(String(settings.holidayDates || '')) } catch { /* old malformed values have no usable entries */ }
    const day = entries.filter(entry => entry.date === today)
    const next = entries.filter(entry => entry.date > today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)
    context.push('Local date: ' + today + '. Calendar entries (holiday = day off, workday = adjusted working day): ' +
      ([...day, ...next].map(entry => entry.date + ' ' + entry.type + ' ' + entry.name).join('; ') || 'No local calendar entries are configured for today or later.'))
  }
  if (Array.isArray(chat.chatTasks) && chat.chatTasks.length > 0) {
    context.push('Shared to-do list: ' + JSON.stringify(chat.chatTasks.slice(-20).map(task =>
      ({ text: task.text, owner: task.owner, done: task.done }))))
  }

  if (interactive) {
    const polls = chat.history.filter(message => message.type === 'poll').slice(-5)
    if (polls.length) {
      const active = polls.flatMap(message => {
        const poll = message as typeof message & { question?: string; options?: string[]; isClosed?: boolean }
        return poll.isClosed ? [] : [{ timestamp: poll.timestamp, question: poll.question, options: poll.options }]
      })
      if (active.length) context.push('Open polls: ' + JSON.stringify(active) +
        '. To vote when appropriate, use {"type":"vote","poll_timestamp":123,"choice":"one of the listed options"}.')
    }
  }
  return context.join('\n')
}

type Votes = Record<string, string[]>

export function pollVotes(votes: Votes | undefined, option: string) {
  return votes && Object.hasOwn(votes, option) && Array.isArray(votes[option]) ? votes[option] : []
}

export function recordVote(votes: Votes | undefined, choice: string, voter: string, withdraw = false): Votes {
  const options = new Map(Object.entries(votes || {}).filter(([, voters]) => Array.isArray(voters))
    .map(([option, voters]) => [option, voters.filter(name => name !== voter)]))
  if (!withdraw) options.set(choice, [...(options.get(choice) || []), voter])
  return Object.fromEntries(options)
}
