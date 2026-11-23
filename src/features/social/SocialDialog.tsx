import { useId, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { IconButton } from '../../components/icons'
import { fileDataUrl, imageSource } from '../../runtime/files'

export function SocialDialog({ title, children, close, className = '' }: {
  title: string; children: ReactNode; close: () => void; className?: string
}) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className={'social-dialog phone-feature ' + className} aria-labelledby={id}
    onCancel={event => { event.preventDefault(); close() }}
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <section>
      <header><h2 id={id}>{title}</h2><IconButton icon="close" label={'Close ' + title.toLowerCase()} onClick={close} /></header>
      <div className="social-dialog-content">{children}</div>
    </section>
  </dialog>
}

export async function readSocialImage(file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MiB.')
  const source = imageSource(await fileDataUrl(file))
  if (!source) throw new Error('Choose a PNG, JPEG, WebP, GIF or other supported image.')
  return source
}

export function shortDate(timestamp: number) {
  const date = new Date(timestamp)
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'Now'
  if (minutes < 60) return minutes + ' min'
  if (minutes < 1440) return Math.floor(minutes / 60) + ' hr'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(date.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) })
}
