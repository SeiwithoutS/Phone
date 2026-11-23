import { useSyncExternalStore } from 'react'
import { applyTheme } from '../legacy/appearance/theme.js'
import { IconButton } from './icons'

const eventName = 'eephone:theme'
const isDark = () => document.documentElement.dataset.theme === 'dark'

function subscribe(onChange: () => void) {
  document.addEventListener(eventName, onChange)
  return () => document.removeEventListener(eventName, onChange)
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, isDark)
  return <IconButton className={'theme-toggle ' + className} icon={dark ? 'sun' : 'moon'}
    label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    onClick={() => applyTheme(dark ? 'light' : 'dark')} />
}
