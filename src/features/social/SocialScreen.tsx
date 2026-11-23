import { useContext, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { PhoneAvatar, PhoneFeatureHeader, Screen, ScreenContext } from '../../components/phone'
import { showScreen } from '../../app/routes'
import { fileDataUrl, imageSource } from '../../runtime/files'
import { getCharacters } from '../characters/characters'
import { characterAvatar } from '../characters/gallery'
import { createAiComment, defaultSocialProfile, profileKey } from './social'
import type { LocalDatabase } from '../../storage/database'
import type { Post, SocialProfile } from './social'

const preferencesKey = 'social-ai-comments'
const pending = new Set<string>()
const listeners = new Set<() => void>()
const refreshFeed = () => listeners.forEach(listener => listener())
const tabs = ['Timeline', 'My profile', 'Saved'] as const

function settings(database: LocalDatabase) {
  const value = database.getPreference(preferencesKey) as { ai?: boolean; characterId?: string } | null
  return { ai: value?.ai === true, characterId: value?.characterId ?? '' }
}

async function readImage(file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MiB.')
  const source = imageSource(await fileDataUrl(file))
  if (!source) throw new Error('Choose a PNG, JPEG, WebP, GIF or other supported image.')
  return source
}

export function SocialScreen({ database }: { database?: LocalDatabase }) {
  const active = useContext(ScreenContext) === 'social-screen'
  return <Screen id="social-screen" className="phone-feature social-app">
    {active && database && <SocialFeed database={database} />}
  </Screen>
}

function SocialFeed({ database }: { database: LocalDatabase }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [profile, setProfile] = useState(() => ({
    ...defaultSocialProfile(), ...(database.getPreference(profileKey) as Partial<SocialProfile> | null),
  }))
  const [tab, setTab] = useState<typeof tabs[number]>('Timeline')
  const [query, setQuery] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [preferences, setPreferences] = useState(() => settings(database))
  const [updatingSettings, setUpdatingSettings] = useState(false)
  const [error, setError] = useState('')
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({})
  const characters = getCharacters()
  const characterId = characters.some(chat => chat.id === preferences.characterId) ? preferences.characterId : characters[0]?.id ?? ''

  useEffect(() => {
    let active = true
    const refresh = () => {
      void database.socialPosts.orderBy('time').reverse().toArray().then(rows => {
        if (active) setPosts(rows as Post[])
      }).catch(() => { if (active) setError('Could not load the timeline.') })
    }
    refresh()
    listeners.add(refresh)
    return () => { active = false; listeners.delete(refresh) }
  }, [database])

  async function configure(value: typeof preferences) {
    setUpdatingSettings(true)
    setError('')
    try {
      await database.deviceSettings.put({ id: preferencesKey, value })
      setPreferences(value)
    } catch { setError('Could not save AI comment settings.') }
    finally { setUpdatingSettings(false) }
  }

  async function updatePost(id: string, update: (post: Post) => Partial<Post>) {
    await database.transaction('rw', database.socialPosts, async tx => {
      const post = await tx.socialPosts.get(id) as Post | undefined
      if (!post) return
      const changes = update(post)
      if (Object.keys(changes).length) await tx.socialPosts.update(id, changes)
    })
    refreshFeed()
  }

  async function generate(post: Post) {
    const current = settings(database)
    if (!current.ai || pending.has(post.id)) return
    pending.add(post.id)
    setCommentErrors(state => ({ ...state, [post.id]: '' }))
    refreshFeed()
    try {
      const latest = await database.socialPosts.get(post.id) as Post | undefined
      if (!latest || latest.comments.some(comment => comment.ai) || !settings(database).ai) return
      const available = getCharacters()
      const character = available.find(chat => chat.id === current.characterId) ?? available[0]
      if (!character) throw new Error('Create a character in Edit to enable AI replies.')
      const text = await createAiComment(latest, character)
      await updatePost(post.id, fresh => fresh.comments.some(comment => comment.ai) || !settings(database).ai ? {} : ({
        comments: [...fresh.comments, { id: crypto.randomUUID(), author: character.name, text, ai: true, avatar: characterAvatar(character) }],
      }))
    } catch (failure) {
      setCommentErrors(state => ({ ...state, [post.id]: failure instanceof Error ? failure.message : 'AI comment failed.' }))
    } finally {
      pending.delete(post.id)
      refreshFeed()
    }
  }

  async function publish(text: string, image: string) {
    const post: Post = { id: crypto.randomUUID(), author: profile.name, text, image, time: Date.now(), liked: false, comments: [] }
    await database.socialPosts.add(post)
    refreshFeed()
    void generate(post)
  }

  const needle = query.trim().toLocaleLowerCase()
  const visible = posts.filter(post => (tab !== 'Saved' || post.bookmarked) &&
    (!needle || [post.text, post.author, ...post.comments.map(comment => comment.text)].some(text => text.toLocaleLowerCase().includes(needle))))
  if (tab === 'Timeline') visible.sort((left, right) => (right.repostedAt || right.time) - (left.repostedAt || left.time))

  return <>
    <PhoneFeatureHeader title="Social" onBack={() => showScreen('home-screen')} />
    <div className="phone-app-scroll social-scroll">
      <nav className="social-tabs" aria-label="Social views">
        {tabs.map(item => <button type="button" key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => {
          setTab(item); setQuery(''); setEditingProfile(false)
        }}>{item}</button>)}
      </nav>

      {tab === 'My profile' && <section className="social-profile">
        <div className="social-banner">{imageSource(profile.banner) && <img src={profile.banner} alt="" />}</div>
        <div className="social-profile-info">
          <PhoneAvatar source={profile.avatar} name={profile.name} />
          <button className="phone-app-button compact" type="button" onClick={() => setEditingProfile(!editingProfile)}>
            {editingProfile ? 'Close editor' : 'Edit profile'}
          </button>
          <h2>{profile.name}</h2>
          <span className="social-meta">@{profile.handle} · {posts.length} {posts.length === 1 ? 'post' : 'posts'}</span>
          {profile.bio && <p className="social-text">{profile.bio}</p>}
        </div>
        {editingProfile && <ProfileEditor profile={profile} save={async value => {
          await database.deviceSettings.put({ id: profileKey, value })
          setProfile(value)
          setEditingProfile(false)
        }} />}
      </section>}

      {tab === 'Timeline' && <>
        <PostComposer profile={profile} submit={publish} />
        <details className="settings-disclosure social-ai-settings">
          <summary>AI comments</summary>
          <label className="phone-app-check">
            <input type="checkbox" role="switch" checked={preferences.ai} disabled={updatingSettings}
              onChange={event => void configure({ ai: event.target.checked, characterId })} /> Auto AI comment
          </label>
          {preferences.ai && (characters.length > 0 ? <label>Comment as<select value={characterId} disabled={updatingSettings}
            onChange={event => void configure({ ai: true, characterId: event.target.value })}>
            {characters.map(chat => <option key={chat.id} value={chat.id}>{chat.name}</option>)}
          </select></label> : <p className="phone-app-muted">Create a character in Edit to receive AI comments.</p>)}
        </details>
      </>}

      {(posts.length > 0 || needle) && <label className="social-search">
        <span>Search posts</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search posts and replies" />
      </label>}
      {error && <p className="phone-app-error" role="alert">{error}</p>}
      {!visible.length && <p className="social-empty">
        {needle ? 'No matching posts.' : tab === 'Saved' ? 'Saved posts will appear here.' : 'Your posts will appear here.'}
      </p>}
      <div className="social-timeline">
        {visible.map(post => <FeedPost key={post.id} post={post} profile={profile}
          ai={preferences.ai} pendingReply={pending.has(post.id)} aiError={commentErrors[post.id]}
          generate={() => void generate(post)} update={change => updatePost(post.id, change)}
          remove={async () => { await database.socialPosts.delete(post.id); refreshFeed() }} />)}
      </div>
    </div>
  </>
}

