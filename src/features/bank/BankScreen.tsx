import { Fragment, useContext, useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneFeatureHeader, Screen, ScreenContext } from '../../components/phone'
import { Icon, IconButton } from '../../components/icons'
import { showScreen } from '../../app/routes'
import type { LocalDatabase } from '../../storage/database'
import type { StoredRow } from '../../../shared/storage'
import { runtime } from '../../legacy/runtime/state.js'
import { balanceFor, bankAmount, bankBalanceEvent, bankCurrencies, bankOpeningBalance, setBankCurrency, marketMerchant, transferEvent } from './bank'
import type { BankCurrency, Transfer } from './bank'
import { BankBalanceEditor } from './BankBalanceEditor'
import { useBankCurrency } from './useBankCurrency'

const filters = ['All', 'Received', 'Sent', 'Orders'] as const

export function BankView({ actorId, database, back }: {
  actorId: string; database?: LocalDatabase; back: () => void
}) {
  const navigate = useNavigate()
  const currencySelectId = useId()
  const currency = useBankCurrency(database)
  const format = (cents: number) => bankAmount(cents, currency)
  const [savingCurrency, setSavingCurrency] = useState(false)
  const [bankData, setBankData] = useState<{ accounts: StoredRow[]; transfers: Transfer[] }>()
  const [readAt, setReadAt] = useState(0)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<typeof filters[number]>('All')
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState('all')
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [editingBalance, setEditingBalance] = useState(false)
  const key = 'bank-read:' + actorId
  useEffect(() => {
    if (!database) return
    let active = true
    setReadAt(Number(database.getPreference(key)) || 0)
    const refresh = () => void Promise.all([database.bankAccounts.toArray(), database.bankTransfers.toArray()])
      .then(([accounts, transfers]) => {
        if (active) setBankData({ accounts, transfers: transfers as Transfer[] })
      }).catch(() => { if (active) setFailed(true) })
    refresh()
    window.addEventListener(transferEvent, refresh)
    window.addEventListener(bankBalanceEvent, refresh)
    return () => {
      active = false
      window.removeEventListener(transferEvent, refresh)
      window.removeEventListener(bankBalanceEvent, refresh)
    }
  }, [database, key])

  const transfers = bankData?.transfers ?? []
  const openingBalance = (id: string) => bankOpeningBalance(bankData?.accounts.find(account => account.id === id))
  const history = transfers.filter(entry => entry.from === actorId || entry.to === actorId)
    .sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id))
  const unread = history.filter(entry => entry.to === actorId && entry.timestamp > readAt)
  const actorName = (id: string) => id === 'user' ? 'You' : id === marketMerchant ? 'Marketplace' : runtime.state.chats[id]?.name || 'Character'
  const available = balanceFor(actorId, transfers, openingBalance(actorId))
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime()
  const monthly = history.filter(entry => entry.timestamp >= startOfMonth)
  const received = monthly.reduce((sum, entry) => sum + (entry.to === actorId ? entry.cents : 0), 0)
  const spent = monthly.reduce((sum, entry) => sum + (entry.from === actorId ? entry.cents : 0), 0)
  const needle = query.trim().toLowerCase()
  let runningBalance = available
  const statement = history.map(entry => {
    const incoming = entry.to === actorId
    const line = { entry, incoming, balanceAfter: runningBalance, counterparty: actorName(incoming ? entry.from : entry.to) }
    runningBalance += incoming ? -entry.cents : entry.cents
    return line
  }).filter(({ entry, incoming, counterparty }) => {
    const selected = filter === 'All' || (filter === 'Received' && incoming) ||
      (filter === 'Sent' && !incoming && !entry.orderId) || (filter === 'Orders' && Boolean(entry.orderId))
    return selected && (period !== 'month' || entry.timestamp >= startOfMonth) &&
      `${counterparty} ${entry.note} ${entry.id}`.toLowerCase().includes(needle)
  })
  return <div className="bank-app phone-feature">
    <PhoneFeatureHeader title="Bank" onBack={back}
      actions={<IconButton icon="settings" label="Set opening balance" aria-haspopup="dialog" disabled={!bankData}
        onClick={() => setEditingBalance(true)} />} />
    <div className="phone-app-scroll phone-app-stack">
      <div className="bank-balance"><div className="bank-row"><span>{actorName(actorId)} · Simulated account</span>
        <IconButton icon={balanceVisible ? 'eye-off' : 'eye'} label={balanceVisible ? 'Hide available balance' : 'Show available balance'}
          onClick={() => setBalanceVisible(value => !value)} /></div>
        <small>Available balance</small><strong>{balanceVisible ? format(available) : '••••••'}</strong>
        {actorId === 'user' && <button className="bank-market-link" type="button" onClick={() =>
          void navigate('/market', { state: { from: 'bank' } })}><Icon name="bag" /> Marketplace</button>}
      </div>
      <section className="phone-app-card bank-currency-row">
        <label htmlFor={currencySelectId}><strong>Currency</strong><small>Display unit for Bank and Marketplace.</small></label>
        <select id={currencySelectId} aria-label="Bank currency" value={currency} disabled={!database || savingCurrency} onChange={async event => {
          if (!database) return
          const next = event.currentTarget.value as BankCurrency
          setSavingCurrency(true)
          try { await setBankCurrency(database, next); setFailed(false) }
          catch { setFailed(true) }
          finally { setSavingCurrency(false) }
        }}>{bankCurrencies.map(code => <option key={code}>{code}</option>)}</select>
      </section>
      <section className="phone-app-card phone-app-stack">
        <h2>This month</h2>
        <div className="bank-summary"><div><small>Money in</small><strong className="bank-credit">{format(received)}</strong></div>
          <div><small>Money out</small><strong>{format(spent)}</strong></div></div>
      </section>
      <section className="phone-app-card">
        <div className="bank-row"><h2>Notifications</h2>
          {unread.length > 0 && <button className="phone-app-button compact" type="button" onClick={async () => {
            const latest = unread[0].timestamp
            try { await database?.deviceSettings.put({ id: key, value: latest }); setReadAt(latest) }
            catch { setFailed(true) }
          }}>Mark as read</button>}
        </div>
        {unread.length > 0 ? unread.map(entry => <p key={entry.id}>
          Received {format(entry.cents)} from {actorName(entry.from)}
        </p>) : <p className="phone-app-muted">No new transfers.</p>}
      </section>
      <section className="phone-app-card phone-app-stack">
        <div className="bank-row"><h2>Transactions</h2><select className="bank-period" aria-label="Transaction period" value={period}
          onChange={event => setPeriod(event.target.value)}><option value="all">All time</option><option value="month">This month</option></select></div>
        <label className="market-search"><Icon name="search" /><input type="search" aria-label="Search transactions" placeholder="Search transactions"
          value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="market-filters" aria-label="Filter transactions">
          {filters.filter(name => name !== 'Orders' || actorId === 'user').map(name => <button key={name} type="button"
            aria-pressed={name === filter} onClick={() => setFilter(name)} className="phone-app-button compact">{name}</button>)}
        </div>
        {!statement.length && <p className="phone-app-muted">{history.length ? 'No matching transactions.' : 'No transactions yet.'}</p>}
        {statement.map(({ entry, incoming, counterparty, balanceAfter }, index) => <Fragment key={entry.id}>
          {(index === 0 || new Date(statement[index - 1].entry.timestamp).toDateString() !== new Date(entry.timestamp).toDateString()) &&
            <h3 className="bank-date">{new Date(entry.timestamp).toLocaleDateString(undefined, { dateStyle: 'long' })}</h3>}
          <details className="bank-entry">
          <summary className="bank-row"><span className="bank-transaction-label">
            <span className="bank-transaction-icon" data-credit={incoming}><Icon name={entry.orderId ? 'bag' : incoming ? 'download' : 'send'} /></span>
            <span><strong>{entry.orderId ? 'Marketplace payment' : (incoming ? 'From ' : 'To ') + counterparty}</strong>
            <small>{new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</small></span></span>
            <strong className={incoming ? 'bank-credit' : ''}>{incoming ? '+' : '−'}{format(entry.cents)}</strong></summary>
          <dl className="bank-details">
            <dt>Status</dt><dd>Completed</dd>
            <dt>Reference</dt><dd>{entry.id}</dd>
            {entry.note && <><dt>Note</dt><dd>{entry.note}</dd></>}
            <dt>Balance after</dt><dd>{format(balanceAfter)}</dd>
          </dl>
          {entry.orderId && <button className="phone-app-button compact" type="button" onClick={() => void navigate({
            pathname: '/market', search: new URLSearchParams({ order: entry.orderId! }).toString(),
          }, { state: { from: 'bank' } })}>View order</button>}
          </details></Fragment>)}
      </section>
      {failed && <p role="alert">Bank data could not be read or saved.</p>}
    </div>
    {editingBalance && database && <BankBalanceEditor database={database} actorId={actorId}
      accounts={actorId === 'user' ? [{ id: 'user', name: 'You' }, ...Object.values(runtime.state.chats)
        .flatMap(chat => chat && !chat.isGroup ? [{ id: chat.id, name: chat.name }] : [])
        .sort((a, b) => a.name.localeCompare(b.name))] : [{ id: actorId, name: actorName(actorId) }]}
      openingBalance={openingBalance} transfers={transfers} currency={currency} close={() => setEditingBalance(false)} />}
  </div>
}

