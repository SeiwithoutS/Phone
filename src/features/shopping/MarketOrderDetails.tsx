import { useState } from 'react'
import { Icon } from '../../components/icons'
import { deliveryTimeline, giftStyles } from './market'
import type { GiftDraft, MarketOrder } from './market'

const dateTime = (at: number) => new Date(at).toLocaleString([], {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
})

export function MarketOrderDetails({ order, now, format, openChat, updateGift }: {
  order: MarketOrder; now: number; format: (cents: number) => string
  openChat?: () => void; updateGift: (action: 'save' | 'send', draft: GiftDraft) => Promise<void>
}) {
  const timeline = deliveryTimeline(order)
  const current = Math.max(0, timeline.findLastIndex(step => step.at <= now))
  const arrival = timeline.at(-1)!
  const [draft, setDraft] = useState<GiftDraft>(() => order.gift ?? { text: '', style: 'Blue', auto: false })
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  async function submit(action: 'save' | 'send') {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await updateGift(action, draft)
      setEditing(false)
      setStatus(action === 'save' ? 'Card saved.' : 'Gift card sent.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update the gift card.')
    } finally { setBusy(false) }
  }

  return <>
    <section className="market-tracking phone-app-card phone-app-stack">
      <div className="bank-row"><h2>{timeline[current].label}</h2><span className="market-order-code">#{order.id.slice(0, 8)}</span></div>
      <p className="market-arrival"><Icon name={current === timeline.length - 1 ? 'check' : 'bag'} />
        <span>{current === timeline.length - 1 ? 'Delivered' : 'Estimated arrival'} · <strong>{dateTime(arrival.at)}</strong></span></p>
      <ol className="market-timeline" aria-label="Delivery progress">{timeline.map((step, index) =>
        <li key={step.label} data-complete={index <= current} aria-current={index === current ? 'step' : undefined}>
          <span className="market-timeline-dot" aria-hidden="true">{index < current && <Icon name="check" />}</span>
          <span>{step.label}</span><time dateTime={new Date(step.at).toISOString()}>{dateTime(step.at)}</time>
        </li>)}</ol>
    </section>
    <section className="phone-app-card phone-app-stack market-order-items">
      <h2>Order details</h2>
      <p className="phone-app-muted">Deliver to {order.recipient}</p>
      {order.note && <p className="phone-app-muted">Delivery note · {order.note}</p>}
      {order.items.map((item, index) => <div key={index} className="market-cart-row">
        <div className="market-cart-item">
          {item.image && <img src={item.image} alt="" onError={event => { event.currentTarget.hidden = true }} />}
          <div><strong>{item.name}</strong><small>{item.seller ? item.seller + ' · ' : ''}Qty {item.quantity}</small></div>
        </div>
        <strong>{format(item.quantity * item.cents)}</strong>
      </div>)}
      <div className="bank-row"><span>Delivery</span><span>{format(order.delivery)}</span></div>
      <div className="bank-row"><strong>Paid from Bank</strong><strong>{format(order.total)}</strong></div>
    </section>
    {order.chatId && <section className="phone-app-card phone-app-stack market-gift-section">
      <div className="bank-row"><h2><Icon name="gift" /> Gift card</h2>
        {openChat && <button type="button" className="phone-app-button compact" onClick={openChat}>Open {order.chatName || 'chat'}</button>}
      </div>
      <p className="phone-app-muted">{!openChat ? 'The linked conversation is unavailable.'
        : order.gift?.sentAt ? 'Sent in chat · ' + dateTime(order.gift.sentAt)
          : order.gift?.auto ? 'Scheduled to send at delivery.' : 'Send a card now or come back after delivery.'}</p>
      {openChat && (editing || order.gift?.text || order.gift?.sentAt) &&
        <div className="market-gift-preview" data-gift-style={editing ? draft.style : order.gift?.style}>
          <Icon name="gift" /><strong>For {order.recipient}</strong>
          <span>{order.items.map(item => item.quantity + ' × ' + item.name).join(' · ')}</span>
          {(editing ? draft.text : order.gift?.text) && <em>{editing ? draft.text : order.gift?.text}</em>}
        </div>}
      {openChat && !order.gift?.sentAt && (editing ? <>
        <label>Message<textarea rows={3} maxLength={240} value={draft.text} disabled={busy}
          onChange={event => setDraft({ ...draft, text: event.target.value })} placeholder="Write a note to go with the gift" /></label>
        <label>Card style<select value={draft.style} disabled={busy}
          onChange={event => setDraft({ ...draft, style: event.target.value as GiftDraft['style'] })}>
          {giftStyles.map(style => <option key={style}>{style}</option>)}
        </select></label>
        <label className="phone-app-check"><input type="checkbox" checked={draft.auto} disabled={busy}
          onChange={event => setDraft({ ...draft, auto: event.target.checked })} /> Send automatically at delivery</label>
        <div className="phone-app-actions">
          <button type="button" className="phone-app-button" disabled={busy} onClick={() => void submit('save')}>Save card</button>
          <button type="button" className="phone-app-button primary" disabled={busy} onClick={() => void submit('send')}><Icon name="send" /> Send now</button>
        </div>
      </> : <button type="button" className="phone-app-button" onClick={() => { setStatus(''); setEditing(true) }}>
        <Icon name="edit" /> {order.gift?.text ? 'Edit card' : 'Create gift card'}
      </button>)}
      {status && <p role="status" className="phone-app-muted">{status}</p>}
      {error && <p role="alert" className="phone-app-error">{error}</p>}
    </section>}
  </>
}
