import { useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { PhoneFeatureHeader, Screen, ScreenContext } from '../../components/phone'
import { showScreen } from '../../app/routes'
import { showCustomConfirm } from '../../legacy/dialogs/dialogs.js'
import { runtime } from '../../legacy/runtime/state.js'
import { imageSource } from '../../runtime/files'
import { assignedStickers, categoryKey, createStickerCategory, deleteStickerCategory, importStickers, loadStickers,
  parseStickerLinks, readStickerFile, saveStickerCategory } from './library'
import type { Sticker, StickerCategory } from './library'
import type { LocalDatabase } from '../../storage/database'

export function StickerLibraryScreen({ database }: { database?: LocalDatabase }) {
  const active = useContext(ScreenContext) === 'sticker-library-screen'
  const { state } = useLocation()
  return <Screen id="sticker-library-screen" className="phone-feature">
    {active && database && <StickerLibrary database={database} fromChat={state?.stickerChatId} />}
  </Screen>
}

function StickerLibrary({ database, fromChat }: { database: LocalDatabase; fromChat?: string }) {
  const navigate = useNavigate()
  const upload = useRef<HTMLInputElement>(null)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [categories, setCategories] = useState<StickerCategory[]>([])
  const [filter, setFilter] = useState('all')
  const [chatId, setChatId] = useState(fromChat ?? '')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Sticker>()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const chats = Object.values(runtime.state.chats).flatMap(chat => chat ? [chat] : [])
    .sort((left, right) => left.name.localeCompare(right.name))
  const category = categories.find(item => categoryKey(item.id) === filter)
  const categoryAssignment = category ?? (filter === 'uncategorized' ? { id: 'uncategorized', name: 'Uncategorized' } : undefined)
  const assigned = new Set(assignedStickers(stickers, runtime.state.chats[chatId]).map(sticker => sticker.id))
  const needle = search.trim().toLocaleLowerCase()
  const visible = stickers.filter(sticker => (filter === 'all' ||
    (filter === 'assigned' ? assigned.has(sticker.id) : categoryKey(sticker.categoryId) === filter)) &&
    sticker.name.toLocaleLowerCase().includes(needle))

  async function reload() {
    const [nextStickers, nextCategories] = await Promise.all([loadStickers(database), database.stickerCategories.orderBy('name').toArray()])
    setStickers(nextStickers)
    setCategories(nextCategories as StickerCategory[])
    setLoaded(true)
  }

  useEffect(() => { void reload().catch(() => setError('Could not load stickers.')) }, [database])

  async function run(action: () => Promise<string>) {
    if (busy) return
    setBusy(true)
    setStatus('')
    setError('')
    try {
      const message = await action()
      await reload()
      setStatus(message)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update the sticker library.')
    } finally { setBusy(false) }
  }

  async function remove(ids: string[]) {
    const confirmed = await showCustomConfirm('Delete stickers', `Remove ${ids.length} sticker${ids.length === 1 ? '' : 's'} from the library?`,
      { confirmButtonClass: 'btn-danger' })
    if (!confirmed) return
    await run(async () => {
      await database.userStickers.bulkDelete(ids)
      setSelected(current => current.filter(id => !ids.includes(id)))
      setEditing(undefined)
      return 'Deleted ' + ids.length + (ids.length === 1 ? ' sticker.' : ' stickers.')
    })
  }

  const alert = <>{error && <p className="phone-app-error" role="alert">{error}</p>}{status && <p className="phone-app-muted" role="status">{status}</p>}</>

  return <>
    <PhoneFeatureHeader title={editing ? 'Edit sticker' : 'Stickers'} onBack={() => {
      if (editing) { setEditing(undefined); setError('') }
      else if (fromChat) void navigate(-1)
      else showScreen('home-screen')
    }} />
    {editing ? <form className="phone-app-scroll phone-app-stack" onSubmit={event => {
      event.preventDefault()
      const name = editing.name.trim()
      const url = imageSource(editing.url)
      if (!name || !url) { setError('Enter a name and a supported image.'); return }
      void run(async () => {
        if (!await database.userStickers.update(editing.id, { name, url, categoryId: editing.categoryId ?? null, chatIds: editing.chatIds ?? [] })) {
          throw new Error('This sticker is no longer available.')
        }
        setEditing(undefined)
        return 'Sticker saved.'
      })
    }}>
      <StickerImage sticker={editing} className="sticker-library-preview" />
      <label>Name<input required value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label>
      {!editing.url.startsWith('data:') && <label>Image URL<input type="url" required value={editing.url}
        onChange={event => setEditing({ ...editing, url: event.target.value })} /></label>}
      <label>Category<select value={categoryKey(editing.categoryId)} onChange={event => setEditing({ ...editing,
        categoryId: categories.find(item => categoryKey(item.id) === event.target.value)?.id ?? null })}>
        <option value="uncategorized">Uncategorized</option>
        {categories.map(item => <option key={item.id} value={categoryKey(item.id)}>{item.name}</option>)}
      </select></label>
      <fieldset className="sticker-chat-links">
        <legend>Available to</legend>
        {chats.length === 0 && <p className="phone-app-muted">Create a character in Edit to assign this sticker.</p>}
        {chats.map(chat => {
          const inherited = chat.settings.stickerCategoryIds?.some(id => categoryKey(id) === categoryKey(editing.categoryId)) === true
          const direct = editing.chatIds?.includes(chat.id) === true
          return <label className="phone-app-check" key={chat.id}>
            <input type="checkbox" checked={direct || inherited} disabled={inherited || busy} onChange={event => setEditing({ ...editing,
              chatIds: event.target.checked ? [...(editing.chatIds ?? []), chat.id] : editing.chatIds?.filter(id => id !== chat.id) })} />
            {chat.name}{inherited && <small>Via category</small>}
          </label>
        })}
      </fieldset>
      <div className="phone-app-actions">
        <button type="submit" className="phone-app-button primary" disabled={busy}>Save sticker</button>
        <button type="button" className="phone-app-button danger" disabled={busy} onClick={() => void remove([editing.id])}>Delete sticker</button>
      </div>
      {alert}
    </form> : <div className="phone-app-scroll phone-app-stack">
      <div className="phone-app-actions">
        <button type="button" className="phone-app-button primary" disabled={busy} onClick={() => upload.current?.click()}>
          <Icon name="upload" /> Import images
        </button>
        <button type="button" className="phone-app-button" disabled={busy || !stickers.length} aria-pressed={selecting} onClick={() => {
          setSelecting(!selecting)
          setSelected([])
        }}>{selecting ? 'Done selecting' : 'Select stickers'}</button>
      </div>
      <input type="file" accept="image/*" multiple hidden ref={upload} onChange={event => {
        const files = Array.from(event.currentTarget.files ?? [])
        event.currentTarget.value = ''
        if (files.length) void run(async () => {
          const entries = await Promise.all(files.map(readStickerFile))
          await importStickers(database, entries, category?.id ?? null)
          return 'Imported ' + entries.length + (entries.length === 1 ? ' sticker.' : ' stickers.')
        })
      }} />
      <details className="settings-disclosure">
        <summary>Import from links</summary>
        <form className="phone-app-stack" onSubmit={event => {
          event.preventDefault()
          const form = event.currentTarget
          const { stickers, skipped } = parseStickerLinks(String(new FormData(form).get('links')))
          void run(async () => {
            if (!stickers.length) throw new Error('Enter at least one sticker name and image link.')
            await importStickers(database, stickers, category?.id ?? null)
            form.reset()
            return 'Imported ' + stickers.length + (stickers.length === 1 ? ' sticker.' : ' stickers.') + (skipped ? ' Skipped ' + skipped + ' invalid lines.' : '')
          })
        }}>
          <label>One name and URL per line<textarea name="links" required rows={3} placeholder="Happy: https://example.com/happy.gif" /></label>
          <button type="submit" className="phone-app-button compact" disabled={busy}>Import links</button>
        </form>
      </details>
      <div className="phone-app-two">
        <label>Search<input type="search" value={search} placeholder="Sticker name" onChange={event => setSearch(event.target.value)} /></label>
        <label>Show<select value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="all">All stickers</option>
          <option value="assigned">Assigned to chat</option>
          <option value="uncategorized">Uncategorized</option>
          {categories.map(item => <option key={item.id} value={categoryKey(item.id)}>{item.name}</option>)}
        </select></label>
      </div>
      {filter === 'assigned' && <label>Chat<select value={chatId} onChange={event => setChatId(event.target.value)}>
        <option value="">Choose a character or group</option>
        {chats.map(chat => <option key={chat.id} value={chat.id}>{chat.name}</option>)}
      </select></label>}
      <details className="settings-disclosure">
        <summary>Manage categories</summary>
        <form className="phone-app-stack" onSubmit={event => {
          event.preventDefault()
          const form = event.currentTarget
          const name = String(new FormData(form).get('category')).trim()
          if (!name) return
          void run(async () => {
            const id = await createStickerCategory(database, name)
            form.reset()
            setFilter(categoryKey(id))
            return 'Category created.'
          })
        }}>
          <label>New category<input name="category" required maxLength={60} /></label>
          <button type="submit" className="phone-app-button compact" disabled={busy}>Add category</button>
        </form>
        {categoryAssignment ? <form className="phone-app-stack" key={categoryAssignment.id} onSubmit={event => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const name = String(data.get('category-name') ?? '').trim()
          const links = data.getAll('linked-chat').map(String)
          void run(async () => {
            if (category && !name) throw new Error('Enter a category name.')
            await saveStickerCategory(database, categoryAssignment.id, links, name)
            return 'Category saved.'
          })
        }}>
          {category && <label>Category name<input name="category-name" defaultValue={category.name} required maxLength={60} /></label>}
          <fieldset className="sticker-chat-links">
            <legend>Assign {categoryAssignment.name} to chats</legend>
            {chats.map(chat => <label className="phone-app-check" key={chat.id}>
              <input type="checkbox" name="linked-chat" value={chat.id} defaultChecked={chat.settings.stickerCategoryIds?.some(id =>
                categoryKey(id) === categoryKey(categoryAssignment.id))} />{chat.name}
            </label>)}
            {!chats.length && <p className="phone-app-muted">No characters or groups yet.</p>}
          </fieldset>
          <div className="phone-app-actions">
            <button type="submit" className="phone-app-button compact" disabled={busy}>Save category</button>
            {category && <button type="button" className="phone-app-button compact danger" disabled={busy} onClick={async () => {
              if (!await showCustomConfirm('Delete category', `Move stickers in ${category.name} to Uncategorized and delete the category?`,
                { confirmButtonClass: 'btn-danger' })) return
              await run(async () => {
                await deleteStickerCategory(database, category.id)
                setFilter('uncategorized')
                return 'Category deleted.'
              })
            }}>Delete category</button>}
          </div>
        </form> : <p className="phone-app-muted">Choose a category in Show to rename it or assign it to chats.</p>}
      </details>
      {selecting && <div className="phone-app-actions">
        <button type="button" className="phone-app-button compact" disabled={busy || !visible.length}
          onClick={() => setSelected(current => [...new Set([...current, ...visible.map(sticker => sticker.id)])])}>Select visible</button>
        <button type="button" className="phone-app-button compact danger" disabled={busy || !selected.length}
          onClick={() => void remove(selected)}>Delete selected ({selected.length})</button>
      </div>}
      {alert}
      {loaded && !visible.length && <p className="phone-app-muted">{filter === 'assigned' && !chatId ? 'Choose a chat to see its stickers.' : 'No stickers match this view.'}</p>}
      <div className="sticker-library-grid">
        {visible.map(sticker => <button type="button" key={sticker.id} className="phone-app-button sticker-library-card" disabled={busy}
          aria-label={(selecting ? 'Select ' : 'Edit ') + sticker.name} aria-pressed={selecting ? selected.includes(sticker.id) : undefined}
          onClick={() => {
            if (selecting) setSelected(current => current.includes(sticker.id) ? current.filter(id => id !== sticker.id) : [...current, sticker.id])
            else { setEditing(sticker); setError(''); setStatus('') }
          }}>
          <StickerImage sticker={sticker} />
          <span>{sticker.name}</span>
          {selecting ? <Icon name={selected.includes(sticker.id) ? 'check' : 'plus'} /> : <Icon name="edit" />}
        </button>)}
      </div>
    </div>}
  </>
}

function StickerImage({ sticker, className = '' }: { sticker: Sticker; className?: string }) {
  const source = imageSource(sticker.url)
  return <span className={'sticker-library-image ' + className}>
    {source && <img src={source} alt="" loading="lazy" />}
  </span>
}
