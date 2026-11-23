import type { DirectChat, GroupChat } from './model'

export const chatFeatureSwitches = {
  'chat-social-posts': ['allowSocialPosts', true],
  'chat-store-purchases': ['allowStorePurchases', false],
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
  if (!chat || chat.isGroup) return ''
  const settings = chat.settings
  const context: string[] = []
  if (settings.allowSocialPosts === false) context.push('Do not create or repost Social posts for this character.')
  if (interactive && settings.allowStorePurchases === true) {
    context.push('A fictional self-purchase can be recorded as {"type":"store_purchase","itemName":"item","itemPrice":12.50,"reason":"reason"} when appropriate. The record appears in Cphone Shopping.')
  }
  if (settings.showCharacterStatus === false) context.push('Omit update_status actions.')
  if (typeof settings.characterLocation === 'string' && settings.characterLocation) context.push('Character location: ' + settings.characterLocation)
  if (settings.holidayAwareness === true) {
    let today: string
    try {
      today = new Intl.DateTimeFormat('sv-SE', { timeZone: String(settings.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone),
        year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    } catch { today = new Date().toISOString().slice(0, 10) }
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

export function recordStorePurchase(chat: DirectChat, action: {
  itemName?: unknown; itemPrice?: unknown; reason?: unknown; image_prompt?: unknown
}) {
  const name = typeof action.itemName === 'string' ? action.itemName.trim().slice(0, 120) : ''
  const price = Number(action.itemPrice)
  if (chat.settings.allowStorePurchases !== true || !name || !Number.isFinite(price) || price < 0 || price > 1000000) return
  const current = chat.storePurchases as Record<string, unknown>[] | undefined
  chat.storePurchases = [{
    itemName: name, name, status: 'Purchased', price: Math.round(price * 100) / 100, timestamp: Date.now(),
    reason: typeof action.reason === 'string' ? action.reason.slice(0, 240) : '',
    image_prompt: typeof action.image_prompt === 'string' ? action.image_prompt.slice(0, 180) : '',
  }, ...(current || [])].slice(0, 100)
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
