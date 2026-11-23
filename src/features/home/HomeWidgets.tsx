import { escapeHtml, fileDataUrl, imageSource } from '../../runtime/files'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { HeaderSaveButton, PhoneFeatureHeader } from '../../components/phone'
import { showCustomConfirm } from '../../legacy/dialogs/dialogs.js'
import { Icon, IconButton } from '../../components/icons'
import type { StoredRow } from '../../../shared/storage'

const types = {
  note: 'Note', photo: 'Photo', polaroid: 'Polaroid', profile: 'Profile', clock: 'Clock',
  countdown: 'Countdown', calendar: 'Calendar', quote: 'Quote', progress: 'Progress', mood: 'Mood',
  'photo-note': 'Photo and note', collage: 'Photo collage', duo: 'Two avatars',
} as const
const imageTypes = new Set(['photo', 'polaroid', 'profile', 'photo-note', 'collage', 'duo'])

export type HomeWidget = StoredRow & {
  id: string
  kind: keyof typeof types
  title: string
  text: string
  image: string
  extraImages?: string[]
  secondaryText?: string
  textAlign?: 'left' | 'center' | 'right'
  imageFit?: 'cover' | 'contain'
  date: string
  size: 'small' | 'half' | 'full'
  shape?: 'soft' | 'square' | 'pill'
  progress?: number
  color: string
  css: string
  order: number
}


const template = (kind: HomeWidget['kind'], title: string, color: string, size: HomeWidget['size'], details: Partial<HomeWidget> = {}): HomeWidget => ({
  id: 'template-' + kind, title, kind, size, color, image: '', date: '', text: '', css: '', order: 0, ...details,
})
export const widgetTemplates = [
  template('note', 'Sticky note', '#fff4d6', 'half', { text: 'Write something to remember.' }),
  template('photo-note', 'Photo and note', '#e6f2fd', 'full', { text: 'A small moment' }),
  template('collage', 'Photo collage', '#edf5fe', 'full'),
  template('duo', 'Two avatars', '#e6f3ff', 'full', { text: 'You', secondaryText: 'Your character' }),
  template('photo', 'Photo', '#e8f3fe', 'small'),
  template('polaroid', 'Photo memory', '#f4f8fe', 'half', { text: 'A small moment' }),
  template('quote', 'Little quote', '#e5f3ed', 'half', { text: 'Make time for what matters.' }),
  template('clock', 'Soft clock', '#e5f2ff', 'half'),
  template('calendar', 'Today', '#e8f3ff', 'small'),
  template('countdown', 'Countdown', '#eaf4fd', 'half'),
  template('mood', 'Mood', '#e6f2fd', 'small', { date: 'Calm' }),
  template('progress', 'Progress', '#dfeaf9', 'half', { progress: 50 }),
  template('profile', 'Profile card', '#e8f4ff', 'half', { text: 'About me' }),
]

