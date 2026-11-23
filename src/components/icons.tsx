import type { ComponentPropsWithoutRef } from 'react'

const arrowIntoTray = 'M12 4v12m-4-4 4 4 4-4M4 16v4h16v-4'
const arrowOutOfTray = 'M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5'

export const iconPaths = {
  back: 'm14 6-6 6 6 6',
  next: 'm10 6 6 6-6 6',
  close: 'm6 6 12 12M18 6 6 18',
  reset: 'M3 11a9 9 0 1 1 2.5 7M3 5v6h6',
  volume: 'M3 9h4l5-4v14l-5-4H3zm12 0a4.5 4.5 0 0 1 0 6m3-9a8 8 0 0 1 0 12',
  play: 'M7 4v16l13-8Z',
  check: 'm5 12 5 5L20 7',
  menu: 'M4 6h16M4 12h16M4 18h16',
  smile: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 10h.01m8 0h.01M8.5 14a4 4 0 0 0 7 0',
  camera: 'M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1Zm11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  mic: 'M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0Zm-3 5v1a6 6 0 0 0 12 0v-1m-6 7v3m-3 0h6',
  bag: 'm4 8-1 12h18L20 8ZM9 9V6a3 3 0 0 1 6 0v3',
  video: 'M3 6h12v12H3zm12 4 6-3v10l-6-3',
  users: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m10-13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm4 7a4 4 0 0 1 4 4v2M16 4a3 3 0 0 1 0 6',
  link: 'm10 13 4-4m-6 6-1 1a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m2 0 1-1a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0',
  game: 'M4 4h16v16H4zm5 0v16m6-16v16M4 9h16M4 15h16',
  book: 'M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14',
  bank: 'm3 9 9-5 9 5M4 20h16M6 11v6m6-6v6m6-6v6',
  gift: 'M3 9h18v4H3zm2 4v7h14v-7M12 9v11m0-11c-2-7-9-5-6-1 1 1 4 1 6 1 2 0 5 0 6-1 3-4-4-6-6 1Z',
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  grid: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',
  drag: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  checklist: 'M9 6h12M9 12h12M9 18h12M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2',
  pin: 'M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  plus: 'M12 5v14M5 12h14',
  edit: 'm14 6 4 4M4 20l4-.8L20 7l-3-3L5 16l-1 4Z',
  trash: 'M4 7h16m-10 4v5m4-5v5M6 7l1 13h10l1-13M9 7V4h6v3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  moon: 'M20.8 15a9 9 0 0 1-11.7-11.8A9 9 0 1 0 20.8 15Z',
  sun: 'M12 2v2m0 16v2m10-10h-2M4 12H2m17.1-7.1-1.4 1.4M6.3 17.7l-1.4 1.4m14.2 0-1.4-1.4M6.3 6.3 4.9 4.9M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  settings: 'm10 3-.6 2.2-2 .9-2-.7-2 3.4 1.6 1.6v2.2L3.4 14l2 3.5 2-.7 2 .9.6 2.3h4l.6-2.3 2-.9 2 .7 2-3.5-1.6-1.4v-2.2l1.6-1.6-2-3.4-2 .7-2-.9L14 3ZM15 11.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  feed: 'M3 10 12 3l9 7v10h-6v-6H9v6H3Z',
  search: 'm20 20-4-4M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  'eye-off': 'm3 3 18 18M9 6.5a11 11 0 0 1 3-.5c6.5 0 10 6 10 6a17 17 0 0 1-3 3.2M6 8a16 16 0 0 0-4 4s3.5 6 10 6a11 11 0 0 0 4.2-.9',
  profile: 'M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  bookmark: 'M6 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15l-6-4-6 4Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
  music: 'M4 13v-2a8 8 0 1 1 16 0v2M4 12h3v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 1-2Zm16 0h-3v7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-2Z',
  heart: 'M12 20 4.7 13a5 5 0 0 1 7.3-6.8A5 5 0 0 1 19.3 13L12 20Z',
  reply: 'M20 11a8 8 0 0 1-8 8H4l1.8-3.5A8 8 0 1 1 20 11Z',
  repost: 'm17 2 4 4-4 4m4-4H7a3 3 0 0 0-3 3v2m3 11-4-4 4-4m-4 4h14a3 3 0 0 0 3-3v-2',
  image: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm-1 12 5-5 4 4 2-2 5 5M15 8h.01',
  stack: 'M5 4h14v12H5ZM8 20h12a3 3 0 0 0 3-3V7',
  import: arrowIntoTray,
  export: arrowOutOfTray,
  upload: arrowOutOfTray,
  download: arrowIntoTray,
  folder: 'M3 7V5h6l2 2h10v12H3Z',
  spark: 'M12 3c0 6 3 9 9 9-6 0-9 3-9 9 0-6-3-9-9-9 6 0 9-3 9-9Z',
  send: 'm3 4 18 8-18 8 3-8-3-8Zm3 8h15',
} as const

export type IconName = keyof typeof iconPaths
const iconButtonClass = (icon: IconName) => icon === 'trash' ? 'ui-icon-button icon-danger' : 'ui-icon-button'

export function createIconButton(icon: IconName, label: string) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = iconButtonClass(icon)
  button.title = label
  button.setAttribute('aria-label', label)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'ui-icon')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('viewBox', '0 0 24 24')
  const path = document.createElementNS(svg.namespaceURI, 'path')
  path.setAttribute('d', iconPaths[icon])
  svg.append(path)
  button.append(svg)
  return button
}

export function Icon({ name }: { name: IconName }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={iconPaths[name]} />
  </svg>
}

export function IconButton({ icon, label, count, className = '', ...props }: ComponentPropsWithoutRef<'button'> & {
  icon: IconName; label: string; count?: number
}) {
  return <button type="button" {...props} aria-label={label} title={label} className={iconButtonClass(icon) + ' ' + className}>
    <Icon name={icon} />{Boolean(count) && <span aria-hidden="true">{count}</span>}
  </button>
}
