import { useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon, IconButton } from '../../components/icons'
import { BackButton, Screen, ScreenContext, ScreenHeader } from '../../components/phone'
import { screenPaths } from '../../app/routes'
import { runtime } from '../../legacy/runtime/state.js'
import { balanceFor, bankAmount, transferEvent } from '../bank/bank'
import { useBankCurrency } from '../bank/useBankCurrency'
import type { Transfer } from '../bank/bank'
import type { LocalDatabase } from '../../storage/database'
import { canShareOrder, deliveryStatus, deliveryTimeline, marketGiftEvent, marketProducts, orderPricing, placeOrder } from './market'
import type { MarketKind, MarketOrder, MarketProduct } from './market'
import { MarketProductEditor } from './MarketProductEditor'
import { MarketOrderDetails } from './MarketOrderDetails'
import { updateOrderGift } from './market-gifts'

type View = 'Browse' | 'Cart' | 'Orders'
const views: View[] = ['Browse', 'Cart', 'Orders']
const orderFilters = ['All', 'In progress', 'Delivered'] as const
const productIllustrations: Record<string, string> = {
  'rice-bowl': '🍱', 'milk-tea': '🧋', noodles: '🍜', cake: '🍰', notebook: '📔',
  'night-light': '☁️', mug: '☕', flowers: '💐',
}
type MarketOrigin = { chatId?: string; from?: 'bank' | 'chat'; food?: boolean }

export function MarketScreen({ database }: { database?: LocalDatabase }) {
  const active = useContext(ScreenContext) === 'market-screen'
  return <Screen id="market-screen" className="phone-feature">{active && database && <Market database={database} />}</Screen>
}

