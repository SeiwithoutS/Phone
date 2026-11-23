import { useRef, useState } from 'react'
import { Icon, IconButton } from '../../components/icons'
import { PhoneAvatar } from '../../components/phone'
import { postPhotos } from './social'
import { readSocialImage, shortDate, SocialDialog } from './SocialDialog'
import type { Post, SocialPhoto, SocialProfile } from './social'

const maxImages = 4
const maxText = 1000

function Photos({ images }: { images: SocialPhoto[] }) {
  const [index, setIndex] = useState(0)
  const [viewer, openViewer] = useState(false)
  const touchStart = useRef<number | null>(null)
  const didSwipe = useRef(false)
  if (!images.length) return null
  const current = Math.min(index, images.length - 1)
  const slide = (offset: number) => setIndex(Math.max(0, Math.min(images.length - 1, current + offset)))
  const caption = 'Photo ' + (current + 1) + ' of ' + images.length
  const overlay = <div className="social-slide-buttons">
    <IconButton icon="back" label="Previous photo" disabled={current === 0} onClick={() => slide(-1)} />
    <span aria-live="polite">{current + 1} / {images.length}</span>
    <IconButton icon="next" label="Next photo" disabled={current === images.length - 1} onClick={() => slide(1)} />
  </div>
  return <div className="social-photo-set">
    <button className="social-photo-button" type="button" aria-label={'View ' + caption.toLowerCase()} onClick={event => {
      if (!didSwipe.current || event.detail === 0) openViewer(true)
      didSwipe.current = false
    }}
      onPointerDown={event => {
        didSwipe.current = false
        if (event.pointerType === 'touch') touchStart.current = event.clientX
      }}
      onPointerCancel={() => { touchStart.current = null }}
      onPointerUp={event => {
        if (touchStart.current === null) return
        const shift = event.clientX - touchStart.current
        touchStart.current = null
        if (Math.abs(shift) > 40) { didSwipe.current = true; slide(shift < 0 ? 1 : -1) }
      }}>
      <img className="social-media" src={images[current].source} alt={images[current].description || caption} loading="lazy" />
    </button>
    {images.length > 1 && overlay}
    {viewer && <SocialDialog title={caption} close={() => openViewer(false)} className="social-photo-viewer">
      <img src={images[current].source} alt={images[current].description || caption} />
      {images[current].description && <p className="social-photo-description">{images[current].description}</p>}
      {images.length > 1 && overlay}
    </SocialDialog>}
  </div>
}

export function PostComposer({ profile, submit, post, cancel }: {
  profile: SocialProfile; post?: Post; cancel?: () => void; submit: (text: string, photos: SocialPhoto[]) => Promise<void>
}) {
  const [text, setText] = useState(post?.text ?? '')
  const [images, setImages] = useState(post ? postPhotos(post) : [])
  const [describing, setDescribing] = useState<{ photos: SocialPhoto[]; index?: number }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  return <><form className="social-compose" onSubmit={async event => {
    event.preventDefault()
    if (busy || (!text.trim() && !images.length)) return
    setBusy(true)
    setError('')
    try { await submit(text.trim(), images) }
    catch { setError('Could not save your post.') }
    finally { setBusy(false) }
  }}>
    <div className="social-compose-body">
      {!post && <PhoneAvatar source={profile.avatar} name={profile.name} />}
      <textarea aria-label={post ? 'Edit post text' : 'New post'} rows={4} maxLength={maxText}
        placeholder="Share something…" value={text} onChange={event => setText(event.target.value)} />
    </div>
    {images.length > 0 && <div className="social-composer-photos">
      {images.map((image, index) => <div key={index}><img src={image.source} alt={image.description || 'Attachment ' + (index + 1)} />
        <IconButton icon="edit" className="social-photo-edit" label={'Edit description for photo ' + (index + 1)} disabled={busy}
          onClick={() => setDescribing({ photos: [image], index })} />
        <IconButton icon="close" label={'Remove photo ' + (index + 1)} disabled={busy}
          onClick={() => setImages(current => current.filter((_, position) => position !== index))} />
      </div>)}
    </div>}
    <input ref={input} type="file" accept="image/*" multiple hidden onChange={async event => {
      const files = Array.from(event.currentTarget.files ?? [])
      event.currentTarget.value = ''
      if (!files.length) return
      setBusy(true)
      setError('')
      try {
        const selected = await Promise.all(files.slice(0, maxImages - images.length).map(readSocialImage))
        setDescribing({ photos: selected.map(source => ({ source, description: '' })) })
        if (files.length + images.length > maxImages) setError('A post can hold up to four photos.')
      } catch (failure) { setError((failure as Error).message) }
      finally { setBusy(false) }
    }} />
    <div className="social-compose-actions">
      <IconButton icon="image" label="Add photos" disabled={busy || images.length >= maxImages} onClick={() => input.current?.click()} />
      <small>{text.length}/{maxText}</small>
      {cancel && <IconButton icon="close" label="Cancel edit" disabled={busy} onClick={cancel} />}
      <button type="submit" className="social-primary" disabled={busy || (!text.trim() && !images.length)}>{post ? 'Save' : 'Post'}</button>
    </div>
    {error && <p className="phone-app-error" role="alert">{error}</p>}
  </form>
    {describing && <PhotoDescriptions photos={describing.photos} close={() => setDescribing(undefined)} save={photos => {
      const index = describing.index
      setImages(current => index === undefined ? [...current, ...photos] : current.map((photo, i) => i === index ? photos[0] : photo))
      setDescribing(undefined)
    }} />}
  </>
}

