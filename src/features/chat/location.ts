const knownCities: Record<string, string> = {
  hanoi: 'Asia/Ho_Chi_Minh', 'ha noi': 'Asia/Ho_Chi_Minh',
  'ho chi minh': 'Asia/Ho_Chi_Minh', 'ho chi minh city': 'Asia/Ho_Chi_Minh',
  saigon: 'Asia/Ho_Chi_Minh', 'sai gon': 'Asia/Ho_Chi_Minh', 'da nang': 'Asia/Ho_Chi_Minh',
  'xi an': 'Asia/Shanghai', xian: 'Asia/Shanghai', beijing: 'Asia/Shanghai',
  guangzhou: 'Asia/Shanghai', shenzhen: 'Asia/Shanghai', seoul: 'Asia/Seoul',
  'new york city': 'America/New_York', 'washington dc': 'America/New_York',
}

export type LocationSettings = { location?: string; timeZone?: string }

export const timeZones = Intl.supportedValuesOf('timeZone')
const cityKey = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replaceAll('đ', 'd').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const zoneCities = new Map(timeZones.map(zone => [cityKey(zone.split('/').at(-1) ?? ''), zone]))

export function validTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone) return false
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true }
  catch { return false }
}

export function resolveTimeZone(location: unknown, override: unknown) {
  if (validTimeZone(override)) return { zone: override, source: 'manual' as const }
  const key = typeof location === 'string' ? cityKey(location.split(',')[0]) : ''
  const match = Object.hasOwn(knownCities, key) ? knownCities[key] : zoneCities.get(key)
  if (match) return { zone: match, source: 'city' as const }
  return { zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', source: 'device' as const }
}

export function localClock(timeZone: string, value: Date | number = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

export function localDateKey(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)?.value).join('-')
}

export function timeDifference(charZone: string, userZone: string, date = new Date()) {
  const offset = (zone: string) => {
    const text = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(date)
      .find(part => part.type === 'timeZoneName')?.value
    const parts = text?.match(/GMT([+-])(\d\d):(\d\d)/)
    return parts ? (parts[1] === '-' ? -1 : 1) * (Number(parts[2]) * 60 + Number(parts[3])) : 0
  }
  const difference = offset(charZone) - offset(userZone)
  if (!difference) return 'Same local time'
  const absolute = Math.abs(difference)
  const amount = [Math.floor(absolute / 60) ? Math.floor(absolute / 60) + 'h' : '', absolute % 60 ? absolute % 60 + 'm' : ''].filter(Boolean).join(' ')
  return amount + (difference > 0 ? ' ahead of your time' : ' behind your time')
}