export function BankScreen({ database }: { database?: LocalDatabase }) {
  const active = useContext(ScreenContext) === 'bank-screen'
  return <Screen id="bank-screen">
    {active && <BankView actorId="user" database={database} back={() => showScreen('home-screen')} />}
  </Screen>
}

export function BankNotice({ database }: { database?: LocalDatabase }) {
  const currency = useBankCurrency(database)
  const [transfer, setTransfer] = useState<Transfer>()
  useEffect(() => {
    let timer = 0
    const receive = (event: Event) => {
      const entry = (event as CustomEvent<Transfer>).detail
      if (entry.to !== 'user') return
      setTransfer(entry)
      clearTimeout(timer)
      timer = window.setTimeout(() => setTransfer(undefined), 5500)
    }
    window.addEventListener(transferEvent, receive)
    return () => { clearTimeout(timer); window.removeEventListener(transferEvent, receive) }
  }, [])
  if (!transfer) return null
  return <div className="bank-notice" role="status">
    <button type="button" onClick={() => { setTransfer(undefined); showScreen('bank-screen') }}>
      <Icon name="bank" /><span><strong>Bank</strong><small>Received {bankAmount(transfer.cents, currency)}</small></span>
    </button>
    <button type="button" aria-label="Dismiss bank notification" onClick={() => setTransfer(undefined)}><Icon name="close" /></button>
  </div>
}
