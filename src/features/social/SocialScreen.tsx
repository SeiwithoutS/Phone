import { useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, IconButton } from '../../components/icons'
import { PhoneAvatar, Screen, ScreenContext } from '../../components/phone'
import { ThemeToggle } from '../../components/ThemeToggle'
import { showScreen } from '../../app/routes'
import { imageSource } from '../../runtime/files'
import { defaultSocialProfile, postPhotos, profileKey, socialActors } from './social'
import { ensureActorProfile, generateSocialComment, getSocialActivityError, isCommentPending, isSocialPostPending,
  maxPostMinutes, publishActorPost, readSocialSettings, refreshSocial, saveSocialSettings, subscribeSocial } from './activity'
import { readSocialImage, shortDate, SocialDialog } from './SocialDialog'
import { FeedPost, PostComposer } from './SocialPost'
import type { FormEvent } from 'react'
import type { LocalDatabase } from '../../storage/database'
import type { ActorProfile, Post, SocialActor, SocialNotification, SocialPhoto, SocialProfile } from './social'

const tabs = [
  { title: 'Timeline', icon: 'feed' }, { title: 'Search', icon: 'search' },
  { title: 'New post', icon: 'plus' }, { title: 'Saved', icon: 'bookmark' }, { title: 'My profile', icon: 'profile' },
] as const
type Tab = Exclude<typeof tabs[number]['title'], 'New post'>
type Panel = 'settings' | 'compose' | 'profile' | 'notifications'
type FeedData = { posts: Post[]; actors: SocialActor[]; profiles: ActorProfile[]; notifications: SocialNotification[] }
const emptyFeed: FeedData = { posts: [], actors: [], profiles: [], notifications: [] }

export function SocialScreen({ database }: { database?: LocalDatabase }) {
  const active = useContext(ScreenContext) === 'social-screen'
  return <Screen id="social-screen" className="phone-feature social-app">
    {active && database && <SocialFeed database={database} />}
  </Screen>
}

