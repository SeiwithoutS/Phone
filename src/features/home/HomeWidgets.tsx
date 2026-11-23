import { escapeHtml, fileDataUrl, imageSource } from '../../runtime/files'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BackButton, ScreenHeader } from '../../components/phone'
import type { StoredRow } from '../../../shared/storage'

const types = {
  note: 'Note', photo: 'Photo', polaroid: 'Polaroid', profile: 'Profile', clock: 'Clock',
  countdown: 'Countdown', calendar: 'Calendar', quote: 'Quote', progress: 'Progress', mood: 'Mood',
} as const
const imageTypes = ['photo', 'polaroid', 'profile']

export type HomeWidget = StoredRow & {
  id: string
  kind: keyof typeof types
  title: string
  text: string
  image: string
  date: string
  size: 'small' | 'half' | 'full'
  shape?: 'soft' | 'square' | 'pill'
  progress?: number
  color: string
  css: string
  order: number
}

export const widgetTitle = (widget: HomeWidget) => widget.title || types[widget.kind] || 'Widget'

export function WidgetPreview({ widget, active }: { widget: HomeWidget; active: boolean }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active || !['clock', 'countdown', 'calendar'].includes(widget.kind)) return
    const refresh = () => setNow(new Date())
    refresh()
    const timer = setInterval(refresh, 15000)
    return () => clearInterval(timer)
  }, [active, widget.kind])

  let value = ''
  if (widget.kind === 'clock') {
    value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (widget.kind === 'countdown' && widget.date) {
    const target = new Date(widget.date + 'T00:00:00')
    const localDay = (day: Date) => Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())
    const days = Math.round((localDay(target) - localDay(now)) / 86400000)
    value = days > 0 ? days + (days === 1 ? ' day' : ' days') : 'Today'
    if (days < 0) value = Math.abs(days) + (days === -1 ? ' day ago' : ' days ago')
  } else if (widget.kind === 'calendar') {
    value = now.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } else if (widget.kind === 'mood') {
    value = widget.date || '☀'
  }

  const progress = Math.max(0, Math.min(100, Number(widget.progress) || 0))
  const source = imageTypes.includes(widget.kind) ? imageSource(widget.image) : ''
  const image = source ? '<img class="image" src="' + escapeHtml(source) + '" alt="">' : ''
  const color = /^#[\da-f]{6}$/i.test(widget.color) ? widget.color : '#e9f1fc'
  const customCss = (widget.css || '').replace(/<(?=\/style\b)/gi, '\\3c ')
  const shape = widget.shape === 'square' ? '5px' : widget.shape === 'pill' ? '36px' : '16px'
  const doc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: http: https:">' +
    '<style>*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden}body{font:14px system-ui,sans-serif}'+
    '.widget{height:100%;border-radius:' + shape + ';overflow:hidden;background:' + color + ';color:#17283b;padding:clamp(6px,5vw,14px);display:flex;flex-direction:column;justify-content:center;gap:5px;overflow-wrap:anywhere}'+
    '.widget.photo{position:relative}.photo .image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'+
    '.photo .title,.photo .text{position:relative;background:#112139dc;color:white;padding:3px 6px;border-radius:4px;align-self:start}'+
    '.polaroid{text-align:center;padding:6px 7px 9px;gap:2px}.polaroid .image{flex:1;width:100%;min-height:0;object-fit:cover}'+
    '.profile .image{width:45px;height:45px;border-radius:50%;object-fit:cover}.title{margin:0;font-weight:700;font-size:14px}'+
    '.value{font-size:clamp(14px, 13vw, 34px);line-height:1.1;font-weight:750}.text{margin:0;white-space:pre-wrap}'+
    '.quote .text{font-family:Georgia,serif;font-style:italic;border-left:3px solid #5364b1;padding-left:8px}.calendar,.mood{text-align:center}'+
    '.progress progress{width:100%;accent-color:#40549c}.progress .value{font-size:18px}</style><style>' +
    customCss + '</style></head><body><div class="widget ' + escapeHtml(widget.kind) + '">' + image +
    (widget.title ? '<h2 class="title">' + escapeHtml(widget.title) + '</h2>' : '') +
    (value ? '<div class="value">' + escapeHtml(value) + '</div>' : '') +
    (widget.kind === 'progress' ? '<div class="value">' + progress + '%</div><progress max="100" value="' + progress + '" aria-label="Progress"></progress>' : '') +
    (widget.text ? '<p class="text">' + escapeHtml(widget.text) + '</p>' : '') + '</div></body></html>'
  return <iframe title={widgetTitle(widget)} sandbox="" referrerPolicy="no-referrer" srcDoc={doc} tabIndex={-1} loading="lazy" />
}

