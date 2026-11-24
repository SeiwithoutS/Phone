import { useEffect, useRef, useState } from 'react'
import { escapeHtml } from '../../runtime/files'
import { showCustomConfirm } from '../../legacy/dialogs/dialogs.js'
import { parseMarkdown } from '../../legacy/rendering/markup.js'
import { deleteDiaryEntry, generateDiary, isDiaryFavorite, toggleDiaryFavorite } from './diary'
import paperCss from './diary-paper.css?raw'
import type { DiaryEntry, DirectChat } from './model'

const sampleEntry = {
  title: 'Diary preview',
  content: 'I wrote down !h{a small detail} I wanted to remember.\n\n!w{Some moments are worth keeping.}',
}

function diaryDocument(entry: Pick<DiaryEntry, 'title' | 'content'>, css: string) {
  const paragraphs = entry.content.split(/\r?\n/).map(line => '<p>' + (parseMarkdown(escapeHtml(line)) || '&nbsp;') + '</p>').join('')
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  const style = css.replace(/<\/style/gi, '\\3c /style')
  return `<!doctype html><html data-theme="${theme}"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:">
<style>${paperCss}</style><style>${style}</style></head><body id="char-diary-detail-screen">
<div id="char-diary-detail-content-wrapper"><article id="char-diary-detail-content" class="diary-entry">
<h1 id="char-diary-detail-title" class="diary-title">${escapeHtml(entry.title)}</h1>
<div class="diary-content">${paragraphs}</div>
</article></div></body></html>`
}

export function DiaryPanel({ chat }: { chat: DirectChat }) {
  const [entries, setEntries] = useState(() => chat.diary ?? [])
  const [entry, setEntry] = useState<DiaryEntry>()
  const [favorite, setFavorite] = useState<boolean>()
  const [css, setCss] = useState(() => typeof chat.settings.diaryCss === 'string' ? chat.settings.diaryCss : '')
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [cssNotice, setCssNotice] = useState('')
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!entry) return
    let current = true
    void isDiaryFavorite(chat, entry).then(checked => {
      if (current) setFavorite(checked)
    }).catch(() => { if (current) setError('Could not load the favorite status.') })
    return () => { current = false }
  }, [chat, entry])

  async function run(label: string, action: () => Promise<void>) {
    if (busy) return
    setBusy(label)
    setError('')
    try { await action() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update the diary.') }
    finally { setBusy('') }
  }

  function generate(replace: boolean) {
    return run('Writing diary…', async () => {
      if (replace && entries.length && !await showCustomConfirm('Regenerate diary', 'Replace the current diary entries?', { confirmButtonClass: 'btn-danger' })) return
      const next = await generateDiary(chat, replace)
      setEntries(next)
      setFavorite(undefined)
      setEntry(next.at(-1))
    })
  }

  return <>
    <details className="chat-setting-card phone-app-stack diary-css-card">
      <summary>Diary CSS</summary>
      <p className="phone-app-muted">Import a .css file or paste styles below. Use the checkmark in Chat Settings to save them for this character.</p>
      <label>Custom diary CSS
        <textarea id="chat-diary-css" className="phone-app-code" rows={6} spellCheck={false}
          placeholder=".diary-entry { font-family: Georgia, serif; }"
          value={css} onChange={event => { setCss(event.target.value); setCssNotice('') }} />
      </label>
      <div className="phone-app-actions">
        <button type="button" className="phone-app-button" onClick={() => picker.current?.click()}>Import CSS</button>
        <button type="button" className="phone-app-button" onClick={() => setPreview(value => !value)}
          aria-expanded={preview}>{preview ? 'Hide preview' : 'Preview CSS'}</button>
        <button type="button" className="phone-app-button" disabled={!css} onClick={() => {
          setCss('')
          setCssNotice('Default style restored in the editor. Save to apply.')
        }}>Reset CSS</button>
      </div>
      <input type="file" id="diary-css-file" accept=".css,text/css" ref={picker} hidden onChange={async event => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (!file) return
        if (!file.name.toLowerCase().endsWith('.css')) { setCssNotice('Choose a .css file.'); return }
        try {
          setCss(await file.text())
          setPreview(true)
          setCssNotice('CSS imported. Save to apply.')
        } catch { setCssNotice('Could not read this CSS file.') }
      }} />
      <p className="phone-app-muted">Use <code>.diary-entry</code>, <code>.diary-title</code> and <code>.diary-content</code> to style the page.</p>
      {cssNotice && <p className="phone-app-muted" role="status">{cssNotice}</p>}
      {preview && <iframe className="diary-paper diary-paper-preview" title="Diary CSS preview" sandbox=""
        referrerPolicy="no-referrer" srcDoc={diaryDocument(sampleEntry, css)} />}
    </details>

    <div className="chat-setting-card phone-app-stack diary-panel">
      <div className="diary-panel-header">
        <h2>Diary</h2>
        <div className="phone-app-actions">
          <button type="button" className="phone-app-button" disabled={Boolean(busy)} onClick={() => void generate(true)}>
            {entries.length ? 'Regenerate diary' : 'Generate diary'}
          </button>
          <button type="button" className="phone-app-button primary" disabled={Boolean(busy)} onClick={() => void generate(false)}>New entry</button>
        </div>
      </div>
      {busy && <p className="phone-app-muted" role="status">{busy}</p>}
      {error && <p className="phone-app-error" role="alert">{error}</p>}
      {entry ? <>
        <div className="phone-app-actions">
          <button type="button" className="phone-app-button" disabled={Boolean(busy)} onClick={() => { setEntry(undefined); setError('') }}>All entries</button>
          <button type="button" className="phone-app-button" disabled={favorite === undefined || Boolean(busy)}
            onClick={() => void run('Updating Favorites…', async () => setFavorite(await toggleDiaryFavorite(chat, entry)))}>
            {favorite ? 'Remove from Favorites' : 'Save to Favorites'}
          </button>
          <button type="button" className="phone-app-button danger" disabled={Boolean(busy)} onClick={() => void run('Deleting entry…', async () => {
            if (!await showCustomConfirm('Delete diary entry', 'Delete this diary entry?', { confirmButtonClass: 'btn-danger' })) return
            setEntries(await deleteDiaryEntry(chat, entry.id))
            setEntry(undefined)
          })}>Delete entry</button>
        </div>
        <iframe className="diary-paper" title={entry.title} sandbox="" referrerPolicy="no-referrer" srcDoc={diaryDocument(entry, css)} />
      </> : entries.length ? <ul className="diary-list">
        {[...entries].reverse().map(item => <li key={item.id}>
          <button type="button" className="phone-app-button" disabled={Boolean(busy)}
            onClick={() => { setFavorite(undefined); setError(''); setEntry(item) }}>
            {item.title || 'Untitled entry'}
            <small>{new Date(item.timestamp).toLocaleDateString()}</small>
          </button>
        </li>)}
      </ul> : <p className="phone-app-muted">No diary entries yet.</p>}
    </div>
  </>
}