function SocialFeed({ database }: { database: LocalDatabase }) {
  const [params, setParams] = useSearchParams()
  const [feed, setFeed] = useState(emptyFeed)
  const [loaded, setLoaded] = useState(false)
  const [profile, setProfile] = useState(() => ({
    ...defaultSocialProfile(), ...(database.getPreference(profileKey) as Partial<SocialProfile> | null),
  }))
  const [tab, setTab] = useState<Tab>('Timeline')
  const [media, setMedia] = useState(false)
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState<Panel>()
  const [preferences, setPreferences] = useState(() => readSocialSettings(database))
  const [updating, setUpdating] = useState(false)
  const [generatingProfile, setGeneratingProfile] = useState<string>()
  const [profileError, setProfileError] = useState('')
  const [activityError, setActivityError] = useState(getSocialActivityError)
  const [posting, setPosting] = useState(() => isSocialPostPending(database))
  const [trialPost, setTrialPost] = useState<Post>()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [error, setError] = useState('')
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({})
  const { actors, posts, profiles, notifications } = feed
  const selectedActor = preferences.actorId || actors[0]?.id || ''
  const actorExists = actors.some(actor => actor.id === selectedActor)
  const activeActorId = params.get('profile')
  const actor = actors.find(item => item.id === activeActorId)
  const actorProfile = profiles.find(item => item.id === activeActorId)
  const selectedId = params.get('post')
  const selectedPost = posts.find(post => post.id === selectedId)
  const viewingProfile = Boolean(activeActorId) || tab === 'My profile'
  const viewedProfile = activeActorId ? actorProfile : profile
  const unread = notifications.filter(item => !item.read)
  const visibleNotifications = unreadOnly ? unread : notifications

  useEffect(() => {
    let active = true
    let request = 0
    const refresh = () => {
      const current = ++request
      setPreferences(readSocialSettings(database))
      setActivityError(getSocialActivityError())
      setPosting(isSocialPostPending(database))
      void Promise.all([database.socialPosts.orderBy('time').reverse().toArray(), socialActors(database),
        database.socialProfiles.toArray(), database.socialNotifications.orderBy('time').reverse().toArray()])
        .then(([posts, actors, profiles, notifications]) => {
          if (active && current === request) {
            setFeed({ posts: posts as Post[], actors, profiles: profiles as ActorProfile[], notifications: notifications as SocialNotification[] })
            setLoaded(true)
          }
        }).catch(() => { if (active && current === request) { setError('Could not load Social.'); setLoaded(true) } })
    }
    const unsubscribe = subscribeSocial(refresh)
    refresh()
    return () => { active = false; unsubscribe() }
  }, [database])

  async function configure(change: Partial<typeof preferences>) {
    setUpdating(true)
    setError('')
    try { setPreferences(await saveSocialSettings(database, { actorId: selectedActor, ...change })) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save Social settings.') }
    finally { setUpdating(false) }
  }

  async function updatePost(id: string, update: (post: Post) => Partial<Post>) {
    await database.transaction('rw', database.socialPosts, async tx => {
      const post = await tx.socialPosts.get(id) as Post | undefined
      if (!post) return
      const changes = update(post)
      if (Object.keys(changes).length) await tx.socialPosts.update(id, changes)
    })
    refreshSocial()
  }

  async function generate(post: Post) {
    setCommentErrors(state => ({ ...state, [post.id]: '' }))
    try { await generateSocialComment(database, post.id) }
    catch (failure) {
      setCommentErrors(state => ({ ...state, [post.id]: failure instanceof Error ? failure.message : 'AI comment failed.' }))
    }
  }

  async function publish(text: string, photos: SocialPhoto[]) {
    const post: Post = { id: crypto.randomUUID(), author: profile.name, text, photos, time: Date.now(), liked: false, comments: [] }
    await database.socialPosts.add(post)
    refreshSocial()
    selectTab('Timeline')
    setPanel(undefined)
    void generate(post)
  }

  async function generateProfile(actor: SocialActor) {
    setGeneratingProfile(actor.id)
    setProfileError('')
    try { await ensureActorProfile(database, actor) }
    catch (failure) { setProfileError(failure instanceof Error ? failure.message : 'Could not generate the profile.') }
    finally { setGeneratingProfile(undefined) }
  }

  function openActor(id: string) {
    setMedia(false)
    setProfileError('')
    setParams({ profile: id })
  }

  function selectTab(next: Tab) {
    setTab(next)
    if (next !== 'Search') setQuery('')
    if (activeActorId || selectedId) setParams({})
  }

  function openThread(postId: string) {
    setParams(activeActorId ? { profile: activeActorId, post: postId } : { post: postId })
  }

  function closeThread() {
    setParams(activeActorId ? { profile: activeActorId } : {}, { replace: true })
  }

  async function markRead(ids: string[]) {
    try {
      await database.socialNotifications.where('id').anyOf(ids).modify({ read: true })
      refreshSocial()
    } catch {
      setError('Could not mark notifications as read.')
    }
  }

  async function postOnce() {
    setError('')
    setTrialPost(undefined)
    try { setTrialPost(await publishActorPost(database, selectedActor)) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not publish a post.') }
  }

  const needle = query.trim().toLocaleLowerCase()
  const matches = (...values: string[]) => values.some(value => value.toLocaleLowerCase().includes(needle))
  const visible = posts.filter(post => {
    if (activeActorId) return post.authorId === activeActorId
    if (tab === 'My profile') return !post.authorId
    if (tab === 'Saved') return post.bookmarked
    if (tab === 'Search' && needle) return matches(post.text, post.author, ...post.comments.map(comment => comment.text))
    return true
  })
  if (!viewingProfile && tab === 'Timeline') {
    visible.sort((left, right) => (right.repostedAt || right.time) - (left.repostedAt || left.time))
  }

  function postCard(post: Post, thread = false) {
    return <FeedPost key={post.id} post={post} profile={profile} authorProfile={profiles.find(item => item.id === post.authorId)}
      openActor={openActor} thread={thread} ai={preferences.ai} pendingReply={isCommentPending(post.id)} aiError={commentErrors[post.id]}
      generate={() => void generate(post)} update={change => updatePost(post.id, change)} openThread={() => openThread(post.id)}
      remove={async () => {
        await database.socialPosts.delete(post.id)
        if (thread) closeThread()
        refreshSocial()
      }} />
  }

  return <div className="social-shell">
    <header className="social-header">
      <IconButton icon="back" label="Back" onClick={() => activeActorId ? selectTab(tab) : showScreen('home-screen')} />
      <h1>{activeActorId ? 'Profile' : 'Social'}</h1>
      <IconButton icon="bell" label={unread.length ? 'Notifications, ' + unread.length + ' unread' : 'Notifications'}
        count={unread.length || undefined} aria-haspopup="dialog" onClick={() => { setError(''); setPanel('notifications') }} />
      <ThemeToggle />
      <IconButton icon="settings" label="Social settings" aria-haspopup="dialog" onClick={() => { setError(''); setPanel('settings') }} />
    </header>

    <div className="social-scroll" role="region" aria-label={activeActorId ? 'Actor profile' : tab} key={activeActorId || tab}>
      {!viewingProfile && tab === 'Timeline' && <button type="button" className="social-compose-trigger" onClick={() => setPanel('compose')}>
        <PhoneAvatar source={profile.avatar} name={profile.name} />
        <span>Share something.</span><Icon name="plus" />
      </button>}

      {!viewingProfile && tab === 'Search' && <>
        <label className="social-search">
          <Icon name="search" /><input type="search" aria-label="Search profiles and posts" value={query}
            onChange={event => setQuery(event.target.value)} placeholder="Search profiles and posts" />
        </label>
        <div className="social-directory">
          {actors.map(item => {
            const identity = profiles.find(saved => saved.id === item.id)
            if (needle && !matches(item.name, identity?.name || '', identity?.handle || '')) return null
            return <button key={item.id} type="button" onClick={() => openActor(item.id)}>
              <PhoneAvatar source={identity?.avatar || item.avatar} name={identity?.name || item.name} />
              <span><strong>{identity?.name || item.name}</strong>
                <small>{identity ? '@' + identity.handle : item.id.startsWith('npc:') ? 'NPC' : 'Character'}</small></span>
              <Icon name="next" />
            </button>
          })}
        </div>
      </>}
      {!viewingProfile && tab === 'Saved' && <h2 className="social-section-title">Saved posts</h2>}

      {viewingProfile && viewedProfile && <ProfileHeader profile={viewedProfile} posts={visible}
        edit={activeActorId ? undefined : () => setPanel('profile')} media={media} setMedia={setMedia} />}
      {activeActorId && !actorProfile && loaded && <section className="social-empty">
        {actor
          ? <><PhoneAvatar source={actor.avatar} name={actor.name} /><h2>{actor.name}</h2>
            <button className="social-primary" type="button" disabled={Boolean(generatingProfile)}
              onClick={() => void generateProfile(actor)}>{generatingProfile === actor.id ? 'Generating profile…' : 'Generate profile with AI'}</button>
            {profileError && <p role="alert" className="phone-app-error">{profileError}</p>}</>
          : <p>This profile is unavailable.</p>}
      </section>}

      {error && !panel && <p className="phone-app-error" role="alert">{error}</p>}
      {viewingProfile && viewedProfile && media ? (
        <div className="social-profile-grid">{visible.map(post => {
          const photos = postPhotos(post)
          if (!photos.length) return null
          return <button type="button" key={post.id}
            aria-label={post.text ? 'Open post: ' + post.text.slice(0, 60) : 'Open photo post'}
            onClick={() => openThread(post.id)}>
            <img src={photos[0].source} alt={photos[0].description} loading="lazy" />
            {photos.length > 1 && <Icon name="stack" />}
          </button>
        })}{!visible.some(post => postPhotos(post).length > 0) && <p className="social-empty">Photo posts will appear here.</p>}</div>
      ) : <>
        {loaded && !visible.length && (!viewingProfile || viewedProfile) && <div className="social-empty">
          <Icon name={tab === 'Saved' ? 'bookmark' : tab === 'Search' ? 'search' : 'feed'} />
          <p>{tab === 'Search' && needle ? 'No matching posts.' : tab === 'Saved' ? 'Bookmark a post to find it here.' : 'No posts yet.'}</p>
        </div>}
        <div className="social-timeline">{visible.map(post => postCard(post))}</div>
      </>}
    </div>

    <nav className="social-navigation" aria-label="Social views">
      {tabs.map(item => <IconButton key={item.title} icon={item.icon} label={item.title}
        className={item.title === 'New post' ? 'social-create' : undefined}
        aria-current={!activeActorId && tab === item.title ? 'page' : undefined}
        onClick={() => item.title === 'New post' ? setPanel('compose') : selectTab(item.title)} />)}
    </nav>

    {panel === 'settings' && <SocialDialog title="Social settings" close={() => setPanel(undefined)}>
      <div className="social-settings phone-app-stack">
        <label className="social-setting-row">
          <span><strong>Auto AI comment</strong><small>Generate one comment when you publish a post.</small></span>
          <input type="checkbox" role="switch" aria-label="Auto AI comment" checked={preferences.ai} disabled={updating}
            onChange={event => void configure({ ai: event.target.checked })} />
        </label>
        <label className="social-setting-row">
          <span><strong>Auto AI posts</strong><small>Publish every {preferences.postEveryMinutes} minutes while EPhone is open.</small></span>
          <input type="checkbox" role="switch" aria-label="Auto AI posts" checked={preferences.autoPost} disabled={updating || (!actorExists && !preferences.autoPost)}
            onChange={event => void configure({ autoPost: event.target.checked })} />
        </label>
        <form className="social-post-interval" key={preferences.postEveryMinutes} onSubmit={event => {
          event.preventDefault()
          void configure({ postEveryMinutes: Number(new FormData(event.currentTarget).get('post-every-minutes')) })
        }}>
          <label>Minutes between auto posts<input type="number" name="post-every-minutes" min={1} max={maxPostMinutes}
            step={1} required defaultValue={preferences.postEveryMinutes} disabled={updating} /></label>
          <button type="submit" className="phone-app-button compact" disabled={updating}>Save interval</button>
        </form>
        <label htmlFor="social-actor">AI actor</label>
        <select id="social-actor" value={selectedActor} disabled={updating || !actors.length}
          onChange={event => void configure({ actorId: event.target.value })}>
          {!actorExists && <option value={selectedActor}>{selectedActor ? 'Choose another identity' : 'No characters or NPCs yet'}</option>}
          {(['character:', 'npc:'] as const).map(prefix => {
            const options = actors.filter(actor => actor.id.startsWith(prefix))
            return options.length > 0 && <optgroup key={prefix} label={prefix === 'character:' ? 'Characters' : 'NPCs'}>
              {options.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
            </optgroup>
          })}
        </select>
        <div className="phone-app-actions">
          <button type="button" className="phone-app-button" disabled={!actorExists || updating || posting}
            onClick={() => void postOnce()}>{posting ? 'Generating post…' : 'Try one post'}</button>
          {trialPost && <button type="button" className="phone-app-button" onClick={() => {
            setPanel(undefined)
            openThread(trialPost.id)
          }}>View published post</button>}
        </div>
        {actorExists && <button className="social-author-link" type="button" onClick={() => { setPanel(undefined); openActor(selectedActor) }}>
          View selected profile
        </button>}
        <div className="social-settings-links">
          <button type="button" onClick={() => showScreen('character-edit-screen')}><Icon name="profile" /> Characters</button>
          <button type="button" onClick={() => showScreen('chat-list-screen', { chatListView: 'npc-list-view' })}><Icon name="settings" /> Manage NPCs</button>
        </div>
        {(error || activityError) && <p className="phone-app-error" role="alert">{error || activityError}</p>}
      </div>
    </SocialDialog>}
    {panel === 'notifications' && <SocialDialog title="Notifications" close={() => setPanel(undefined)}>
      <div className="phone-app-actions social-notification-filters" aria-label="Filter notifications" role="group">
        <button type="button" className="phone-app-button compact" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All</button>
        <button type="button" className="phone-app-button compact" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Unread ({unread.length})</button>
        {unread.length > 0 && <button type="button" className="phone-app-button compact"
          onClick={() => void markRead(unread.map(item => item.id))}>Mark all as read</button>}
      </div>
      {visibleNotifications.length === 0 && <p className="social-empty">{unreadOnly ? 'No unread notifications.' : 'No activity yet.'}</p>}
      {error && <p className="phone-app-error" role="alert">{error}</p>}
      <div className="social-directory">
        {visibleNotifications.map(item => <button key={item.id} type="button" data-unread={!item.read} onClick={() => {
          if (!item.read) void markRead([item.id])
          setPanel(undefined)
          openThread(item.postId)
        }}>
          <PhoneAvatar source={item.avatar} name={item.actorName} />
          <span><strong>{item.actorName} {item.type === 'comment' ? 'commented on your post' : 'published a post'}</strong>
            <small>{item.preview}</small><small>{!item.read && 'Unread · '}{shortDate(item.time)}</small></span>
          <Icon name={item.type === 'comment' ? 'reply' : 'feed'} />
        </button>)}
      </div>
    </SocialDialog>}
    {panel === 'compose' && <SocialDialog title="New post" close={() => setPanel(undefined)}>
      <PostComposer profile={profile} submit={publish} />
    </SocialDialog>}
    {panel === 'profile' && <SocialDialog title="Edit profile" close={() => setPanel(undefined)}>
      <ProfileEditor profile={profile} save={async value => {
        await database.deviceSettings.put({ id: profileKey, value })
        setProfile(value)
        setPanel(undefined)
      }} />
    </SocialDialog>}
    {selectedId && loaded && <SocialDialog key={selectedId} title="Post and replies" close={closeThread}>
      {selectedPost ? postCard(selectedPost, true) : <p className="social-empty">This post is no longer available.</p>}
    </SocialDialog>}
  </div>
}
function ProfileHeader({ profile, posts, edit, media, setMedia }: {
  profile: SocialProfile; posts: Post[]; edit?: () => void; media: boolean; setMedia: (next: boolean) => void
}) {
  return <section className="social-profile">
    <div className="social-banner">{imageSource(profile.banner) && <img src={profile.banner} alt="" onError={event => { event.currentTarget.hidden = true }} />}</div>
    <div className="social-profile-info">
      <div className="social-profile-top">
        <PhoneAvatar source={profile.avatar} name={profile.name} />
        {edit && <IconButton icon="edit" label="Edit profile" onClick={edit} />}
      </div>
      <h2>{profile.name}</h2>
      <p className="social-meta">@{profile.handle}</p>
      {profile.bio && <p className="social-text">{profile.bio}</p>}
      <p className="social-meta"><strong>{posts.length}</strong> {posts.length === 1 ? 'post' : 'posts'}</p>
    </div>
    <div className="social-profile-tabs" aria-label="Profile views">
      <IconButton icon="feed" label="Profile posts" aria-pressed={!media} onClick={() => setMedia(false)} />
      <IconButton icon="image" label="Profile photos" aria-pressed={media} onClick={() => setMedia(true)} />
    </div>
  </section>
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
          try { update(key, await readSocialImage(file)) }
          catch (failure) { setError((failure as Error).message) }
          finally { setBusy(false) }
        }} />
      </label>
      {value[key] && <button type="button" className="phone-app-button compact" onClick={() => update(key, '')}>Remove {key}</button>}
    </div>)}
    {error && <p role="alert" className="phone-app-error">{error}</p>}
    <button type="submit" className="social-primary" disabled={busy}>Save profile</button>
  </form>
}
