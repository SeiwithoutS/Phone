import { createContext, useContext } from 'react'

import type { ComponentPropsWithoutRef, KeyboardEvent, ReactNode } from 'react'
import type { ScreenId } from '../app/routes'

export const ScreenContext = createContext<ScreenId>('home-screen')

type ScreenProps = ComponentPropsWithoutRef<'div'> & { id: ScreenId }

export function Screen({ id, className = '', ...props }: ScreenProps) {
  const active = useContext(ScreenContext) === id
  return <div {...props} id={id} className={`screen ${active ? 'active' : ''} ${className}`.trim()} inert={!active} />
}

export function ScreenHeader({ className = '', ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={`header ${className}`.trim()} />
}

export function Dialog({ className = '', ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div role="dialog" {...props} className={`modal ${className}`.trim()} />
}

export function BackButton({ className = '', children = '‹', ...props }: ComponentPropsWithoutRef<'button'>) {
  return <button type="button" aria-label="Back" {...props} className={`back-btn phone-button ${className}`.trim()}>{children}</button>
}

export function AppShortcut({ className = '', ...props }: ComponentPropsWithoutRef<'button'>) {
  return <button type="button" {...props} className={`phone-button ${className}`.trim()} />
}

export function activateOnKey(event: KeyboardEvent<HTMLElement>) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    event.currentTarget.click()
  }
}

type FilePickerProps = Pick<ComponentPropsWithoutRef<'input'>, 'multiple' | 'onChange'> & {
  id: string
  accept: string
}

export function FilePicker(props: FilePickerProps) {
  return <input {...props} type="file" hidden />
}

export function FormField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="form-group">
    <label htmlFor={id}>{label}</label>
    {children}
  </div>
}