export const widgetTemplateGroups = {
  Photos: ['photo', 'photo-note', 'polaroid', 'profile', 'collage', 'duo'],
  Notes: ['note', 'quote', 'photo-note', 'mood'],
  Time: ['calendar', 'clock', 'countdown', 'progress'],
} as const satisfies Record<string, readonly HomeWidget['kind'][]>

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
  const renderImage = (source = '', placeholder = false) => {
    const safe = typeof source === 'string' ? imageSource(source) : ''
    return safe ? '<img class="image" src="' + escapeHtml(safe) + '" alt="">' :
      placeholder ? '<span class="image placeholder" aria-hidden="true">+</span>' : ''
  }
  const primary = imageTypes.has(widget.kind) ? renderImage(widget.image, true) : ''
  const additional = Array.isArray(widget.extraImages) ? widget.extraImages : []
  const title = widget.title ? '<h2 class="title">' + escapeHtml(widget.title) + '</h2>' : ''
  const text = widget.text ? '<p class="text">' + escapeHtml(widget.text) + '</p>' : ''
  const content = widget.kind === 'collage'
    ? title + '<div class="photos">' + [primary, ...Array.from({ length: 3 }, (_, index) => renderImage(additional[index], true))].join('') + '</div>'
    : widget.kind === 'duo'
      ? title + '<div class="photos"><div>' + primary + text + '</div><div>' + renderImage(additional[0], true) +
        '<p class="text">' + escapeHtml(widget.secondaryText || '') + '</p></div></div>'
      : widget.kind === 'photo-note'
        ? primary + '<div class="photo-note-copy">' + title + text + '</div>'
        : primary + title + (value ? '<div class="value">' + escapeHtml(value) + '</div>' : '') +
        (widget.kind === 'progress' ? '<div class="value">' + progress + '%</div><progress max="100" value="' + progress + '" aria-label="Progress"></progress>' : '') + text
  const color = /^#[\da-f]{6}$/i.test(widget.color) ? widget.color : '#e9f1fc'
  const customCss = (widget.css || '').replace(/<(?=\/style\b)/gi, '\\3c ')
  const shape = widget.shape === 'square' ? '5px' : widget.shape === 'pill' ? '36px' : '16px'
  const fit = widget.imageFit === 'contain' ? 'contain' : 'cover'
  const align = widget.textAlign === 'center' || widget.textAlign === 'right' ? widget.textAlign : 'left'
  const doc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: http: https:">' +
    '<style>*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden}body{font:14px system-ui,sans-serif}'+
    '.widget{height:100%;border-radius:' + shape + ';overflow:hidden;background:' + color + ';color:#17283b;padding:clamp(6px,5vw,14px);display:flex;flex-direction:column;justify-content:center;gap:5px;overflow-wrap:anywhere;text-align:' + align + '}'+
    '.widget.photo{position:relative}.photo .image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'+
    '.photo .title,.photo .text{position:relative;background:#112139dc;color:white;padding:3px 6px;border-radius:4px;align-self:start}'+
    '.polaroid{text-align:center;padding:6px 7px 9px;gap:2px}.polaroid .image{flex:1;width:100%;min-height:0;object-fit:cover}'+
    '.profile .image{width:45px;height:45px;border-radius:50%;object-fit:cover}.title{margin:0;font-weight:700;font-size:14px}'+
    '.value{font-size:clamp(14px, 13vw, 34px);line-height:1.1;font-weight:750}.text{margin:0;white-space:pre-wrap}'+
    '.quote .text{font-family:Georgia,serif;font-style:italic;border-left:3px solid #507fac;padding-left:8px}.calendar,.mood{text-align:center}'+
    '.progress progress{width:100%;accent-color:#366d9e}.progress .value{font-size:18px}'+
    '.note .text{line-height:1.45}.widget .image{object-fit:' + fit + '}.placeholder{min-height:24px;display:grid;place-items:center;background:#ffffff90;color:#50769d;border:1px dashed #7496b9;border-radius:8px}'+
    '.photos{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;flex:1;min-height:0}.photos .image{width:100%;height:100%;min-height:0;border-radius:6px}'+
    '.duo .photos>div{min-width:0;display:flex;align-items:center;justify-content:center;gap:5px}.duo .photos .image{width:34px;height:34px;border-radius:50%;flex:none}.duo .text{font-size:11px}'+
    '.photo-note{flex-direction:row;align-items:center;justify-content:flex-start}.photo-note>.image{width:38%;height:100%;border-radius:9px;flex:none}.photo-note-copy{min-width:0}.photo-note-copy .text{margin-top:4px}'+
    '</style><style>' + customCss + '</style></head><body><div class="widget ' + escapeHtml(widget.kind) + '">' + content + '</div></body></html>'
  return <iframe title={widgetTitle(widget)} sandbox="" referrerPolicy="no-referrer" srcDoc={doc} tabIndex={-1} loading="lazy" />
}

export function WidgetTile({ widget, active, edit, earlier, later }: {
  widget: HomeWidget; active: boolean; edit: () => void; earlier?: () => void; later?: () => void
}) {
  return <article className={'launcher-widget ' + widget.size}>
    <WidgetPreview widget={widget} active={active} />
    <div className="launcher-widget-controls">
      <IconButton icon="edit" onClick={edit} label={'Edit ' + widgetTitle(widget)} />
      {earlier && <button type="button" className="phone-app-button" onClick={earlier} aria-label="Move widget earlier">↑</button>}
      {later && <button type="button" className="phone-app-button" onClick={later} aria-label="Move widget later">↓</button>}
    </div>
  </article>
}

