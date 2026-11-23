import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { generatePath, useLocation, useNavigate } from 'react-router-dom'
import { PhoneContent, PhoneOverlays } from './PhoneContent'
import { ScreenContext } from '../components/phone'
import { enterScreen } from '../legacy/app/screen-effects.js'
import { bindScreenNavigation, resolveScreen, screenPaths } from './routes'
import { openChat } from '../legacy/chat/conversation.js'
import { bindImageDownloads } from '../legacy/novelai/download.js'
import { startRuntime } from '../legacy/runtime/start.js'
import { runtime } from '../legacy/runtime/state.js'

import type { LocalDatabase } from '../storage/database'

type StartupStatus = 'loading' | 'ready' | 'error'

export function App() {
  const [status, setStatus] = useState<StartupStatus>('loading')
  const [database, setDatabase] = useState<LocalDatabase>()
  const [startupError, setStartupError] = useState('')
  const [storageError, setStorageError] = useState('')
  const navigate = useNavigate()
  const { pathname, state: locationState } = useLocation()
  const route = resolveScreen(pathname)
  const initialized = useRef(false)
  const chatPrepared = useRef<string | undefined>(undefined)

  useLayoutEffect(() => bindScreenNavigation((screen, screenState) => {
    const path = screen === 'chat-interface-screen'
      ? runtime.state.activeChatId
        ? generatePath(screenPaths[screen], { chatId: encodeURIComponent(runtime.state.activeChatId) })
        : screenPaths['chat-list-screen']
      : screen === 'character-edit-screen' ? generatePath(screenPaths[screen]) : screenPaths[screen]
    if (screen === 'chat-interface-screen' && runtime.state.activeChatId) {
      chatPrepared.current = runtime.state.activeChatId
    }
    if (path !== pathname) void navigate(path, { state: { ...screenState, prepared: true } })
  }), [navigate, pathname])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void startRuntime()
      .then((opened: LocalDatabase) => {
        setDatabase(opened)
        bindImageDownloads()
        setStatus('ready')
      })
      .catch((error: unknown) => {
        console.error('EPhone startup failed', error)
        if (error instanceof Error) setStartupError(error.message)
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    const notice = (event: Event) => setStorageError((event as CustomEvent<string>).detail)
    window.addEventListener('eephone:storage-error', notice)
    return () => window.removeEventListener('eephone:storage-error', notice)
  }, [])

  useLayoutEffect(() => {
    if (status !== 'ready') return
    if (!route || (route.requiresContext && !locationState?.prepared) ||
        (route.id === 'world-book-editor-screen' && locationState?.bookId == null)) {
      void navigate(route?.fallback ?? '/', { replace: true })
      return
    }
    if (route.chatId) {
      if (!runtime.state.chats[route.chatId]) {
        void navigate(screenPaths['chat-list-screen'], { replace: true })
        return
      }
      if (chatPrepared.current !== route.chatId) {
        chatPrepared.current = route.chatId
        void openChat(route.chatId).catch(error => console.error('Could not open chat', error))
      }
    } else {
      chatPrepared.current = undefined
    }
    enterScreen(route.id)
  }, [locationState, navigate, pathname, route?.chatId, route?.id, status])

  const active = route?.id ?? 'home-screen'

  return (
    <ScreenContext.Provider value={active}>
      <div className="app-shell">
        <main id="phone-screen" aria-label="EPhone" aria-busy={status === 'loading'} inert={status !== 'ready'}>
          <PhoneContent database={database} />
        </main>
      </div>
      <PhoneOverlays />
      {storageError && (
        <div className="storage-error" role="alert">
          <p>{storageError}</p>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}
      {status !== 'ready' && (
        <div className="startup-overlay fixed inset-0 grid place-items-center p-4">
          <div className="startup-card rounded-2xl p-5 text-center">
            {status === 'loading'
              ? <p role="status">Starting EPhone…</p>
              : <><p role="alert">{startupError || 'EPhone could not start. Check the terminal and retry.'}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></>}
          </div>
        </div>
      )}
    </ScreenContext.Provider>
  )
}
