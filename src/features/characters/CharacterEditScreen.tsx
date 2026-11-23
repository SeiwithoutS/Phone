import { useContext, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PhoneAvatar, PhoneFeatureHeader, Screen, ScreenContext } from '../../components/phone'
import { showScreen } from '../../app/routes'
import { fileDataUrl, imageSource } from '../../runtime/files'
import { blankCharacter, readCharacterCard } from './card'
import type { CharacterDraft } from './card'
import { getCharacterDraft, getCharacters, saveCharacter } from './characters'
import { normalizeGallery } from './gallery'
import type { AvatarGallery } from './gallery'

const avatarFormats = 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,image/apng'

export function CharacterEditScreen({ ready }: { ready: boolean }) {
  const active = useContext(ScreenContext) === 'character-edit-screen'
  const location = useLocation()
  return <Screen id="character-edit-screen" className="phone-feature">
    {active && ready && <Editor key={location.key} path={location.pathname} />}
  </Screen>
}

function Editor({ path }: { path: string }) {
  const navigate = useNavigate()
  const characters = getCharacters()
  const selected = path.match(/^\/edit\/([^/]+)\/?$/)?.[1]
  const character = characters.find(chat => encodeURIComponent(chat.id) === selected)
  const [draft, setDraft] = useState<CharacterDraft | undefined>(() => character ? getCharacterDraft(character) : undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const importInput = useRef<HTMLInputElement>(null)
  const set = <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) =>
    setDraft(current => current && ({ ...current, [key]: value }))

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || busy) return
    const avatar = imageSource(draft.avatar)
    if (draft.avatar && !avatar) {
      setError('Use an HTTP(S) avatar URL or a supported image file.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const id = await saveCharacter({ ...draft, avatar })
      if (draft.id === id) {
        setDraft({ ...draft, avatar })
      } else {
        void navigate('/edit/' + encodeURIComponent(id), { replace: true })
      }
      setError('Saved. This character is available in QQ.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save this character.')
    } finally {
      setBusy(false)
    }
  }

  const pickCard = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const card = await readCharacterCard(file)
      setDraft(card)
      setError(card.avatar ? '' : 'This card has no embedded or linked image. You can upload an avatar below.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not import this character.')
    } finally { setBusy(false) }
  }

  return <>
    <PhoneFeatureHeader title={draft ? (draft.id ? 'Edit character' : 'New character') : 'Edit'} onBack={() => {
      if (selected) void navigate('/edit')
      else if (draft) { setDraft(undefined); setError('') }
      else showScreen('home-screen')
    }} />
    <input ref={importInput} type="file" hidden accept=".png,.json,.charx" onChange={event => {
      const input = event.currentTarget
      if (input.files?.[0]) void pickCard(input.files[0])
      input.value = ''
    }} />
    {draft ? <form className="phone-app-scroll phone-app-stack" onSubmit={save}>
      <div className="phone-app-profile">
        <PhoneAvatar source={draft.avatar} name={draft.name} />
        <div>
          <label>Upload avatar<input type="file" accept={avatarFormats} onChange={async event => {
            const file = event.currentTarget.files?.[0]
            if (file) {
              try { set('avatar', await fileDataUrl(file)); setError('') } catch { setError('Could not read the avatar.') }
            }
          }} /></label>
          {draft.avatar && <button type="button" className="phone-app-button" onClick={() => set('avatar', '')}>Remove avatar</button>}
        </div>
      </div>
      <label>Avatar URL<input type="url" value={draft.avatar.startsWith('data:') ? '' : draft.avatar} onChange={event => set('avatar', event.target.value)} /></label>
      <GallerySettings value={draft.gallery} avatar={draft.avatar} name={draft.name} change={value => set('gallery', value)}
        useAsMain={url => set('avatar', url)} />
      <div className="phone-app-two">
        <label>Name<input required value={draft.name} onChange={event => set('name', event.target.value)} /></label>
        <label>Nickname<input value={draft.nickname} onChange={event => set('nickname', event.target.value)} /></label>
      </div>
      <label>Description<textarea rows={5} value={draft.description} onChange={event => set('description', event.target.value)} /></label>
      <label>First message<textarea rows={5} value={draft.firstMessage} onChange={event => set('firstMessage', event.target.value)} /></label>
      {draft.alternateGreetings.map((text, index) => <div className="phone-app-stack" key={index}>
        <label>Alternate opening {index + 1}<textarea rows={4} value={text} onChange={event =>
          set('alternateGreetings', draft.alternateGreetings.map((item, i) => i === index ? event.target.value : item))} /></label>
        <button type="button" className="phone-app-button compact" onClick={() =>
          set('alternateGreetings', draft.alternateGreetings.filter((_, i) => i !== index))}>Remove opening {index + 1}</button>
      </div>)}
      <button type="button" className="phone-app-button compact" onClick={() => set('alternateGreetings', [...draft.alternateGreetings, ''])}>+ Alternate opening</button>
      {draft.lorebook && <p className="phone-app-muted">World Info · {draft.lorebook.name} ({draft.lorebook.content.length} entries)</p>}
      <div className="phone-app-actions">
        <button type="submit" className="phone-app-button primary" disabled={busy}>Save character</button>
        {draft.id && <button type="button" className="phone-app-button" onClick={() => showScreen('chat-list-screen')}>Open QQ</button>}
      </div>
      {error && <p role="status" className={error.startsWith('Saved') ? 'phone-app-muted' : 'phone-app-error'}>{error}</p>}
    </form> : <div className="phone-app-scroll phone-app-stack">
      <div className="phone-app-actions">
        <button type="button" className="phone-app-button primary" disabled={busy} onClick={() => { setDraft(blankCharacter()); setError('') }}>New character</button>
        <button type="button" className="phone-app-button" disabled={busy} onClick={() => importInput.current?.click()}>Import card</button>
      </div>
      <small>PNG, JSON or CHARX</small>
      {error && <p className="phone-app-error" role="alert">{error}</p>}
      {characters.length === 0 && <p className="phone-app-muted">Create a character or import a card to start.</p>}
      {characters.map(chat => <button type="button" key={chat.id} className="phone-app-button phone-app-list-row"
        onClick={() => void navigate('/edit/' + encodeURIComponent(chat.id))}>
        <PhoneAvatar source={chat.settings.aiAvatar} name={chat.name} />
        <span><strong>{chat.name}</strong>{chat.originalName !== chat.name && <small>{chat.originalName}</small>}</span>
      </button>)}
    </div>}
  </>
}

