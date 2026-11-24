import { localClock } from './location'

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'always' })
const monthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const fullDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })

export function formatTimeAgo(timestamp: number) {
  if (!Number.isFinite(timestamp)) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return relativeTime.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return relativeTime.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 30) return relativeTime.format(-days, 'day')
  if (days < 365) return relativeTime.format(-Math.floor(days / 30), 'month')
  return relativeTime.format(-Math.floor(days / 365), 'year')
}

export function formatTimestamp(timestamp: number) {
  if (!timestamp || !Number.isFinite(timestamp)) return ''
  const date = new Date(timestamp)
  return [date.getHours(), date.getMinutes()].map(value => String(value).padStart(2, '0')).join(':')
}

function datedTime(timestamp: number, labelToday: boolean) {
  const time = formatTimestamp(timestamp)
  if (!time) return ''
  const date = new Date(timestamp)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return labelToday ? `Today ${time}` : time
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`
  const formatter = date.getFullYear() === today.getFullYear() ? monthDay : fullDate
  return `${formatter.format(date)} ${time}`
}

export const formatTimestampForAI = (timestamp: number, timeZone?: string) =>
  timeZone && Number.isFinite(timestamp) ? localClock(timeZone, timestamp) : datedTime(timestamp, true)
export const formatSystemTimestamp = (timestamp: number) => datedTime(timestamp, false)

export function getTimeOfDayGreeting(date = new Date(), timeZone?: string) {
  const hour = timeZone
    ? Number(new Intl.DateTimeFormat('en', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date))
    : date.getHours()
  if (hour < 5) return 'Late night'
  if (hour < 9) return 'Early morning'
  if (hour < 13) return 'Midday'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}

export function createSystemTimestampElement(timestamp: number) {
  const wrapper = document.createElement('div')
  wrapper.className = 'message-wrapper system-pat'
  const bubble = document.createElement('div')
  bubble.className = 'message-bubble system-bubble'
  bubble.textContent = formatSystemTimestamp(timestamp)
  wrapper.append(bubble)
  return wrapper
}
