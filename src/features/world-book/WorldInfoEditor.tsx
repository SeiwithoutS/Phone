import { useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { showScreen } from '../../app/routes'
import { BackButton, FormField, Screen, ScreenContext, ScreenHeader } from '../../components/phone'
import type { Key, StoredRow } from '../../../shared/storage'
import type { LocalDatabase } from '../../storage/database'
import { updateCachedWorldBook } from '../../legacy/world-book/books.js'

interface EntryDraft {
  key: string
  original: Record<string, unknown>
  comment: string
  keywords: string
  content: string
  enabled: boolean
}

function entryDraft(source: Record<string, unknown> = {}): EntryDraft {
  return {
    key: crypto.randomUUID(),
    original: source,
    comment: String(source.comment ?? ''),
    keywords: Array.isArray(source.keys) ? source.keys.join(', ') : '',
    content: String(source.content ?? ''),
    enabled: source.enabled !== false,
  }
}

function WorldInfoForm({ database, id }: { database: LocalDatabase; id: Key }) {
  const [book, setBook] = useState<StoredRow>()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<StoredRow[]>([])
  const [entries, setEntries] = useState<EntryDraft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)

  useEffect(() => {
    active.current = true
    let cancelled = false
    void Promise.all([database.worldBooks.get(id), database.worldBookCategories.toArray()])
      .then(([record, choices]) => {
        if (cancelled) return
        if (!record) { showScreen('world-book-screen'); return }
        setBook(record)
        setName(String(record.name ?? ''))
        setCategory(String(record.categoryId ?? ''))
        setCategories(choices)
        setEntries(Array.isArray(record.content) ? record.content.map(item => entryDraft(item ?? {})) : [])
      })
      .catch(() => { if (!cancelled) setError('Could not load this Mini Prompts book.') })
    return () => { cancelled = true; active.current = false }
  }, [database, id])

  function edit(key: string, values: Partial<Pick<EntryDraft, 'comment' | 'keywords' | 'content' | 'enabled'>>) {
    setEntries(current => current.map(entry => entry.key === key ? { ...entry, ...values } : entry))
  }

  async function save() {
    if (!book || busy || !name.trim()) return
    setBusy(true)
    setError('')
    const saved = {
      ...book,
      name: name.trim(),
      categoryId: categories.find(item => String(item.id) === category)?.id ?? null,
      content: entries.filter(entry => entry.content.trim()).map(entry => ({
        ...entry.original,
        comment: entry.comment.trim(),
        keys: entry.keywords.split(',').map(key => key.trim()).filter(Boolean),
        content: entry.content.trim(),
        enabled: entry.enabled,
      })),
    }
    try {
      if (!await database.worldBooks.update(id, saved)) throw new Error('This book was deleted.')
      updateCachedWorldBook(saved)
      if (active.current) showScreen('world-book-screen')
    } catch (cause) {
      if (active.current) {
        setError(cause instanceof Error ? cause.message : 'Could not save this book.')
        setBusy(false)
      }
    }
  }

  return <>
    <ScreenHeader>
      <BackButton onClick={() => showScreen('world-book-screen')} />
      <span id="world-book-editor-title">{String(book?.name ?? 'Edit Mini Prompts')}</span>
      <button form="world-info-form" className="phone-button save-btn" id="save-world-book-btn" type="submit"
        disabled={!book || busy || !name.trim()}>Save</button>
    </ScreenHeader>
    <form id="world-info-form" className="form-container" onSubmit={event => { event.preventDefault(); void save() }}>
      {error && <p role="alert">{error}</p>}
      <FormField id="world-book-name-input" label="Book Name">
        <input id="world-book-name-input" value={name} onChange={event => setName(event.target.value)} required />
      </FormField>
      <FormField id="world-book-category-select" label="Category">
        <select id="world-book-category-select" value={category} onChange={event => setCategory(event.target.value)}>
          <option value="">Uncategorized</option>
          {categories.map(item => <option key={item.id} value={item.id}>{String(item.name)}</option>)}
        </select>
      </FormField>
      <div id="world-book-entries-container" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
        {entries.length === 0 && <p>Use Add Entry below to get started.</p>}
        {entries.map(entry => <fieldset key={entry.key} className="message-editor-block">
          <legend className="sr-only">Mini Prompts entry</legend>
          <div className="mb-2 flex items-center justify-end gap-3">
            <label><input type="checkbox" className="entry-enabled-switch" checked={entry.enabled}
              onChange={event => edit(entry.key, { enabled: event.target.checked })} /> Enabled</label>
            <button className="delete-block-btn" type="button" aria-label="Remove entry"
              onClick={() => setEntries(current => current.filter(item => item.key !== entry.key))}>×</button>
          </div>
          <FormField id={entry.key + '-note'} label="Note (optional)">
            <input id={entry.key + '-note'} className="entry-comment-input" value={entry.comment}
              onChange={event => edit(entry.key, { comment: event.target.value })} />
          </FormField>
          <FormField id={entry.key + '-keys'} label="Keywords (comma-separated)">
            <input id={entry.key + '-keys'} className="entry-keys-input" value={entry.keywords}
              onChange={event => edit(entry.key, { keywords: event.target.value })} />
          </FormField>
          <FormField id={entry.key + '-text'} label="Content">
            <textarea id={entry.key + '-text'} className="entry-content-textarea" value={entry.content}
              onChange={event => edit(entry.key, { content: event.target.value })} />
          </FormField>
        </fieldset>)}
      </div>
      <button id="add-world-book-entry-btn" type="button" className="form-button form-button-secondary"
        disabled={!book || busy} onClick={() => setEntries(current => [...current, entryDraft()])}>+ Add Entry</button>
    </form>
  </>
}

export function WorldBookEditorScreen({ database }: { database?: LocalDatabase }) {
  const { state } = useLocation()
  const visible = useContext(ScreenContext) === 'world-book-editor-screen'
  const id: unknown = state?.bookId
  return <Screen id="world-book-editor-screen">
    {database && visible && (typeof id === 'string' || typeof id === 'number')
      && <WorldInfoForm key={id} id={id} database={database} />}
  </Screen>
}