function GallerySettings({ value, avatar, name, change, useAsMain }: {
  value?: AvatarGallery; avatar: string; name: string
  change: (value: AvatarGallery) => void; useAsMain: (url: string) => void
}) {
  const gallery = value ?? normalizeGallery()
  const photos = [...new Set([avatar, ...gallery.photos].filter(Boolean))]
  const [url, setUrl] = useState('')
  const [notice, setNotice] = useState('')
  const [reading, setReading] = useState(false)
  const update = (patch: Partial<AvatarGallery>) => change({ ...gallery, ...patch, startedAt: Date.now() })
  function add(sources: string[]) {
    const images = sources.map(imageSource).filter(Boolean)
    if (!images.length) { setNotice('Choose a supported image or enter an HTTP(S) image URL.'); return }
    const all = [...new Set([...gallery.photos, ...images])]
    update({ photos: all.slice(0, 24) })
    setNotice(all.length > 24 ? 'The gallery holds up to 24 images.' : '')
  }
  return <details className="settings-disclosure">
    <summary>Avatar Gallery <small>{photos.length} photos</small></summary>
    <div className="phone-app-stack">
      <div className="character-gallery">{photos.map((photo, index) => <div key={photo} className="gallery-photo">
        <PhoneAvatar source={photo} name={name} />
        <button type="button" className="phone-app-button compact" disabled={photo === avatar} onClick={() => useAsMain(photo)}>
          {photo === avatar ? 'Main' : 'Set as main'}
        </button>
        <button type="button" className="phone-app-button compact danger" aria-label={'Remove gallery photo ' + (index + 1)}
          disabled={reading || photo === avatar} onClick={() => update({ photos: gallery.photos.filter(item => item !== photo) })}>Remove</button>
      </div>)}</div>
      <label>Add gallery photos<input type="file" multiple accept={avatarFormats} disabled={reading} onChange={async event => {
        const input = event.currentTarget
        const files = Array.from(input.files ?? [])
        input.value = ''
        if (!files.length) return
        setReading(true)
        try { add(await Promise.all(files.slice(0, 24).map(fileDataUrl))) }
        catch { setNotice('Could not read the gallery images.') }
        finally { setReading(false) }
      }} /></label>
      <div className="phone-app-actions">
        <label>Gallery image URL<input value={url} onChange={event => setUrl(event.target.value)} /></label>
        <button type="button" className="phone-app-button" disabled={!url.trim() || reading} onClick={() => {
          if (imageSource(url)) { add([url]); setUrl('') } else setNotice('Enter an HTTP(S) image URL.')
        }}>Add URL</button>
      </div>
      <label className="phone-app-check"><input type="checkbox" checked={gallery.mode !== 'off'}
        onChange={event => update({ mode: event.target.checked ? 'timer' : 'off' })} /> Automatically change QQ avatar</label>
      {gallery.mode !== 'off' && <>
        <label>Change avatar<select value={gallery.mode} onChange={event => update({ mode: event.target.value as AvatarGallery['mode'] })}>
          <option value="timer">On a timer</option><option value="calls">By connected call count</option>
        </select></label>
        {gallery.mode === 'timer'
          ? <label>Minutes between changes<input type="number" min={1} max={1440} required value={gallery.minutes || ''}
            onChange={event => update({ minutes: Number(event.target.value) })} /></label>
          : <label>Connected QQ calls between changes<input type="number" min={1} max={99} required value={gallery.everyCalls || ''}
            onChange={event => update({ everyCalls: Number(event.target.value) })} /></label>}
        <label className="phone-app-check"><input type="checkbox" checked={gallery.shuffle}
          onChange={event => update({ shuffle: event.target.checked })} /> Shuffle images</label>
        {!gallery.photos.some(photo => photo !== avatar) && <p className="phone-app-muted">Add another image before rotating.</p>}
      </>}
      {notice && <p role="status">{notice}</p>}
    </div>
  </details>
}