export function WidgetEditor({ widget, template, nextOrder, close, save, remove }: {
  widget?: HomeWidget; template?: HomeWidget; nextOrder: number; close: () => void
  save: (widget: HomeWidget) => Promise<void>; remove: (widget: HomeWidget) => Promise<void>
}) {
  const [draft, setDraft] = useState<HomeWidget>(() => widget ?? {
    kind: 'note', title: '', text: '', image: '', date: '', size: 'half', color: '#e9f1fc', css: '',
    ...template, id: crypto.randomUUID(), order: nextOrder,
  })
  const [busy, setBusy] = useState(false)
  const [pendingImages, setPendingImages] = useState(0)
  const [error, setError] = useState('')
  const set = <K extends keyof HomeWidget>(key: K, value: HomeWidget[K]) => setDraft(current => ({ ...current, [key]: value }))
  const additionalCount = draft.kind === 'collage' ? 3 : draft.kind === 'duo' ? 1 : 0
  const widgetImages = [draft.image ?? '', ...Array.from({ length: additionalCount }, (_, index) => draft.extraImages?.[index] ?? '')]

  function setImage(index: number, value: string) {
    if (!index) { set('image', value); return }
    setDraft(current => {
      const images = Array.from({ length: 3 }, (_, position) => current.extraImages?.[position] ?? '')
      images[index - 1] = value
      return { ...current, extraImages: images }
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || pendingImages) return
    if (imageTypes.has(draft.kind) && widgetImages.some(image => image && !imageSource(image))) {
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
    <PhoneFeatureHeader title={widget ? 'Edit widget' : 'Add widget'} onBack={close} backDisabled={busy} actions={<>
      {widget && <IconButton icon="trash" label="Delete widget" disabled={busy} onClick={async () => {
        if (!await showCustomConfirm('Delete widget', 'Remove this widget from the home screen?', { confirmButtonClass: 'btn-danger' })) return
        setBusy(true)
        try { await remove(widget) } catch { setError('Widget could not be deleted.'); setBusy(false) }
      }} />}
      <HeaderSaveButton form="widget-edit-form" label="Save widget" disabled={busy || pendingImages > 0} />
    </>} />
    <form id="widget-edit-form" className="phone-app-scroll phone-app-stack" onSubmit={submit}>
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
      {draft.kind !== 'collage' && <label>{draft.kind === 'duo' ? 'First caption' : 'Text'}<textarea rows={3} value={draft.text} onChange={event => set('text', event.target.value)} maxLength={600} /></label>}
      {draft.kind === 'duo' && <label>Second caption<input value={draft.secondaryText || ''} onChange={event => set('secondaryText', event.target.value)} maxLength={120} /></label>}
      {imageTypes.has(draft.kind) && <fieldset className="widget-images phone-app-stack">
        <legend>Images</legend>
        {widgetImages.map((source, index) => <div className="widget-image-field" key={index}>
          <label>{widgetImages.length === 1 ? 'Image URL' : 'Image ' + (index + 1) + ' URL'}<input type="url"
            value={source.startsWith('data:') ? '' : source} onChange={event => setImage(index, event.target.value)} /></label>
          <label className="ui-icon-button widget-upload" title={'Upload image ' + (index + 1)}>
            <input type="file" aria-label={'Upload widget image ' + (index + 1)} accept="image/*" onChange={async event => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (!file) return
              setPendingImages(count => count + 1)
              try {
                const image = file.size <= 4 * 1024 * 1024 && imageSource(await fileDataUrl(file))
                if (!image) throw new Error('Choose a supported image up to 4 MB.')
                setImage(index, image)
                setError('')
              } catch (failure) { setError(failure instanceof Error ? failure.message : 'Image could not be read.') }
              finally { setPendingImages(count => count - 1) }
            }} />
            <Icon name="upload" />
          </label>
          {source && <IconButton icon="trash" label={'Remove widget image ' + (index + 1)} onClick={() => setImage(index, '')} />}
        </div>)}
        <label>Image fit<select value={draft.imageFit || 'cover'} onChange={event => set('imageFit', event.target.value as HomeWidget['imageFit'])}>
          <option value="cover">Fill area</option><option value="contain">Show whole image</option>
        </select></label>
      </fieldset>}
      {draft.kind === 'countdown' && <label>Target date<input type="date" required value={draft.date} onChange={event => set('date', event.target.value)} /></label>}
      {draft.kind === 'progress' && <label>Progress (%)<input type="number" min={0} max={100} value={draft.progress ?? 0} onChange={event =>
        set('progress', Number(event.target.value))} /></label>}
      {draft.kind === 'mood' && <label>Mood<select value={draft.date || '☀'} onChange={event => set('date', event.target.value)}>
        <option>Sunny</option><option>Calm</option><option>Rainy</option><option>Sleepy</option><option>Excited</option>
      </select></label>}
      <div className="phone-app-two">
        <label>Background<input type="color" value={draft.color} onChange={event => set('color', event.target.value)} /></label>
        <label>Text alignment<select value={draft.textAlign || 'left'} onChange={event => set('textAlign', event.target.value as HomeWidget['textAlign'])}>
          <option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option>
        </select></label>
      </div>
      <details className="settings-disclosure">
        <summary>Advanced styling</summary>
        <div className="settings-tools widget-css-tools">
          <label htmlFor="widget-css">Custom CSS</label>
          <label className="widget-upload ui-icon-button" title="Import widget CSS">
            <Icon name="import" />
            <input className="widget-file-picker" type="file" accept=".css,text/css" aria-label="Import widget CSS" onChange={async event => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (!file) return
              try { set('css', await file.text()); setError('') } catch { setError('CSS could not be read.') }
            }} />
          </label>
        </div>
        <textarea id="widget-css" className="phone-app-code" rows={5} value={draft.css} onChange={event => set('css', event.target.value)}
          placeholder=".widget { border: 2px solid #3c76ad; }" />
        <small>Selectors available: .widget, .title, .text, .image, .value</small>
      </details>
      {error && <p className="phone-app-error" role="alert">{error}</p>}
    </form>
  </div>
}
