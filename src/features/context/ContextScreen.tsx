import { useContext, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HeaderSaveButton, PhoneFeatureHeader, Screen, ScreenContext } from '../../components/phone'
import { showScreen } from '../../app/routes'
import { runtime } from '../../legacy/runtime/state.js'
import { buildQQReplyInput } from '../../legacy/chat/ai/context.js'
import { planContextCompletion } from '../api/completion'
import { chatContextScope, contextConfig, lastContext, recentContexts } from './context'
import { budgetSources, contextKey, normalizeContext, promptText, sourceLabels, wholeSources } from './budget'
import { ReplyRulesEditor, replyRulesForm } from './ReplyRulesEditor'
import type { ContextPlan, Source } from './budget'
import type { LocalDatabase } from '../../storage/database'

const tokens = (count: number) => count.toLocaleString() + ' tokens'
const contextTabs = [['context', 'Context'], ['reply-rules', 'Reply Rules']] as const

export function ContextScreen({ database }: { database?: LocalDatabase }) {
  const active = useContext(ScreenContext) === 'context-screen'
  const location = useLocation()
  return <Screen id="context-screen" className="phone-feature">
    {active && database && <ContextEditor key={location.key} database={database} fromChat={location.state?.contextChatId} />}
  </Screen>
}

function ContextEditor({ database, fromChat }: { database: LocalDatabase; fromChat?: string }) {
  const navigate = useNavigate()
  const chats = Object.values(runtime.state.chats).flatMap(chat => chat ? [chat] : [])
  const [tab, setTab] = useState<(typeof contextTabs)[number][0]>('context')
  const [choice, setChoice] = useState(fromChat ?? runtime.state.activeChatId ?? chats[0]?.id ?? '')
  const [config, setConfig] = useState(() => contextConfig(database))
  const [mode, setMode] = useState<'preview' | 'last'>('preview')
  const [preview, setPreview] = useState<ContextPlan>()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const chat = runtime.state.chats[choice]
  const recorded = lastContext(chat ? chatContextScope(chat) : choice)
  const last = mode === 'last' || !chat && Boolean(recorded)
  const plan = last ? recorded?.plan : preview
  const other = recentContexts().filter(([scope]) => !scope.startsWith('chat:'))

  useEffect(() => {
    let active = true
    setPreview(undefined)
    if (!chat || tab !== 'context') return
    void buildQQReplyInput(chat).then(({ input }) => planContextCompletion(chat, input, normalizeContext(config))).then(result => {
      if (active) setPreview(result)
    }).catch(() => { if (active) setError('Could not build the context preview.') })
    return () => { active = false }
  }, [chat, config, tab])

  function setSource(id: Source, change: Partial<typeof config.sources[Source]>) {
    setStatus('')
    setConfig(current => ({ ...current, sources: { ...current.sources, [id]: { ...current.sources[id], ...change } } }))
  }

  async function save() {
    setError('')
    setStatus('')
    if (config.response > config.size - 256) { setError('Leave at least 256 tokens for the prompt.'); return }
    setBusy(true)
    try {
      await database.deviceSettings.put({ id: contextKey, value: normalizeContext(config) })
      setStatus('Context settings saved.')
    } catch { setError('Could not save context settings.') }
    finally { setBusy(false) }
  }

  return <>
    <PhoneFeatureHeader title="Context" backDisabled={busy} onBack={() => fromChat ? void navigate(-1) : showScreen('home-screen')}
      actions={<HeaderSaveButton form={tab === 'context' ? 'context-settings-form' : replyRulesForm}
        label={tab === 'context' ? 'Save Context' : 'Save reply rules'} disabled={busy} />} />
    <div className="context-tabs" role="tablist" aria-label="Context settings">
      {contextTabs.map(([id, label], index) => <button type="button" key={id} role="tab"
        id={'context-tab-' + id} aria-controls={'context-panel-' + id} aria-selected={tab === id}
        className="phone-app-button" tabIndex={tab === id ? 0 : -1} disabled={busy}
        onClick={() => setTab(id)} onKeyDown={event => {
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? contextTabs.length - 1
            : event.key === 'ArrowLeft' ? (index - 1 + contextTabs.length) % contextTabs.length
            : event.key === 'ArrowRight' ? (index + 1) % contextTabs.length : undefined
          if (next === undefined) return
          event.preventDefault()
          const target = contextTabs[next][0]
          setTab(target)
          document.getElementById('context-tab-' + target)?.focus()
        }}>{label}</button>)}
    </div>
    <div id="context-panel-context" role="tabpanel" aria-labelledby="context-tab-context"
      className="phone-app-scroll phone-app-stack context-editor" hidden={tab !== 'context'}>
      <form id="context-settings-form" className="phone-app-stack" onSubmit={event => { event.preventDefault(); void save() }}>
        <div className="phone-app-two">
          <label>Context Size (tokens)<input type="number" min={1024} max={2000000} required value={config.size || ''}
            onChange={event => setConfig(current => ({ ...current, size: Number(event.target.value) }))} /></label>
          <label>Max Response Length (tokens)<input type="number" min={1} required value={config.response || ''}
            onChange={event => setConfig(current => ({ ...current, response: Number(event.target.value) }))} /></label>
        </div>
        <p className="phone-app-muted">Each percentage is a cap based on Context Size. The response and whole prompts reserve space first. History keeps the newest entries that fit.</p>
        <fieldset className="phone-feature-panel context-sources">
          <legend>Include in the prompt</legend>
          {[...wholeSources, ...budgetSources].map(id => <div key={id} className="context-source">
            <label className="phone-app-check"><input type="checkbox" checked={config.sources[id].enabled}
              onChange={event => setSource(id, { enabled: event.target.checked })} />{sourceLabels[id]}</label>
            {(wholeSources as readonly string[]).includes(id) ? <small>Full content</small> : <label className="context-percent">
              <input type="number" aria-label={sourceLabels[id] + ' percentage'} min={0} max={100} required
                value={config.sources[id].percent} disabled={!config.sources[id].enabled}
                onChange={event => setSource(id, { percent: Number(event.target.value) })} /><span>%</span>
            </label>}
          </div>)}
        </fieldset>
        <label>Prompt preset<select value={config.presetId ?? ''} disabled={!config.sources.preset.enabled}
          onChange={event => setConfig(current => ({ ...current, presetId: event.target.value || undefined }))}>
          <option value="">Use the chat’s preset in Offline Mode</option>
          {(runtime.state.presets ?? []).map(preset => <option key={preset.id} value={String(preset.id)}>{preset.name}</option>)}
        </select></label>
      </form>
      {status && <p className="phone-app-muted" role="status">{status}</p>}
      {error && <p className="phone-app-error" role="alert">{error}</p>}
      <label>Inspect context<select value={choice} disabled={Boolean(fromChat)} onChange={event => { setChoice(event.target.value); setMode('preview') }}>
        {!choice && <option value="">Choose a QQ conversation</option>}
        <optgroup label="QQ">{chats.map(chat => <option key={chat.id} value={chat.id}>{chat.name}</option>)}</optgroup>
        {other.length > 0 && <optgroup label="Other app requests">{other.map(([scope, record]) =>
          <option key={scope} value={scope}>{record.task}</option>)}</optgroup>}
      </select></label>
      {chat && <div className="phone-app-actions" role="group" aria-label="Context view">
        <button type="button" className="phone-app-button" aria-pressed={!last} onClick={() => setMode('preview')}>Next request preview</button>
        <button type="button" className="phone-app-button" aria-pressed={last} disabled={!recorded} onClick={() => setMode('last')}>Last sent</button>
      </div>}
      {last && recorded && <p className="phone-app-muted">{recorded.task} · {new Date(recorded.at).toLocaleTimeString()}</p>}
      {!last && <p className="phone-app-muted">Preview of the active session with estimated tokens. Send a message to inspect the actual request.</p>}
      {plan && <>
        <p className="phone-app-muted">Estimated input {tokens(plan.used)} of {tokens(plan.inputLimit)}</p>
        {plan.error && <p className="phone-app-error" role="alert">{plan.error}</p>}
        {plan.sections.map((section, index) => <details key={section.id + '-' + index} className="phone-feature-panel">
          <summary>{section.id === 'instructions' ? 'Instructions and persona' : section.id === 'request' ? 'Current request' : sourceLabels[section.id]}
            {' · '}{section.messages.length}/{section.total}{' · '}{tokens(section.tokens)}{section.limit !== undefined && ' / ' + tokens(section.limit)}</summary>
          {section.messages.length ? section.messages.map((message, index) => <div className="context-message" key={index}>
            <small>{message.role}</small><pre>{promptText(message)}</pre>
          </div>) : <p className="phone-app-muted">No entries included.</p>}
        </details>)}
      </>}
    </div>
    <div id="context-panel-reply-rules" role="tabpanel" aria-labelledby="context-tab-reply-rules"
      className="phone-app-scroll phone-app-stack context-editor" hidden={tab !== 'reply-rules'}>
      <ReplyRulesEditor database={database} characters={chats.filter(chat => !chat.isGroup)} fromChat={fromChat} busy={busy} setBusy={setBusy} />
    </div>
  </>
}