function ProfileEditor({ profile, save }: { profile: SocialProfile; save: (value: SocialProfile) => Promise<void> }) {
  const [value, setValue] = useState(profile)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (key: keyof SocialProfile, next: string) => setValue(current => ({ ...current, [key]: next }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    const name = value.name.trim()
    const handle = value.handle.trim().replace(/^@/, '').toLowerCase()
    if (!name || !/^[a-z0-9_]{1,24}$/.test(handle)) {
      setError('Enter a name and a handle of 1–24 letters, numbers or underscores.')
      return
    }
    setBusy(true)
    try { await save({ ...value, name, handle, bio: value.bio.trim() }) }
    catch { setError('Could not save your profile.') }
    finally { setBusy(false) }
  }

  return <form className="social-profile-form phone-app-stack" onSubmit={submit}>
    <div className="phone-app-two">
      <label>Display name<input required value={value.name} maxLength={60} onChange={event => update('name', event.target.value)} /></label>
      <label>Handle<input required value={value.handle} maxLength={25} onChange={event => update('handle', event.target.value)} /></label>
    </div>
    <label>Bio<textarea rows={2} maxLength={200} value={value.bio} onChange={event => update('bio', event.target.value)} /></label>
    {(['avatar', 'banner'] as const).map(key => <div className="phone-app-actions" key={key}>
      <label>{key === 'avatar' ? 'Profile avatar' : 'Profile banner'}
        <input type="file" accept="image/*" disabled={busy} onChange={async event => {
          const file = event.currentTarget.files?.[0]
          if (!file) return
          setBusy(true)
          setError('')
          try { update(key, await readImage(file)) }
          catch (failure) { setError((failure as Error).message) }
          finally { setBusy(false) }
        }} />
      </label>
      {value[key] && <button type="button" className="phone-app-button compact" onClick={() => update(key, '')}>Remove {key}</button>}
    </div>)}
    {error && <p role="alert" className="phone-app-error">{error}</p>}
    <button type="submit" className="phone-app-button primary" disabled={busy}>Save profile</button>
  </form>
}

function PostComposer({ profile, submit, post }: {
  profile: SocialProfile; post?: Post; submit: (text: string, image: string) => Promise<void>
}) {
  const [text, setText] = useState(post?.text ?? '')
  const [image, setImage] = useState(post?.image ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  return <form className="social-compose phone-app-stack" onSubmit={async event => {
    event.preventDefault()
    if (busy || (!text.trim() && !image)) return
    setBusy(true)
    setError('')
    try {
      await submit(text.trim(), image)
      if (!post) { setText(''); setImage('') }
    } catch { setError('Could not save your post.') } finally { setBusy(false) }
  }}>
    <div className="social-compose-body">
      <PhoneAvatar source={profile.avatar} name={profile.name} />
      <label>{post ? 'Edit post text' : 'New post'}
        <textarea rows={3} maxLength={1000} placeholder="Write a post" value={text} onChange={event => setText(event.target.value)} />
      </label>
    </div>
    {image && <img className="social-media" src={image} alt="Attached to post" />}
    <input ref={input} type="file" accept="image/*" hidden onChange={async event => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (!file) return
      setBusy(true)
      setError('')
      try { setImage(await readImage(file)) }
      catch (failure) { setError((failure as Error).message) } finally { setBusy(false) }
    }} />
    <div className="social-compose-actions">
      <button type="button" className="phone-app-button compact" disabled={busy} onClick={() => input.current?.click()}>{image ? 'Change image' : 'Add image'}</button>
      {image && <button type="button" className="phone-app-button compact" onClick={() => setImage('')}>Remove image</button>}
      <button type="submit" className="phone-app-button primary" disabled={busy || (!text.trim() && !image)}>{post ? 'Save post' : 'Post'}</button>
    </div>
    {error && <p className="phone-app-error" role="alert">{error}</p>}
  </form>
}

function FeedPost({ post, profile, ai, pendingReply, aiError, generate, update, remove }: {
  post: Post; profile: SocialProfile; ai: boolean; pendingReply: boolean; aiError?: string; generate: () => void
  update: (change: (post: Post) => Partial<Post>) => Promise<void>; remove: () => Promise<void>
}) {
  const [showReplies, setShowReplies] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const date = new Date(post.time)
  const recentAi = post.comments.findLast(comment => comment.ai)
  const replies = showReplies ? post.comments : recentAi ? [recentAi] : []
  async function act(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await action() }
    catch { setError('Could not update this post.') } finally { setBusy(false) }
  }

  return <article className="social-post">
    {post.repostedAt && <p className="social-meta social-reposted">Reposted by you</p>}
    <header className="social-post-heading">
      <PhoneAvatar source={profile.avatar} name={profile.name} />
      <div><strong>{profile.name}</strong> <span className="social-meta">@{profile.handle}</span>
        <time className="social-meta" dateTime={date.toISOString()}>{date.toLocaleString()}{post.editedAt ? ' · Edited' : ''}</time>
      </div>
      <details className="social-post-menu">
        <summary aria-label="Post options">•••</summary>
        <button type="button" onClick={() => { setEditing(!editing); setDeleting(false) }}>{editing ? 'Cancel edit' : 'Edit post'}</button>
        <button type="button" className="social-danger" disabled={busy} onClick={() => {
          if (deleting) void act(remove)
          else { setEditing(false); setDeleting(true) }
        }}>{deleting ? 'Confirm delete' : 'Delete post'}</button>
        {deleting && <button type="button" onClick={() => setDeleting(false)}>Cancel delete</button>}
      </details>
    </header>
    {editing ? <PostComposer profile={profile} post={post} submit={async (value, image) => {
      await update(() => ({ text: value, image, editedAt: Date.now() }))
      setEditing(false)
    }} /> : <>
      {post.text && <p className="social-text">{post.text}</p>}
      {post.image && <img className="social-media" src={imageSource(post.image)} alt="Post attachment" loading="lazy" />}
    </>}
    <div className="social-actions">
      <button type="button" aria-expanded={showReplies} onClick={() => setShowReplies(!showReplies)}>
        Reply{post.comments.length ? ' ' + post.comments.length : ''}
      </button>
      <button type="button" aria-pressed={Boolean(post.repostedAt)} disabled={busy} onClick={() =>
        void act(() => update(item => ({ repostedAt: item.repostedAt ? 0 : Date.now() })))}>Repost{post.repostedAt ? ' 1' : ''}</button>
      <button type="button" aria-pressed={post.liked} disabled={busy}
        onClick={() => void act(() => update(item => ({ liked: !item.liked })))}>Like{post.liked ? ' 1' : ''}</button>
      <button type="button" aria-pressed={Boolean(post.bookmarked)} disabled={busy}
        onClick={() => void act(() => update(item => ({ bookmarked: !item.bookmarked })))}>{post.bookmarked ? 'Saved' : 'Save'}</button>
    </div>
    {pendingReply && <small role="status">AI is replying.</small>}
    {ai && !pendingReply && !recentAi && <button type="button" className="social-ai-action" onClick={generate}>
      {aiError ? 'Retry AI comment' : 'Ask AI to comment'}
    </button>}
    {(error || aiError) && <p className="phone-app-error" role="alert">{error || aiError}</p>}
    {replies.map(comment => <div className="social-comment" key={comment.id}>
      <PhoneAvatar source={comment.ai ? comment.avatar : profile.avatar} name={comment.author} />
      <div><strong>{comment.ai ? comment.author : profile.name}{comment.ai && <small> · AI</small>}</strong>
        <p className="social-text">{comment.text}</p></div>
      {showReplies && <button type="button" className="social-danger" disabled={busy} aria-label={'Delete reply by ' + (comment.ai ? comment.author : profile.name)}
        onClick={() => void act(() => update(item => ({ comments: item.comments.filter(entry => entry.id !== comment.id) })))}>Delete</button>}
    </div>)}
    {showReplies && <form className="social-reply phone-app-stack" onSubmit={event => {
      event.preventDefault()
      const value = text.trim()
      if (!value) return
      void act(async () => {
        await update(item => ({ comments: [...item.comments, { id: crypto.randomUUID(), author: profile.name, text: value }] }))
        setText('')
      })
    }}>
      <label>Your reply<textarea rows={2} maxLength={500} value={text} onChange={event => setText(event.target.value)} /></label>
      <button type="submit" className="phone-app-button primary compact" disabled={busy || !text.trim()}>Reply</button>
    </form>}
  </article>
}
