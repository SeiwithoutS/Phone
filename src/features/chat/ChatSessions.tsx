import { useContext, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ScreenContext, BackButton } from '../../components/phone'
import { IconButton } from '../../components/icons'
import { resolveScreen, showScreen } from '../../app/routes'
import { greetingOptions } from '../characters/characters'
import { canChangeOpening, changeSession, getActiveChat, getDirectChat, getSessions } from './sessions'
import { regenerateReply } from './replies'
import { enterSelectionMode } from '../../legacy/chat/messages.js'

type View = 'menu' | 'history' | 'new' | 'change-opening'
const titles: Record<View, string> = {
  menu: 'Chat actions', history: 'Manage chat files', new: 'New chat',
  'change-opening': 'Choose opening',
}

export function ChatSessions({ onOpen }: { onOpen: () => void }) {
  const { key, pathname } = useLocation()
  const active = useContext(ScreenContext) === 'chat-interface-screen'
  const id = active && resolveScreen(pathname)?.chatId
  return id ? <SessionControls key={id + ':' + key} id={id} onOpen={onOpen} /> : null
}

function SessionControls({ id, onOpen }: { id: string; onOpen: () => void }) {
  const [view, setView] = useState<View>()
  const [option, setOption] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleteFile, setDeleteFile] = useState<string>()
  const panel = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const chat = view && getActiveChat(id)
  const directChat = view && getDirectChat(id)
  const isOpen = Boolean(view && chat)

  useLayoutEffect(() => {
    const dialog = panel.current
    if (!isOpen || !dialog) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
      opener.current?.focus()
    }
  }, [isOpen])

  useLayoutEffect(() => {
    const dialog = panel.current
    const trigger = opener.current
    if (view !== 'menu' || !dialog || !trigger) return
    const placeMenu = () => {
      const rect = trigger.getBoundingClientRect()
      dialog.style.setProperty('--qq-menu-left', Math.round(rect.left) + 'px')
      dialog.style.setProperty('--qq-menu-bottom', Math.round(window.innerHeight - rect.top + 8) + 'px')
    }
    placeMenu()
    window.addEventListener('resize', placeMenu)
    return () => window.removeEventListener('resize', placeMenu)
  }, [view])

  function open(next?: View) {
    if (next && !getActiveChat(id)) return
    setView(next)
    setOption(0)
    setDeleteFile(undefined)
    setError('')
  }

  function back() {
    if (busy) return
    if (deleteFile) { setDeleteFile(undefined); return }
    open(view === 'menu' ? undefined : view === 'new' || view === 'change-opening' ? 'history' : 'menu')
  }

  async function apply(action: () => Promise<unknown>, next?: View) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await action(); open(next) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The chat could not be updated.') }
    finally { setBusy(false) }
  }

  const openings = directChat && (view === 'new' || view === 'change-opening') ? greetingOptions(directChat) : []
  const canDelete = chat && chat.history.some(message => !message.isHidden && !message.isTemporary)
  function selectToDelete(mode: 'selected' | 'range') {
    open()
    enterSelectionMode(undefined, mode)
  }

  return <>
    <button type="button" id="qq-chat-sessions-btn" ref={opener} className="phone-button qq-chat-menu-button"
      aria-label="Chat actions" aria-haspopup="dialog" onClick={() => { onOpen(); open('menu') }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
    {chat && view && <dialog ref={panel} className={'qq-chat-dialog phone-feature' + (view === 'menu' ? ' qq-chat-menu' : '')}
      aria-labelledby="qq-dialog-title" onCancel={event => { event.preventDefault(); back() }}
      onClick={event => { if (event.target === event.currentTarget && !busy) open() }}>
      <section className="qq-dialog-body">
        <div className="qq-dialog-header">
          <BackButton disabled={busy} onClick={back} aria-label={view === 'menu' ? 'Close chat actions' : 'Back'} />
          <h2 id="qq-dialog-title">{titles[view]}</h2>
        </div>
        <div className="qq-dialog-content phone-app-stack">
          {error && <p className="phone-app-error" role="alert">{error}</p>}
          {view === 'menu' && <div className="qq-menu-options">
            <button className="phone-app-button" type="button" disabled={busy} onClick={() => void apply(() => regenerateReply(chat))}>
              {busy ? 'Generating…' : 'Regenerate reply'}
            </button>
            <button className="phone-app-button" type="button" disabled={busy} onClick={() => open('new')}>New chat</button>
            <button className="phone-app-button" type="button" disabled={busy} onClick={() => open('history')}>Manage chat files</button>
            <button className="phone-app-button danger" type="button" disabled={busy || !canDelete} onClick={() => selectToDelete('selected')}>Delete selected messages</button>
            <button className="phone-app-button danger" type="button" disabled={busy || !canDelete} onClick={() => selectToDelete('range')}>Delete from a message onward</button>
            <button className="phone-app-button" type="button" disabled={busy} onClick={() => {
              open()
              document.getElementById('chat-settings-btn')?.click()
            }}>Chat settings</button>
            <button className="phone-app-button" type="button" disabled={busy} onClick={() => {
              open()
              showScreen('context-screen', { contextChatId: id })
            }}>View Context</button>
          </div>}
          {view === 'history' && <>
            <div className="phone-app-actions">
              <button type="button" className="phone-app-button primary" disabled={busy} onClick={() => open('new')}>+ New chat</button>
              {canChangeOpening(chat) && directChat && greetingOptions(directChat).length > 0 && <button type="button" className="phone-app-button"
                disabled={busy} onClick={() => open('change-opening')}>Change opening</button>}
            </div>
            {getSessions(chat).map(session => <div key={session.id} className="qq-file-row">
              <button type="button" className="phone-app-button phone-app-list-row session-history-row" disabled={busy}
                aria-current={session.active ? 'true' : undefined}
                onClick={() => session.active ? open() : void apply(() => changeSession(chat, { type: 'open', id: session.id }))}>
                <span><strong>{session.active ? 'Current chat' : new Date(session.date).toLocaleString()}</strong>
                  {session.branch && <small>Branch</small>}
                  <span className="session-excerpt">{session.preview || 'Empty chat'}</span></span>
                <small>{session.count} {session.count === 1 ? 'message' : 'messages'}</small>
              </button>
              <IconButton icon="trash" className="qq-file-delete" disabled={busy}
                label={session.active ? 'Delete current chat file' : 'Delete archived chat file'}
                onClick={() => setDeleteFile(session.id)} />
              {deleteFile === session.id && <div className="qq-delete-file phone-app-actions">
                <p>Delete this chat file and its messages permanently?</p>
                <button type="button" className="phone-app-button danger" disabled={busy} onClick={() =>
                  void apply(() => changeSession(chat, { type: 'delete', id: session.id }), 'history')}>Confirm delete file</button>
                <button type="button" className="phone-app-button" disabled={busy} onClick={() => setDeleteFile(undefined)}>Cancel</button>
              </div>}
            </div>)}
          </>}
          {(view === 'new' || view === 'change-opening') && <>
            {openings.length > 0 && <>
              <label>First message<select value={option} onChange={event => setOption(Number(event.target.value))} disabled={busy}>
                {openings.map((_, index) => <option key={index} value={index}>{index === 0 ? 'First message' : 'Alternate ' + index}</option>)}
                <option value={openings.length}>Start empty</option>
              </select></label>
              {openings[option] && <p className="phone-feature-panel session-opening">{openings[option]}</p>}
            </>}
            <button type="button" className="phone-app-button primary" disabled={busy}
              onClick={() => void apply(() => changeSession(chat, { type: view, greeting: openings[option] ?? '' }))}>
              {view === 'new' ? 'Start chat' : 'Use opening'}
            </button>
          </>}
        </div>
      </section>
    </dialog>}
  </>
}
