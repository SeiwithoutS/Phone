import { useContext, useRef, useState } from 'react'
import { HeaderSaveButton, PhoneFeatureHeader, Screen, ScreenContext } from '../../components/phone'
import { showScreen } from '../../app/routes'
import { runtime } from '../../legacy/runtime/state.js'
import { getLoreBooks, saveLoreBook } from './lore-storage'
import { makeLoreEntry, readLoreBook } from './lore'
import { downloadJson, escapeHtml } from '../../runtime/files'
import { showCustomConfirm } from '../../legacy/dialogs/dialogs.js'
import { IconButton } from '../../components/icons'
import { CollectionLayoutButton, PromptEntryList, movePromptEntry } from '../../components/PromptEntryList'
import type { LoreBook, LoreEntry } from './lore'

export function LorebookScreen({ ready }: { ready: boolean }) {
  const active = useContext(ScreenContext) === 'lorebook-screen'
  return <Screen id="lorebook-screen" className="phone-feature">{active && ready && <LorebookLibrary />}</Screen>
}

function LorebookLibrary() {
  const [books, setBooks] = useState<LoreBook[]>(getLoreBooks)
  const [draft, setDraft] = useState<LoreBook>()
  const [grid, setGrid] = useState(false)
  const [newEntry, setNewEntry] = useState<string>()
  const [linked, setLinked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const chats = Object.values(runtime.state.chats).filter(chat => chat != null)
  const savedBook = books.find(book => book.id === draft?.id)

  function edit(book: LoreBook) {
    setError('')
    setNewEntry(undefined)
    setDraft({ ...book, content: [...book.content].sort((left, right) => left.order - right.order) })
    setLinked(chats.filter(chat => chat.settings.linkedLoreBookIds?.includes(book.id)).map(chat => chat.id))
  }

  async function commit(book: LoreBook, remove = false) {
    const name = book.name.trim()
    if (!name) { setError('Enter a lorebook name.'); return }
    setBusy(true)
    setError('')
    try {
      await saveLoreBook({ ...book, name }, linked, remove)
      setBooks(getLoreBooks())
      setDraft(undefined)
    } catch { setError('The lorebook could not be saved.') }
    finally { setBusy(false) }
  }

  function exportBook(book: LoreBook) {
    downloadJson({ type: 'EPhoneLoreBook', version: 1, name: book.name, scanDepth: book.scanDepth, entries: book.content }, book.name + '-WorldInfo')
  }

  async function deleteBook(book: LoreBook) {
    if (await showCustomConfirm('Delete World Info', `Delete “${escapeHtml(book.name)}” and all its entries?`, { confirmButtonClass: 'btn-danger' })) {
      await commit(book, true)
    }
  }

  const updateEntry = (id: string, values: Partial<LoreEntry>) => setDraft(book => book &&
    ({ ...book, content: book.content.map(entry => entry.id === id ? { ...entry, ...values } : entry) }))

  return <>
    <PhoneFeatureHeader title={draft ? 'Edit lorebook' : 'World Info'} backDisabled={busy} actions={draft ? <>
      {savedBook && <IconButton icon="trash" label="Delete lorebook" disabled={busy} onClick={() => void deleteBook(savedBook)} />}
      <HeaderSaveButton label="Save lorebook" form="lorebook-form" disabled={busy || !draft.name.trim()} />
    </> : <>
      <CollectionLayoutButton grid={grid} change={() => setGrid(!grid)} />
      <IconButton icon="import" label="Import World Info JSON" disabled={busy} onClick={() => input.current?.click()} />
      <IconButton icon="plus" label="New lorebook" disabled={busy} onClick={() =>
        edit({ id: crypto.randomUUID(), name: '', scanDepth: 5, content: [] })} />
    </>} onBack={() => {
      if (draft) { setDraft(undefined); setError('') } else showScreen('home-screen')
    }} />
    <input type="file" hidden ref={input} accept=".json,application/json" onChange={async event => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (!file) return
      try {
        const book = readLoreBook(JSON.parse((await file.text()).replace(/^\uFEFF/, '')), file.name.replace(/\.json$/i, ''))
        if (!book) throw new Error('No lorebook entries were found in this JSON file.')
        edit(book)
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not import lorebook.') }
    }} />
    {draft ? <form id="lorebook-form" className="phone-app-scroll phone-app-stack" onSubmit={event => { event.preventDefault(); void commit(draft) }}>
      <div className="phone-app-two">
        <label>Lorebook name<input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Messages to scan<input type="number" min={1} max={100} required value={draft.scanDepth || ''} onChange={event =>
          setDraft({ ...draft, scanDepth: Number(event.target.value) })} /></label>
      </div>
      {chats.length > 0 && <fieldset className="phone-feature-panel">
        <legend>Apply in QQ</legend>
        {chats.map(chat => <label key={chat.id} className="phone-app-check">
          <input type="checkbox" checked={linked.includes(chat.id)} onChange={event => setLinked(event.target.checked
            ? [...linked, chat.id] : linked.filter(id => id !== chat.id))} /> {chat.name}{chat.isGroup ? ' (Group)' : ''}
        </label>)}
      </fieldset>}
      <PromptEntryList rows={draft.content.map((entry, index) => ({ id: entry.id, title: entry.comment || entry.keys[0] || 'Entry ' + (index + 1),
        enabled: entry.enabled }))}
        openNew={newEntry}
        move={(from, to) => setDraft(current => current && { ...current,
          content: movePromptEntry(current.content, from, to).map((entry, order) => ({ ...entry, order })) })}
        toggle={id => setDraft(current => current && { ...current, content: current.content.map(entry =>
          entry.id === id ? { ...entry, enabled: !entry.enabled } : entry) })}
        fields={id => {
          const entry = draft.content.find(row => row.id === id)!
          return <>
          <label>Title<input value={entry.comment} onChange={event => updateEntry(entry.id, { comment: event.target.value })} /></label>
          <KeywordField label="Keywords (comma-separated)" value={entry.keys} change={keys => updateEntry(entry.id, { keys })} />
          <KeywordField label="Secondary keywords" value={entry.secondaryKeys} change={secondaryKeys => updateEntry(entry.id, { secondaryKeys })} />
          {entry.secondaryKeys.length > 0 && <label>Secondary keyword match<select value={entry.selectiveLogic}
            onChange={event => updateEntry(entry.id, { selectiveLogic: Number(event.target.value) })}>
            <option value={0}>Any</option><option value={3}>All</option><option value={2}>None</option><option value={1}>At least one absent</option>
          </select></label>}
          <label>Content<textarea rows={4} value={entry.content} onChange={event => updateEntry(entry.id, { content: event.target.value })} /></label>
          <div className="phone-app-two">
            <label className="phone-app-check"><input type="checkbox" checked={entry.constant} onChange={event => updateEntry(entry.id, { constant: event.target.checked })} /> Always include</label>
            <label className="phone-app-check"><input type="checkbox" checked={entry.wholeWords} onChange={event => updateEntry(entry.id, { wholeWords: event.target.checked })} /> Whole words</label>
            <label className="phone-app-check"><input type="checkbox" checked={entry.caseSensitive} onChange={event => updateEntry(entry.id, { caseSensitive: event.target.checked })} /> Match case</label>
          </div>
          <IconButton icon="trash" label="Remove entry" onClick={() =>
            setDraft({ ...draft, content: draft.content.filter(item => item.id !== entry.id) })} />
        </>
      }} />
      <button type="button" className="phone-app-button compact" onClick={() => {
        const entry = makeLoreEntry({}, (draft.content.at(-1)?.order ?? -1) + 1)
        setDraft({ ...draft, content: [...draft.content, entry] })
        setNewEntry(entry.id)
      }}>+ Entry</button>
      {error && <p className="phone-app-error" role="alert">{error}</p>}
    </form> : <div className="phone-app-scroll phone-app-stack">
      {error && <p className="phone-app-error" role="alert">{error}</p>}
      {books.length === 0 && <p className="phone-app-muted">Lorebooks from imported character cards appear here.</p>}
      <div className="prompt-collection-cards" data-grid={grid}>
      {books.map(book => <article className="phone-app-card collection-card" key={book.id}>
        <button type="button" className="collection-open" onClick={() => edit(book)}>
          <strong>{book.name}</strong><small>{book.content.length} {book.content.length === 1 ? 'entry' : 'entries'}</small>
          {book.sourceCharacterId && <small>{chats.find(chat => chat.id === book.sourceCharacterId)?.name}</small>}
        </button>
        <div className="collection-actions">
          <IconButton icon="export" label={'Export ' + book.name} onClick={() => exportBook(book)} disabled={busy} />
          <IconButton icon="trash" label={'Delete ' + book.name} className="collection-delete" onClick={() => void deleteBook(book)} disabled={busy} />
        </div>
      </article>)}
      </div>
    </div>}
  </>
}

function KeywordField({ label, value, change }: { label: string; value: string[]; change: (value: string[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  return <label>{label}<input value={text} onChange={event => {
    const next = event.target.value
    setText(next)
    change(next.split(',').map(key => key.trim()).filter(Boolean))
  }} /></label>
}
