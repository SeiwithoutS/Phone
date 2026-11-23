import { useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { showScreen } from '../../app/routes'
import type { ScreenId } from '../../app/routes'
import { HeaderSaveButton, PhoneFeatureHeader, Screen, ScreenContext } from '../../components/phone'
import { IconButton } from '../../components/icons'
import { PromptEntryList, movePromptEntry } from '../../components/PromptEntryList'
import type { Key, StoredRow } from '../../../shared/storage'
import type { LocalDatabase } from '../../storage/database'
import { updateCachedWorldBook } from '../../legacy/world-book/books.js'
import { confirmDeletePromptCollection } from '../../legacy/world-book/collection-actions.js'
import { runtime } from '../../legacy/runtime/state.js'
import { keywords, record, string } from './lore'
import { promptRole, promptSlot, promptSlots } from '../presets/prompt-order'
import type { PromptEntry } from '../presets/prompt-order'
import { messageTokens } from '../context/budget'

type EntryDraft = Omit<PromptEntry, 'keys'> & { id: string; original: Record<string, unknown>; keywords: string }
type Kind = 'mini' | 'preset'

const collections = {
  mini: { editor: 'world-book-editor-screen', list: 'world-book-screen', table: 'worldBooks', title: 'Mini Prompts' },
  preset: { editor: 'preset-editor-screen', list: 'preset-screen', table: 'presets', title: 'Preset' },
} as const satisfies Record<Kind, { editor: ScreenId; list: ScreenId; table: string; title: string }>

function entryDraft(raw?: unknown): EntryDraft {
  const source = record(raw)
  return {
    id: crypto.randomUUID(), original: source,
    comment: string(source.comment), keywords: keywords(source.keys).join(', '),
    content: string(source.content), enabled: source.enabled !== false,
    slot: promptSlot(source.slot), role: source.role === undefined ? undefined : promptRole(source.role),
  }
}

function CollectionForm({ database, id, kind }: { database: LocalDatabase; id: Key; kind: Kind }) {
  const collection = collections[kind]
  const [book, setBook] = useState<StoredRow>()
  const [name, setName] = useState('')
  const [entries, setEntries] = useState<EntryDraft[]>([])
  const [newEntry, setNewEntry] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void database[collection.table].get(id)
      .then(saved => {
        if (cancelled) return
        if (!saved) { showScreen(collection.list); return }
        setBook(saved)
        setName(String(saved.name ?? ''))
        setEntries(Array.isArray(saved.content) ? saved.content.map(entryDraft) : [])
      })
      .catch(() => { if (!cancelled) setError('Could not load this collection.') })
    return () => { cancelled = true }
  }, [database, collection, id])

  function edit(id: string, changes: Partial<EntryDraft>) {
    setEntries(current => current.map(entry => entry.id === id ? { ...entry, ...changes } : entry))
  }

  async function save() {
    if (!book || busy || !name.trim()) return
    setBusy(true)
    setError('')
    const saved = {
      ...book,
      name: name.trim(),
      content: entries.filter(entry => entry.slot || entry.comment.trim() || entry.content.trim()).map(entry => ({
        ...entry.original,
        comment: entry.comment.trim(),
        keys: keywords(entry.keywords),
        content: entry.content.trim(),
        enabled: entry.enabled,
        ...(kind === 'preset' ? { role: entry.role, slot: entry.slot } : {}),
      })),
    }
    try {
      if (!await database[collection.table].update(id, saved)) throw new Error('This collection was deleted.')
      if (kind === 'mini') updateCachedWorldBook(saved)
      else runtime.state.presets = await database.presets.toArray() as typeof runtime.state.presets
      showScreen(collection.list)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save this collection.')
      setBusy(false)
    }
  }

  async function remove() {
    if (!book || busy) return
    setBusy(true)
    setError('')
    try {
      if (await confirmDeletePromptCollection(collection.table, book)) showScreen(collection.list)
    } catch {
      setError('Could not delete this collection.')
    } finally {
      setBusy(false)
    }
  }

  const keyPrefix = kind === 'preset' ? 'preset' : 'world-book'
  return <>
    <PhoneFeatureHeader title={name || collection.title} onBack={() => showScreen(collection.list)} backDisabled={busy} actions={<>
      <IconButton icon="trash" label={'Delete ' + collection.title} disabled={!book || busy} onClick={() => void remove()} />
      <HeaderSaveButton label={kind === 'preset' ? 'Save preset' : 'Save Mini Prompts'}
        id={kind === 'preset' ? 'save-preset-btn' : 'save-world-book-btn'} form={keyPrefix + '-form'}
        disabled={!book || busy || !name.trim()} />
    </>} />
    <form id={keyPrefix + '-form'} className="phone-app-scroll phone-app-stack prompt-collection-editor"
      onSubmit={event => { event.preventDefault(); void save() }}>
      {error && <p className="phone-app-error" role="alert">{error}</p>}
      <label>{collection.title} name<input id={keyPrefix + '-name-input'} value={name} onChange={event => setName(event.target.value)} required /></label>
      <PromptEntryList rows={entries.map((entry, i) => ({ id: entry.id, title: entry.comment || entry.content.trim().split('\n')[0] || 'Entry ' + (i + 1),
        marker: Boolean(entry.slot), enabled: entry.enabled,
        detail: kind === 'preset' ? entry.slot ? 'Context' : entry.content.trim()
          ? '~' + messageTokens({ role: entry.role ?? 'system', content: entry.content.trim() }) : '—' : undefined }))}
        openNew={newEntry}
        showTokens={kind === 'preset'}
        move={(from, to) => setEntries(current => movePromptEntry(current, from, to))}
        toggle={id => setEntries(current => current.map(entry => entry.id === id ? { ...entry, enabled: !entry.enabled } : entry))}
        fields={id => {
          const entry = entries.find(row => row.id === id)!
          return <>
            <label>Title<input value={entry.comment} className="entry-comment-input" onChange={event => edit(id, { comment: event.target.value })} /></label>
            {kind === 'preset' && <div className="phone-app-two">
              <label>Source<select value={entry.slot ?? ''} onChange={event => edit(id, { slot: promptSlot(event.target.value) })}>
                <option value="">Custom text</option>
                {Object.entries(promptSlots).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>
              {!entry.slot && <label>Role<select value={entry.role ?? 'system'} onChange={event => edit(id, { role: promptRole(event.target.value) })}>
                <option value="system">System</option><option value="user">User</option><option value="assistant">Assistant</option>
              </select></label>}
            </div>}
            {!entry.slot && <>
              {kind === 'mini' && <label>Keywords (comma-separated)<input value={entry.keywords} className="entry-keys-input"
                onChange={event => edit(id, { keywords: event.target.value })} /></label>}
              <label>Content<textarea rows={5} className="entry-content-textarea" value={entry.content} onChange={event => edit(id, { content: event.target.value })} /></label>
            </>}
            <IconButton icon="trash" label="Remove entry" onClick={() => setEntries(current => current.filter(item => item.id !== id))} />
          </>
        }} />
      <button id={kind === 'preset' ? 'add-preset-entry-btn' : 'add-world-book-entry-btn'} type="button" className="phone-app-button compact"
        disabled={!book || busy} onClick={() => {
          const entry = entryDraft(kind === 'preset' ? { role: 'system' } : undefined)
          setEntries(current => [...current, entry])
          setNewEntry(entry.id)
        }}>+ Add entry</button>
    </form>
  </>
}

export function PromptCollectionEditor({ database, kind }: { database?: LocalDatabase; kind: Kind }) {
  const { state } = useLocation()
  const collection = collections[kind]
  const visible = useContext(ScreenContext) === collection.editor
  const id: unknown = state?.bookId
  return <Screen id={collection.editor} className="phone-feature">
    {database && visible && (typeof id === 'string' || typeof id === 'number') &&
      <CollectionForm key={id} database={database} id={id} kind={kind} />}
  </Screen>
}

export function WorldBookEditorScreen({ database }: { database?: LocalDatabase }) {
  return <PromptCollectionEditor kind="mini" database={database} />
}
