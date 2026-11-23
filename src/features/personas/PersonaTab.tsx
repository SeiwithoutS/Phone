import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon, IconButton } from '../../components/icons'
import type { LocalDatabase } from '../../storage/database'
import type { StoredRow } from '../../../shared/storage'
import { fileDataUrl, imageSource } from '../../runtime/files'
import { runtime } from '../../legacy/runtime/state.js'

type Persona = StoredRow & { id: string; name?: string; avatar: string; persona: string }
const empty = () => ({ id: crypto.randomUUID(), name: '', avatar: '', persona: '' })
const defaultKey = 'default-persona'
const eventName = 'eephone:personas'
const label = (entry: Persona) => entry.name || entry.persona?.split('\n')[0]?.slice(0, 36) || 'Persona'

export function PersonaTab({ database }: { database?: LocalDatabase }) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selected, setSelected] = useState('')
  const [draft, setDraft] = useState<Persona>()
  const [chatId, setChatId] = useState('')
  const [pendingDelete, setPendingDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const current = personas.find(entry => entry.id === selected)
  const chats = Object.values(runtime.state.chats).filter(chat => chat !== undefined).filter(chat => !chat.isGroup)

  useEffect(() => {
    if (!database) return
    let mounted = true
    const refresh = () => void database.personaPresets.toArray().then(rows => {
      if (mounted) setPersonas(rows as Persona[])
    }).catch(() => { if (mounted) setNotice('Could not load personas.') })
    refresh()
    window.addEventListener(eventName, refresh)
    return () => { mounted = false; window.removeEventListener(eventName, refresh) }
  }, [database])

  useEffect(() => {
    if (!personas.some(entry => entry.id === selected)) {
      const preferred = personas.find(entry => entry.id === database?.getPreference(defaultKey))
      setSelected(preferred?.id || personas[0]?.id || '')
    }
  }, [database, personas, selected])

  async function act(operation: () => Promise<void>) {
    if (!database || busy) return
    setBusy(true)
    setNotice('')
    try { await operation() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save persona.') }
    finally { setBusy(false) }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || !database) return
    const name = draft.name?.trim()
    if (!name || /[<>"]/.test(name)) { setNotice('Enter a display name without angle brackets or quotes.'); return }
    if (draft.avatar && !imageSource(draft.avatar)) { setNotice('Choose an image or use a valid image URL.'); return }
    await act(async () => {
      const next = { ...draft, name, persona: draft.persona.trim() }
      await database.personaPresets.put(next)
      const rows = await database.personaPresets.toArray()
      runtime.state.personaPresets = rows as typeof runtime.state.personaPresets
      setPersonas(rows as Persona[])
      setSelected(next.id)
      setDraft(undefined)
    })
  }

  return <section className="persona-tab phone-app-stack">
    {draft ? <form className="phone-app-card phone-app-stack" onSubmit={save}>
      <h2>{personas.some(entry => entry.id === draft.id) ? 'Edit persona' : 'New persona'}</h2>
      <label>Display name<input required maxLength={72} value={draft.name || ''} onChange={event =>
        setDraft({ ...draft, name: event.target.value })} /></label>
      <label>Description<textarea rows={5} maxLength={10000} value={draft.persona} onChange={event =>
        setDraft({ ...draft, persona: event.target.value })} /></label>
      <label>Avatar URL<input type="url" value={draft.avatar.startsWith('data:') ? '' : draft.avatar}
        onChange={event => setDraft({ ...draft, avatar: event.target.value })} /></label>
      <label>Upload avatar<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp" onChange={async event => {
        const file = event.currentTarget.files?.[0]
        if (!file) return
        try {
          const avatar = await fileDataUrl(file)
          setDraft(value => value?.id === draft.id ? { ...value, avatar } : value)
        } catch { setNotice('Could not read the avatar.') }
      }} /></label>
      <div className="phone-app-actions">
        <button type="submit" className="phone-app-button primary" disabled={busy}>Save persona</button>
        <button type="button" className="phone-app-button" disabled={busy} onClick={() => setDraft(undefined)}>Cancel</button>
      </div>
    </form> : <>
      <div className="bank-row"><h2>My personas</h2>
        <IconButton icon="plus" label="New persona" onClick={() => { setNotice(''); setDraft(empty()) }} />
      </div>
      {personas.length > 0 ? <div className="persona-picker">
        {personas.map(entry => <button type="button" key={entry.id} aria-pressed={selected === entry.id}
          onClick={() => { setSelected(entry.id); setPendingDelete(false); setNotice('') }}>
          {imageSource(entry.avatar) ? <img src={entry.avatar} alt="" /> : <Icon name="profile" />}
          <span>{label(entry)}</span>
        </button>)}
      </div> : <p className="phone-app-muted">Create a persona to choose how characters see you.</p>}
      {current && <article className="phone-app-card phone-app-stack">
        <div className="bank-row"><h2>{label(current)}</h2><div className="phone-app-actions">
          <IconButton icon="edit" label="Edit persona" onClick={() => setDraft({ ...current, name: current.name || label(current) })} />
          <IconButton icon="trash" label="Delete persona" onClick={() => setPendingDelete(true)} />
        </div></div>
        {current.persona && <p className="persona-description">{current.persona}</p>}
        {database?.getPreference(defaultKey) === current.id ? <small>Default for new chats</small> :
          <button type="button" className="phone-app-button" disabled={busy} onClick={() => void act(async () => {
            await database?.deviceSettings.put({ id: defaultKey, value: current.id })
            setNotice('Default persona updated.')
          })}>Set as default</button>}
        {chats.length > 0 && <div className="phone-app-two">
          <select aria-label="Choose a chat" value={chatId} onChange={event => setChatId(event.target.value)}>
            <option value="">Choose a chat</option>
            {chats.map(chat => <option key={chat.id} value={chat.id}>{chat.name}</option>)}
          </select>
          <button type="button" className="phone-app-button primary" disabled={!chatId || busy} onClick={() => void act(async () => {
            const chat = runtime.state.chats[chatId]
            if (!chat) return
            const changes = { myNickname: current.name || 'You', myAvatar: current.avatar || runtime.defaultAvatar, myPersona: current.persona }
            await database?.transaction('rw', 'chats', async tx => {
              const stored = await tx.chats.get(chatId)
              if (!stored) throw new Error('This chat was removed.')
              await tx.chats.update(chatId, { settings: { ...stored.settings as object, ...changes } })
            })
            Object.assign(chat.settings, changes)
            setNotice('Persona applied to ' + chat.name + '.')
          })}>Apply to chat</button>
        </div>}
        {pendingDelete && <div className="phone-app-actions">
          <button className="phone-app-button danger" type="button" disabled={busy} onClick={() => void act(async () => {
            if (!database) return
            await database.transaction('rw', database.personaPresets, database.deviceSettings, async tx => {
              await tx.personaPresets.delete(current.id)
              if (database.getPreference(defaultKey) === current.id) await tx.deviceSettings.delete(defaultKey)
            })
            runtime.state.personaPresets = runtime.state.personaPresets.filter(entry => entry.id !== current.id)
            setPersonas(entries => entries.filter(entry => entry.id !== current.id))
            setPendingDelete(false)
          })}>Confirm delete</button>
          <button className="phone-app-button" type="button" onClick={() => setPendingDelete(false)}>Cancel</button>
        </div>}
      </article>}
    </>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
