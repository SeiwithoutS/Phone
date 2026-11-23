import type { ComponentPropsWithoutRef } from 'react'

export const iconPaths = {
  back: 'm14 6-6 6 6 6',
  next: 'm10 6 6 6-6 6',
  close: 'm6 6 12 12M18 6 6 18',
  check: 'm5 12 5 5L20 7',
  plus: 'M12 5v14M5 12h14',
  edit: 'm14 6 4 4M4 20l4-.8L20 7l-3-3L5 16l-1 4Z',
  trash: 'M4 7h16m-10 4v5m4-5v5M6 7l1 13h10l1-13M9 7V4h6v3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  moon: 'M20.8 15a9 9 0 0 1-11.7-11.8A9 9 0 1 0 20.8 15Z',
  sun: 'M12 2v2m0 16v2m10-10h-2M4 12H2m17.1-7.1-1.4 1.4M6.3 17.7l-1.4 1.4m14.2 0-1.4-1.4M6.3 6.3 4.9 4.9M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  settings: 'm10 3-.6 2.2-2 .9-2-.7-2 3.4 1.6 1.6v2.2L3.4 14l2 3.5 2-.7 2 .9.6 2.3h4l.6-2.3 2-.9 2 .7 2-3.5-1.6-1.4v-2.2l1.6-1.6-2-3.4-2 .7-2-.9L14 3ZM15 11.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  feed: 'M3 10 12 3l9 7v10h-6v-6H9v6H3Z',
  search: 'm20 20-4-4M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  profile: 'M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  bookmark: 'M6 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15l-6-4-6 4Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
  music: 'M4 13v-2a8 8 0 1 1 16 0v2M4 12h3v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 1-2Zm16 0h-3v7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-2Z',
  heart: 'M12 20 4.7 13a5 5 0 0 1 7.3-6.8A5 5 0 0 1 19.3 13L12 20Z',
  reply: 'M20 11a8 8 0 0 1-8 8H4l1.8-3.5A8 8 0 1 1 20 11Z',
  repost: 'm17 2 4 4-4 4m4-4H7a3 3 0 0 0-3 3v2m3 11-4-4 4-4m-4 4h14a3 3 0 0 0 3-3v-2',
  image: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm-1 12 5-5 4 4 2-2 5 5M15 8h.01',
  stack: 'M5 4h14v12H5ZM8 20h12a3 3 0 0 0 3-3V7',
  upload: 'M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5',
  download: 'M12 4v12m-4-4 4 4 4-4M4 16v4h16v-4',
  folder: 'M3 7V5h6l2 2h10v12H3Z',
  spark: 'M12 3c0 6 3 9 9 9-6 0-9 3-9 9 0-6-3-9-9-9 6 0 9-3 9-9Z',
  send: 'm3 4 18 8-18 8 3-8-3-8Zm3 8h15',
} as const

export type IconName = keyof typeof iconPaths

export function Icon({ name }: { name: IconName }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={iconPaths[name]} />
  </svg>
}

export function IconButton({ icon, label, count, className = '', ...props }: ComponentPropsWithoutRef<'button'> & {
  icon: IconName; label: string; count?: number
}) {
  return <button type="button" {...props} aria-label={label} title={label} className={'ui-icon-button ' + className}>
    <Icon name={icon} />{Boolean(count) && <span aria-hidden="true">{count}</span>}
  </button>
}