function PhotoDescriptions({ photos, close, save }: { photos: SocialPhoto[]; close: () => void; save: (photos: SocialPhoto[]) => void }) {
  const [draft, setDraft] = useState(photos)
  return <SocialDialog title={photos.length === 1 ? 'Describe photo' : 'Describe photos'} close={close}>
    <form className="social-descriptions" onSubmit={event => {
      event.preventDefault()
      if (draft.every(photo => photo.description.trim())) save(draft.map(photo => ({ ...photo, description: photo.description.trim() })))
    }}>
      <p className="social-meta">Describe what the AI should know about each photo.</p>
      {draft.map((photo, index) => <label key={index}>
        <img src={photo.source} alt="" />
        <span>Photo {index + 1} description</span>
        <textarea rows={3} required maxLength={500} value={photo.description}
          onChange={event => setDraft(current => current.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} />
      </label>)}
      <button className="social-primary" type="submit" disabled={draft.some(photo => !photo.description.trim())}>Save descriptions</button>
    </form>
  </SocialDialog>
}

export function FeedPost({ post, profile, authorProfile, openActor, ai, pendingReply, aiError, generate, update, remove, openThread, thread }: {
  post: Post; profile: SocialProfile; ai: boolean; pendingReply: boolean; aiError?: string; generate: () => void
  authorProfile?: SocialProfile; openActor: (id: string) => void
  update: (change: (post: Post) => Partial<Post>) => Promise<void>; remove: () => Promise<void>
  openThread: () => void; thread?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const menu = useRef<HTMLDetailsElement>(null)
  const article = useRef<HTMLElement>(null)
  const date = new Date(post.time)
  const recentAi = post.comments.findLast(comment => comment.ai)
  const visibleComments = thread ? post.comments : recentAi ? [recentAi] : []
  const author = post.authorId ? authorProfile : profile
  const authorName = author?.name || post.author
  async function act(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await action() }
    catch { setError('Could not update this post.') } finally { setBusy(false) }
  }

  function closeEditor() {
    setEditing(false)
    requestAnimationFrame(() => menu.current?.querySelector('summary')?.focus())
  }

  return <article className="social-post" ref={article}>
    {post.repostedAt && <p className="social-meta social-reposted"><Icon name="repost" /> Reposted by you</p>}
    <header className="social-post-heading">
      <PhoneAvatar source={author?.avatar} name={authorName} />
      <div className="social-author">
        {post.authorId ? <button className="social-author-link" type="button" onClick={() => openActor(post.authorId!)}>{authorName}</button>
          : <strong>{authorName}</strong>}
        <span className="social-meta">{author?.handle && '@' + author.handle + ' · '}
          <time dateTime={date.toISOString()} title={date.toLocaleString()}>{shortDate(post.time)}</time>
          {post.editedAt ? ' · Edited' : ''}</span>
      </div>
      {!post.authorId && !editing && <details className="social-post-menu" ref={menu} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false
      }}>
        <summary className="ui-icon-button" aria-label="Post options" title="Post options"><Icon name="more" /></summary>
        <div className="social-actions-popover">
          <button type="button" onClick={() => {
            setEditing(true)
            requestAnimationFrame(() => article.current?.querySelector<HTMLTextAreaElement>('.social-inline-edit textarea')?.focus())
          }}><Icon name="edit" /> Edit post</button>
          <button type="button" className="social-danger" onClick={() => { if (menu.current) menu.current.open = false; setDeleting(true) }}>
            <Icon name="trash" /> Delete post
          </button>
        </div>
      </details>}
    </header>
    {editing ? <div className="social-inline-edit">
      <PostComposer profile={profile} post={post} cancel={closeEditor} submit={async (value, photos) => {
        await update(() => ({ text: value, image: undefined, images: undefined, photos, editedAt: Date.now() }))
        closeEditor()
      }} />
    </div> : <>
      {post.text && <p className="social-text">{post.text}</p>}
      <Photos images={postPhotos(post)} />
    </>}
    <div className="social-actions" aria-label="Post actions">
      <IconButton icon="reply" label={'Replies (' + post.comments.length + ')'} count={post.comments.length} aria-expanded={thread || undefined}
        onClick={thread ? () => document.getElementById('social-reply-input')?.focus() : openThread} />
      <IconButton icon="repost" label={post.repostedAt ? 'Undo repost' : 'Repost'} count={post.repostedAt ? 1 : 0}
        className="social-repost" aria-pressed={Boolean(post.repostedAt)} disabled={busy}
        onClick={() => void act(() => update(item => ({ repostedAt: item.repostedAt ? 0 : Date.now() })))} />
      <IconButton icon="heart" label={post.liked ? 'Unlike' : 'Like'} count={post.liked ? 1 : 0}
        className="social-like" aria-pressed={post.liked} disabled={busy}
        onClick={() => void act(() => update(item => ({ liked: !item.liked })))} />
      <IconButton icon="bookmark" label={post.bookmarked ? 'Remove bookmark' : 'Bookmark'}
        className="social-bookmark" aria-pressed={Boolean(post.bookmarked)} disabled={busy}
        onClick={() => void act(() => update(item => ({ bookmarked: !item.bookmarked })))} />
    </div>
    {pendingReply && <small className="social-meta" role="status">AI is replying…</small>}
    {ai && !post.authorId && !pendingReply && !recentAi && <div className="social-ai-action">
      <IconButton icon="spark" label={aiError ? 'Retry AI comment' : 'Ask AI to comment'} onClick={generate} />
    </div>}
    {(error || aiError) && <p className="phone-app-error" role="alert">{error || aiError}</p>}
    {visibleComments.map(comment => <div className="social-comment" key={comment.id}>
      <PhoneAvatar source={comment.ai ? comment.avatar : profile.avatar} name={comment.author} />
      <div>{comment.actorId ? <button className="social-author-link" type="button" onClick={() => openActor(comment.actorId!)}>{comment.author}</button>
        : <strong>{comment.ai ? comment.author : profile.name}</strong>}
        {comment.ai && <span className="social-ai-tag">AI</span>} {comment.time && <span className="social-meta">{shortDate(comment.time)}</span>}
        <p className="social-text">{comment.text}</p></div>
      {thread && <IconButton icon="trash" className="social-danger" disabled={busy}
        label={'Delete reply by ' + (comment.ai ? comment.author : profile.name)}
        onClick={() => void act(() => update(item => ({ comments: item.comments.filter(entry => entry.id !== comment.id) })))} />}
    </div>)}
    {thread && <form className="social-reply" onSubmit={event => {
      event.preventDefault()
      const value = text.trim()
      if (!value) return
      void act(async () => {
        await update(item => ({ comments: [...item.comments, { id: crypto.randomUUID(), author: profile.name, text: value, time: Date.now() }] }))
        setText('')
      })
    }}>
      <textarea id="social-reply-input" aria-label="Your reply" placeholder="Write a reply…" rows={2} maxLength={500} value={text}
        onChange={event => setText(event.target.value)} />
      <IconButton icon="send" label="Send reply" type="submit" disabled={busy || !text.trim()} />
    </form>}
    {deleting && <SocialDialog title="Delete post?" close={() => { if (!busy) setDeleting(false) }}>
      <div className="social-confirm">
        <p>This removes the post and its replies.</p>
        <button type="button" className="social-primary social-destructive" disabled={busy} onClick={() => void act(remove)}>Delete post</button>
        {error && <p role="alert">{error}</p>}
      </div>
    </SocialDialog>}
  </article>
}
