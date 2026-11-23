import { createPortal } from 'react-dom'
import { useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PhoneFeatureHeader, ScreenContext } from '../../components/phone'
import { resolveScreen } from '../../app/routes'
import { greetingOptions } from '../characters/characters'
import { canChangeOpening, changeSession, getDirectChat, getSessions } from './sessions'
import type { SessionAction } from './sessions'

export function ChatSessions() {
  const { key, pathname } = useLocation()
  const active = useContext(ScreenContext) === 'chat-interface-screen'
  const chatId = active ? resolveScreen(pathname)?.chatId : undefined
  return chatId && getDirectChat(chatId) ? <SessionControls key={key} /> : null
}

function SessionControls() {
  const [view, setView] = useState<'history' | 'new' | 'change-opening'>()
  const [option, setOption] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const panel = useRef<HTMLElement>(null)
  const isOpen = Boolean(view)

  useEffect(() => {
    if (!isOpen || !panel.current) return
    const hidden = Array.from(panel.current.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== panel.current && !element.inert)
    hidden.forEach(element => { element.inert = true })
    panel.current.querySelector('button')?.focus()
    return () => {
      hidden.forEach(element => { element.inert = false })
      document.getElementById('qq-chat-sessions-btn')?.focus()
    }
  }, [isOpen])
  const open = (next: typeof view) => { setView(next); setOption(0); setError('') }
  const chat = view ? getDirectChat() : undefined

  async function apply(action: SessionAction, value: string) {
    if (!chat || busy) return
    setBusy(true)
    setError('')
    try { await changeSession(chat, action, value); open(undefined) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not change chats.') }
    finally { setBusy(false) }
  }

  const openings = chat && view !== 'history' ? greetingOptions(chat) : []
  return <>
    <button id="qq-chat-sessions-btn" type="button" className="phone-button action-btn" title="Chat history and new chat"
      aria-label="Chat history and new chat" onClick={() => { if (getDirectChat()) open('history') }}>
      Chats
    </button>
    {chat && view && createPortal(<section ref={panel} className="chat-session-panel phone-feature" role="dialog" aria-modal="true" aria-label="Chat sessions"
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy) open(view === 'history' ? undefined : 'history')
      }}>
      <PhoneFeatureHeader title={view === 'history' ? 'Chat history' : view === 'new' ? 'New chat' : 'Choose opening'}
        backDisabled={busy} onBack={() => open(view === 'history' ? undefined : 'history')} />
      <div className="phone-app-scroll phone-app-stack">
        {error && <p className="phone-app-error" role="alert">{error}</p>}
        {view === 'history' ? <>
          <div className="phone-app-actions">
            <button type="button" className="phone-app-button primary" disabled={busy} onClick={() => open('new')}>+ New chat</button>
            {canChangeOpening(chat) && greetingOptions(chat).length > 0 && <button type="button" className="phone-app-button"
              disabled={busy} onClick={() => open('change-opening')}>Change opening</button>}
          </div>
          {getSessions(chat).map(session => <button type="button" key={session.id} className="phone-app-button phone-app-list-row session-history-row"
            disabled={busy} aria-current={session.active ? 'true' : undefined} onClick={() => session.active ? open(undefined) : void apply('open', session.id)}>
            <span><strong>{session.active ? 'Current chat' : new Date(session.date).toLocaleString()}</strong>
              <span className="session-excerpt">{session.preview || 'Empty chat'}</span></span>
            <small>{session.count} {session.count === 1 ? 'message' : 'messages'}</small>
          </button>)}
        </> : <>
          {openings.length > 0 && <>
            <label>First message<select value={option} onChange={event => setOption(Number(event.target.value))} disabled={busy}>
              {openings.map((_, index) => <option key={index} value={index}>{index === 0 ? 'First message' : 'Alternate ' + index}</option>)}
              <option value={openings.length}>Start empty</option>
            </select></label>
            {openings[option] && <p className="phone-feature-panel session-opening">{openings[option]}</p>}
          </>}
          <button type="button" className="phone-app-button primary" disabled={busy}
            onClick={() => void apply(view, openings[option] ?? '')}>{view === 'new' ? 'Start chat' : 'Use opening'}</button>
        </>}
      </div>
    </section>, document.getElementById('chat-interface-screen')!)}
  </>
}