export function WidgetTile({ widget, active, edit, earlier, later }: {
  widget: HomeWidget; active: boolean; edit: () => void; earlier?: () => void; later?: () => void
}) {
  return <article className={'launcher-widget ' + widget.size}>
    <WidgetPreview widget={widget} active={active} />
    <div className="launcher-widget-controls">
      <button type="button" className="phone-app-button" onClick={edit} aria-label={'Edit ' + (widget.title || types[widget.kind])}>Edit</button>
      {earlier && <button type="button" className="phone-app-button" onClick={earlier} aria-label="Move widget earlier">↑</button>}
      {later && <button type="button" className="phone-app-button" onClick={later} aria-label="Move widget later">↓</button>}
    </div>
  </article>
}

export function WidgetEditor({ widget, nextOrder, close, save, remove }: {
  widget?: HomeWidget; nextOrder: number; close: () => void
  save: (widget: HomeWidget) => Promise<void>; remove: (widget: HomeWidget) => Promise<void>
}) {
  const [draft, setDraft] = useState<HomeWidget>(() => widget ?? {
    id: crypto.randomUUID(), kind: 'note', title: '', text: '', image: '', date: '',
    size: 'half', color: '#e9f1fc', css: '', order: nextOrder,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof HomeWidget>(key: K, value: HomeWidget[K]) => setDraft(current => ({ ...current, [key]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (draft.image && !imageSource(draft.image)) {
      setError('Use an HTTP(S) image URL or choose a supported image file.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await save(draft)
    } catch {
      setError('Widget could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="widget-editor phone-feature">
    <ScreenHeader><BackButton onClick={close} /><span>{widget ? 'Edit widget' : 'Add widget'}</span><span /></ScreenHeader>
    <form className="phone-app-scroll phone-app-stack" onSubmit={submit}>
      <div className="widget-preview"><WidgetPreview widget={draft} active /></div>
      <div className="phone-app-two">
        <label>Type<select value={draft.kind} onChange={event => set('kind', event.target.value as HomeWidget['kind'])}>
          {Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Width<select value={draft.size} onChange={event => set('size', event.target.value as HomeWidget['size'])}>
          <option value="small">Compact</option><option value="half">Half</option><option value="full">Full</option>
        </select></label>
      </div>
      <label>Shape<select value={draft.shape || 'soft'} onChange={event => set('shape', event.target.value as HomeWidget['shape'])}>
        <option value="soft">Rounded</option><option value="square">Square</option><option value="pill">Pill</option>
      </select></label>
      <label>Title<input value={draft.title} onChange={event => set('title', event.target.value)} maxLength={80} /></label>
      <label>Text<textarea rows={3} value={draft.text} onChange={event => set('text', event.target.value)} maxLength={600} /></label>
      {imageTypes.includes(draft.kind) && <>
        <label>Image URL<input type="url" value={draft.image.startsWith('data:') ? '' : draft.image} onChange={event => set('image', event.target.value)} /></label>
        <label>Upload image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp" onChange={async event => {
          const file = event.currentTarget.files?.[0]
          if (file) {
            try { set('image', await fileDataUrl(file)); setError('') } catch { setError('Image could not be read.') }
          }
        }} /></label>
        {draft.image && <button className="phone-app-button" type="button" onClick={() => set('image', '')}>Remove image</button>}
      </>}
      {draft.kind === 'countdown' && <label>Target date<input type="date" required value={draft.date} onChange={event => set('date', event.target.value)} /></label>}
      {draft.kind === 'progress' && <label>Progress (%)<input type="number" min={0} max={100} value={draft.progress ?? 0} onChange={event =>
        set('progress', Number(event.target.value))} /></label>}
      {draft.kind === 'mood' && <label>Mood<select value={draft.date || '☀'} onChange={event => set('date', event.target.value)}>
        <option value="☀">Sunny</option><option value="☁">Quiet</option><option value="☂">Rainy</option><option value="☾">Sleepy</option><option value="✦">Excited</option>
      </select></label>}
      <label>Background<input type="color" value={draft.color} onChange={event => set('color', event.target.value)} /></label>
      <label>Import CSS<input type="file" accept=".css,text/css" onChange={async event => {
        const file = event.currentTarget.files?.[0]
        if (file) {
          try { set('css', await file.text()); setError('') } catch { setError('CSS could not be read.') }
        }
      }} /></label>
      <label>Custom CSS<textarea className="phone-app-code" rows={5} value={draft.css} onChange={event => set('css', event.target.value)}
        placeholder=".widget { border: 2px solid #4263eb; }" /></label>
      <small>Selectors available: .widget, .title, .text, .image, .value</small>
      {error && <p className="phone-app-error" role="alert">{error}</p>}
      <div className="phone-app-actions">
        <button className="phone-app-button primary" type="submit" disabled={busy}>Save widget</button>
        {widget && <button className="phone-app-button danger" type="button" disabled={busy} onClick={async () => {
          setBusy(true)
          try { await remove(widget) } catch { setError('Widget could not be deleted.'); setBusy(false) }
        }}>Delete widget</button>}
      </div>
    </form>
  </div>
}
