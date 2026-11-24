import { useEffect, useRef, useState } from 'react'
import { localClock, resolveTimeZone, timeZones, validTimeZone } from './location'
import type { LocationSettings } from './location'

export function readLocationFields(prefix: string): Required<LocationSettings> {
  const city = document.getElementById(prefix + '-city') as HTMLInputElement | null
  const zone = (document.getElementById(prefix + '-zone') as HTMLSelectElement | null)?.value
  return { location: city?.value.trim() ?? '', timeZone: validTimeZone(zone) ? zone : '' }
}

export function setLocationFields(prefix: string, data: LocationSettings) {
  document.getElementById(prefix)?.dispatchEvent(new CustomEvent('eephone:location', { detail: data }))
}

export function LocationFields({ prefix, cityLabel, zoneLabel, initial, hideCity = false }: {
  prefix: string
  cityLabel: string
  zoneLabel: string
  initial?: LocationSettings
  hideCity?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const [city, setCity] = useState(initial?.location ?? '')
  const [manual, setManual] = useState(validTimeZone(initial?.timeZone) ? initial.timeZone : '')
  const [filter, setFilter] = useState('')
  useEffect(() => {
    const element = root.current
    const update = (event: Event) => {
      const settings = (event as CustomEvent<LocationSettings>).detail
      setCity(settings.location ?? '')
      setManual(validTimeZone(settings.timeZone) ? settings.timeZone : '')
      setFilter('')
    }
    element?.addEventListener('eephone:location', update)
    return () => element?.removeEventListener('eephone:location', update)
  }, [])

  const { zone, source } = resolveTimeZone(hideCity ? '' : city, manual)
  const term = filter.trim().toLowerCase().replaceAll(' ', '_')
  const zones = timeZones.filter(item => item === manual || item.toLowerCase().includes(term))
  if (manual && !zones.includes(manual)) zones.unshift(manual)

  return <div id={prefix} ref={root} className="location-fields">
    {!hideCity && <label htmlFor={prefix + '-city'}>{cityLabel}
      <input id={prefix + '-city'} type="text" maxLength={100} value={city}
        onChange={event => setCity(event.target.value)} placeholder="e.g. Hanoi, Berlin" />
    </label>}
    <div className="location-zone">
      <label htmlFor={prefix + '-zone'}>{zoneLabel}</label>
      <input type="search" aria-label={'Filter ' + zoneLabel.toLowerCase()} value={filter}
        onChange={event => setFilter(event.target.value)} placeholder="Filter time zones" />
      <select id={prefix + '-zone'} value={manual} onChange={event => setManual(event.target.value)}>
        <option value="">Automatic (city or device)</option>
        {zones.map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
      </select>
      <small>{zone} · {localClock(zone)}{source === 'device' ? ' · Device time zone' : source === 'city' ? ' · From city' : ''}</small>
    </div>
  </div>
}
