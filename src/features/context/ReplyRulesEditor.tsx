import { useState } from 'react'
import { onlineReplyFormat, replyExamples } from '../chat/reply-format'
import { defaultReplyRules, replyRhythm, savedReplyRules, saveReplyRules, validReplyRange } from '../chat/reply-rules'
import type { DirectChat } from '../chat/model'
import type { ReplyRules } from '../chat/reply-rules'
import type { LocalDatabase } from '../../storage/database'

export const replyRulesForm = 'qq-reply-rules-form'

type Draft = { minimum: string; maximum: string; style: string; inherit: boolean }

function draftRules(rules: Readonly<ReplyRules>, inherit = false): Draft {
  return { minimum: String(rules.minimum), maximum: String(rules.maximum), style: rules.style, inherit }
}

export function ReplyRulesEditor({ database, characters, fromChat, busy, setBusy }: {
  database: LocalDatabase
  characters: DirectChat[]
  fromChat?: string
  busy: boolean
  setBusy: (busy: boolean) => void
}) {
  const [scope, setScope] = useState(() => characters.some(chat => chat.id === fromChat) ? fromChat! : '')
  const [drafts, setDrafts] = useState(() => new Map<string, Draft>())
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const character = characters.find(chat => chat.id === scope)
  const global = savedReplyRules(database) ?? defaultReplyRules
  const override = character && savedReplyRules(database, character.id)
  const draft = drafts.get(scope) ?? draftRules(override ?? global, Boolean(character && !override))
  const fields = draft.inherit ? draftRules(global, true) : draft
  const rules = { minimum: Number(fields.minimum), maximum: Number(fields.maximum), style: fields.style }
  const valid = validReplyRange(rules.minimum, rules.maximum)

  function edit(next: Partial<Draft>) {
    setDrafts(current => new Map(current).set(scope, { ...draft, ...next }))
    setStatus('')
    setError('')
  }

  async function save() {
    if (busy) return
    if (!valid) {
      setError('Enter whole numbers, with the maximum at least as large as the minimum.')
      return
    }
    setBusy(true)
    setStatus('')
    setError('')
    try {
      await saveReplyRules(database, draft.inherit ? undefined : rules, character?.id)
      setStatus(draft.inherit ? 'This character now uses the global default.' : 'Reply rules saved.')
    } catch {
      setError('Could not save reply rules.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <form id={replyRulesForm} className="phone-app-stack" onSubmit={event => { event.preventDefault(); void save() }}>
      <label>Applies to
        <select value={scope} onChange={event => { setScope(event.target.value); setStatus(''); setError('') }} disabled={busy}>
          <option value="">Global default</option>
          {characters.length > 0 && <optgroup label="Characters">
            {characters.map(chat => <option value={chat.id} key={chat.id}>{chat.name}</option>)}
          </optgroup>}
        </select>
      </label>
      <p className="phone-app-muted">Used for private online chat in Gen, Regen, and new Swipe versions.</p>
      <div className="phone-feature-panel phone-app-stack">
        {character && <label className="phone-app-check">
          <input type="checkbox" checked={draft.inherit} disabled={busy}
            onChange={event => edit({ inherit: event.target.checked })} />
          Use global default
        </label>}
        <fieldset className="context-reply-fields phone-app-stack" disabled={busy || draft.inherit}>
          <div className="phone-app-two">
            <label>Minimum messages<input type="number" min={1} step={1} required value={fields.minimum}
              onChange={event => edit({ minimum: event.target.value })} /></label>
            <label>Maximum messages<input type="number" min={1} step={1} required value={fields.maximum}
              onChange={event => edit({ maximum: event.target.value })} /></label>
          </div>
          <label>Rhythm and style instructions
            <textarea rows={4} value={fields.style} onChange={event => edit({ style: event.target.value })} />
          </label>
        </fieldset>
        <div className="phone-app-actions">
          <button type="button" className="phone-app-button" disabled={busy} onClick={() => {
            edit(character ? draftRules(global, true) : draftRules(defaultReplyRules))
            setStatus('Default loaded. Save to apply.')
          }}>Reset to default</button>
        </div>
      </div>
      {status && <p className="phone-app-muted" role="status">{status}</p>}
      {error && <p className="phone-app-error" role="alert">{error}</p>}
    </form>
    <div className="phone-feature-panel context-rule-preview">
      <h2>Reply instruction preview</h2>
      <pre>{valid ? replyRhythm(rules) : 'Enter a valid message range to see the preview.'}</pre>
    </div>
    <details className="phone-feature-panel context-rule-reference">
      <summary>JSON format and app actions</summary>
      <ul>{onlineReplyFormat.map(rule => <li key={rule}>{rule}</li>)}</ul>
      <dl>
        <dt>Text, quote reply, and voice message</dt>
        <dd><pre>{'[\n  ' + [replyExamples.text, replyExamples.quote, replyExamples.voice].join(',\n  ') + '\n]'}</pre></dd>
        <dt>Bank transfer</dt>
        <dd>
          {character?.settings.allowBankTransfers === false && <p className="phone-app-muted">Banking is disabled for this character.</p>}
          <pre>{replyExamples.transfer}</pre>
        </dd>
        <dt>Shopping order</dt>
        <dd>
          {character && character.settings.allowStorePurchases !== true && <p className="phone-app-muted">Shopping is disabled for this character.</p>}
          <pre>{replyExamples.shopping}</pre>
          <pre>{replyExamples.shoppingNew}</pre>
        </dd>
      </dl>
    </details>
  </>
}