function Market({ database }: { database: LocalDatabase }) {
  const navigate = useNavigate()
  const currency = useBankCurrency(database)
  const format = (cents: number) => bankAmount(cents, currency)
  const { state } = useLocation()
  const origin = (state ?? {}) as MarketOrigin
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('order')
  const [view, setView] = useState<View>(selectedId ? 'Orders' : 'Browse')
  const [kind, setKind] = useState<MarketKind | 'all'>(origin.food ? 'food' : 'all')
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<MarketProduct[]>([])
  const [orders, setOrders] = useState<MarketOrder[]>([])
  const [balance, setBalance] = useState<number>()
  const [cart, setCart] = useState<Record<string, number>>({})
  const [chatId, setChatId] = useState(origin.chatId ?? '')
  const [recipient, setRecipient] = useState('')
  const [note, setNote] = useState('')
  const [autoGift, setAutoGift] = useState(true)
  const [orderFilter, setOrderFilter] = useState<typeof orderFilters[number]>('All')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [now, setNow] = useState(Date.now)
  const checkingOut = useRef(false)
  const requestId = useRef<string>(undefined)
  const contacts = Object.values(runtime.state.chats).filter(canShareOrder).sort((a, b) => a.name.localeCompare(b.name))
  const contact = runtime.state.chats[chatId]
  const lines = products.filter(product => cart[product.id]).map(product => ({ ...product, quantity: cart[product.id] }))
  const pricing = orderPricing(lines)
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0)
  const picked = orders.find(order => order.id === selectedId)
  const pickedContact = picked?.chatId ? runtime.state.chats[picked.chatId] : undefined
  const trackedOrders = orders.filter(order => orderFilter === 'All' ||
    (deliveryStatus(order, now) === 'Delivered') === (orderFilter === 'Delivered'))
  const byShop = new Map<string, typeof lines>()
  for (const line of lines) {
    const group = byShop.get(line.seller) ?? []
    group.push(line)
    byShop.set(line.seller, group)
  }

  useEffect(() => {
    let active = true
    const refresh = () => void Promise.all([marketProducts(database), database.marketOrders.toArray(), database.bankTransfers.toArray()])
      .then(([products, rows, transfers]) => {
        if (!active) return
        setProducts(products)
        setOrders((rows as MarketOrder[]).sort((a, b) => b.timestamp - a.timestamp))
        setBalance(balanceFor('user', transfers as Transfer[]))
        setLoaded(true)
      }).catch(() => { if (active) setError('Could not load Marketplace.') })
    const updateGift = (event: Event) => {
      const order = (event as CustomEvent<MarketOrder>).detail
      if (active) {
        setOrders(current => current.map(item => item.id === order.id ? order : item))
        setNow(Date.now())
      }
    }
    const updateClock = () => setNow(Date.now())
    refresh()
    window.addEventListener(transferEvent, refresh)
    window.addEventListener(marketGiftEvent, updateGift)
    window.addEventListener('focus', updateClock)
    const timer = window.setInterval(updateClock, 15_000)
    return () => {
      active = false
      window.removeEventListener(transferEvent, refresh)
      window.removeEventListener(marketGiftEvent, updateGift)
      window.removeEventListener('focus', updateClock)
      clearInterval(timer)
    }
  }, [database])

  function open(next: View, order?: string) {
    setView(next)
    setError('')
    setParams(order ? { order } : {}, { replace: true, state: origin })
  }

  function back() {
    if (selectedId) return open('Orders')
    if (origin.from === 'chat' && origin.chatId) {
      void navigate('/chats/' + encodeURIComponent(origin.chatId))
    } else void navigate(origin.from === 'bank' ? screenPaths['bank-screen'] : screenPaths['home-screen'])
  }

  function changeQuantity(id: string, change: number) {
    requestId.current = undefined
    setCart(old => ({ ...old, [id]: Math.max(0, Math.min(20, (old[id] ?? 0) + change)) }))
  }

  async function checkout() {
    if (checkingOut.current || !lines.length) return
    if (chatId && !canShareOrder(contact)) { setError('Choose an available conversation.'); return }
    checkingOut.current = true
    setBusy(true)
    setError('')
    try {
      const id = requestId.current ??= crypto.randomUUID()
      const order = await placeOrder(database, {
        id, cart: Object.fromEntries(Object.entries(cart).filter(([, count]) => count > 0)), expectedTotal: pricing.total,
        chat: contact, recipient: recipient || contact?.name || 'You', note, sendGiftOnDelivery: autoGift,
      })
      setOrders(old => [order, ...old.filter(item => item.id !== order.id)])
      setCart({})
      setNote('')
      requestId.current = undefined
      open('Orders', order.id)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not place the order.')
      try {
        const refreshed = await marketProducts(database)
        const available = new Set(refreshed.map(product => product.id))
        setProducts(refreshed)
        setCart(old => Object.fromEntries(Object.entries(old).filter(([productId]) => available.has(productId))))
      } catch { /* Keep the cart visible while storage is unavailable. */ }
    } finally {
      checkingOut.current = false
      setBusy(false)
    }
  }

  const needle = query.trim().toLowerCase()
  const matches = products.filter(product => (kind === 'all' || product.kind === kind) &&
    `${product.name} ${product.seller}`.toLowerCase().includes(needle))

  return <>
    <ScreenHeader className="phone-feature-header"><BackButton onClick={back} disabled={busy} />
      <span>Marketplace</span><IconButton icon="bag" label="Open cart" count={quantity} disabled={busy} onClick={() => open('Cart')} />
    </ScreenHeader>
    <nav className="chat-tabs market-tabs" aria-label="Marketplace sections">
      {views.map(name => <button key={name} type="button" aria-pressed={view === name} disabled={busy}
        onClick={() => open(name)}>{name}{name === 'Cart' && quantity > 0 ? ` (${quantity})` : ''}</button>)}
    </nav>
    <div className="phone-app-scroll phone-app-stack market-body">
      {error && <p className="phone-app-error" role="alert">{error}</p>}
      {!loaded && !error && <p role="status">Loading Marketplace…</p>}
      {view === 'Browse' && <>
        <section className="market-discovery phone-app-stack">
          <div className="bank-row"><h2>Products</h2>
            <IconButton icon="plus" label="Add product" className="market-create" onClick={() => setAdding(true)} /></div>
          <label className="market-search"><Icon name="search" /><input type="search" placeholder="Search products or shops"
            aria-label="Search products or shops" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="market-filters" aria-label="Product category">
          {([['all', 'All'], ['food', 'Food & drinks'], ['goods', 'Goods']] as const).map(([value, label]) =>
            <button type="button" className="phone-app-button compact" aria-pressed={kind === value} key={value} onClick={() => setKind(value)}>{label}</button>)}
        </div>
        </section>
        {loaded && !matches.length && <p className="phone-app-muted">No products found.</p>}
        <div className="market-grid">
          {matches.map(product => <article key={product.id} className="market-product">
            <div className="market-product-art" data-kind={product.kind}>
              {productIllustrations[product.id] ? <span aria-hidden="true">{productIllustrations[product.id]}</span> : <Icon name="image" />}
              {product.image && <img src={product.image} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true }} />}
            </div>
            <div className="market-product-body"><small className="market-seller">{product.seller}</small><strong>{product.name}</strong>
              {product.description && <details className="market-description"><summary>Details</summary><p>{product.description}</p></details>}
              <div className="bank-row"><strong>{format(product.cents)}</strong>
                <IconButton icon="plus" label={'Add ' + product.name} count={cart[product.id]} disabled={cart[product.id] >= 20}
                  onClick={() => changeQuantity(product.id, 1)} />
              </div>
            </div>
          </article>)}
        </div>
      </>}
      {view === 'Cart' && (lines.length ? <form className="phone-app-stack" onSubmit={event => { event.preventDefault(); void checkout() }}>
        {[...byShop].map(([seller, items]) => <section key={seller} className="phone-app-card phone-app-stack market-cart-shop">
          <h2><Icon name="bag" /> {seller}</h2>
          {items.map(line => <div key={line.id} className="market-cart-row">
            <div className="market-cart-item">{line.image && <img src={line.image} alt="" />}
              <div><strong>{line.name}</strong><small>{format(line.cents)} each</small></div></div>
            <div className="market-quantity">
              <button type="button" className="phone-app-button compact" disabled={busy} aria-label={'Remove one ' + line.name} onClick={() => changeQuantity(line.id, -1)}>−</button>
              <span>{line.quantity}</span>
              <IconButton icon="plus" label={'Add one ' + line.name} disabled={busy || line.quantity >= 20} onClick={() => changeQuantity(line.id, 1)} />
            </div>
          </div>)}
        </section>)}
        <section className="phone-app-card phone-app-stack">
          <h2>Delivery</h2>
          <label>Gift recipient (optional)<select value={chatId} disabled={busy} onChange={event => setChatId(event.target.value)}>
            <option value="">No gift recipient</option>
            {contacts.map(chat => <option key={chat.id} value={chat.id}>{chat.name}</option>)}
          </select></label>
          {contact && <label className="phone-app-check"><input type="checkbox" checked={autoGift} disabled={busy}
            onChange={event => setAutoGift(event.target.checked)} /> Send a gift card at delivery</label>}
          <label>Delivery name<input maxLength={80} value={recipient} onChange={event => setRecipient(event.target.value)} disabled={busy} placeholder={contact?.name || 'You'} /></label>
          <label>Delivery note<textarea rows={2} maxLength={240} value={note} onChange={event => setNote(event.target.value)} disabled={busy} /></label>
        </section>
        <section className="phone-app-card phone-app-stack">
          <h2>Payment summary</h2>
          <div className="bank-row"><span>Items</span><span>{format(pricing.subtotal)}</span></div>
          <div className="bank-row"><span>Delivery</span><span>{format(pricing.delivery)}</span></div>
          <div className="bank-row"><strong>Total</strong><strong>{format(pricing.total)}</strong></div>
          <small>Simulated Bank balance {balance === undefined ? '…' : format(balance)}</small>
          {balance !== undefined && balance < pricing.total && <p className="phone-app-error">Insufficient Bank balance.</p>}
          <button type="submit" className="phone-app-button primary" disabled={busy || balance === undefined || balance < pricing.total}>
            {busy ? 'Placing order…' : 'Place order · ' + format(pricing.total)}
          </button>
        </section>
      </form> : <p className="phone-app-muted">Your cart is empty.</p>)}
      {view === 'Orders' && (picked ? <MarketOrderDetails key={picked.id} order={picked} now={now} format={format}
        openChat={canShareOrder(pickedContact) ? () => void navigate('/chats/' + encodeURIComponent(pickedContact.id)) : undefined}
        updateGift={async (action, draft) => {
          if (!await updateOrderGift(database, picked, action, draft)) {
            throw new Error('This card was already sent or the chat is busy. Refresh the order and try again.')
          }
        }} />
      : selectedId && loaded ? <p className="phone-app-muted">This order is no longer available.</p> : <>
        <div className="market-order-heading"><h2>Order history</h2>
          <div className="market-filters" role="group" aria-label="Filter orders">
            {orderFilters.map(filter => <button key={filter} type="button" className="phone-app-button compact"
              aria-pressed={orderFilter === filter} onClick={() => setOrderFilter(filter)}>{filter}</button>)}
          </div>
        </div>
        {loaded && trackedOrders.length === 0 && <p className="market-empty">{orders.length ? 'No orders in this section.' : 'Your orders will appear here.'}</p>}
        {trackedOrders.map(order => {
          const status = deliveryStatus(order, now)
          const arrival = deliveryTimeline(order).at(-1)!
          return <button key={order.id} type="button" className="phone-app-button market-order-row" onClick={() => open('Orders', order.id)}>
            <span className="market-order-icon"><Icon name={status === 'Delivered' ? 'check' : 'bag'} /></span>
            <span className="market-order-copy"><small className="market-status" data-delivered={status === 'Delivered'}>{status}</small>
              <strong>{order.items.map(item => item.name).join(', ')}</strong>
              <small>{status === 'Delivered' ? 'Delivered' : 'ETA'} · {new Date(arrival.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>
            </span>
            <span className="market-order-price"><strong>{format(order.total)}</strong><Icon name="next" /></span>
          </button>
        })}
      </>)}
    </div>
    {adding && <MarketProductEditor database={database} initialKind={kind === 'food' ? 'food' : 'goods'} close={() => setAdding(false)} saved={category => {
      setAdding(false)
      setQuery('')
      setKind(category)
      setError('')
      void marketProducts(database).then(setProducts).catch(() => setError('The product was saved. Reopen Marketplace to refresh the catalog.'))
    }} />}
  </>
}
