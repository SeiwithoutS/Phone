import { useEffect, useId, useRef, useState } from 'react'
import { Icon, IconButton } from '../../components/icons'
import type { LocalDatabase } from '../../storage/database'
import { balanceFor, bankAmount, setBankOpeningBalance, transferCents } from './bank'
import type { BankCurrency, Transfer } from './bank'

function balanceInput(cents: number) {
  const remainder = cents % 100
  return String(Math.floor(cents / 100)) + (remainder ? '.' + String(remainder).padStart(2, '0') : '')
}

export function BankBalanceEditor({ database, actorId, accounts, openingBalance, transfers, currency, close }: {
  database: LocalDatabase
  actorId: string
  accounts: { id: string; name: string }[]
  openingBalance: (actor: string) => number
  transfers: Transfer[]
  currency: BankCurrency
  close: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const helpId = useId()
  const [account, setAccount] = useState(actorId)
  const [amount, setAmount] = useState(() => balanceInput(openingBalance(actorId)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const cents = transferCents(amount)
  const valid = Number.isSafeInteger(cents) && cents >= 0

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return <dialog ref={dialog} className="phone-feature bank-balance-editor" aria-labelledby={titleId} onCancel={event => {
    event.preventDefault()
    if (!saving) close()
  }}>
    <header className="bank-row">
      <h2 id={titleId}>Set opening balance</h2>
      <IconButton icon="close" label="Close" onClick={close} disabled={saving} />
    </header>
    <form className="phone-app-stack" onSubmit={async event => {
      event.preventDefault()
      if (saving) return
      if (!valid) { setError('Enter a non-negative amount with at most two decimal places.'); return }
      setSaving(true)
      setError('')
      try {
        await setBankOpeningBalance(database, account, cents)
        close()
      } catch {
        setError('Could not save the opening balance. Please try again.')
        setSaving(false)
      }
    }}>
      {accounts.length > 1 ? <label>Account<select value={account} disabled={saving} onChange={event => {
        const next = event.target.value
        setAccount(next)
        setAmount(balanceInput(openingBalance(next)))
        setError('')
      }}>{accounts.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
        : <strong>{accounts[0]?.name}</strong>}
      <label>Opening balance ({currency})
        <input type="text" inputMode="decimal" value={amount} disabled={saving} aria-describedby={helpId}
          onChange={event => { setAmount(event.target.value); setError('') }} required />
      </label>
      <p id={helpId} className="phone-app-muted">Existing transfers and purchases are included in the available balance.</p>
      {valid && <div className="bank-row"><small>Available after saving</small>
        <strong>{bankAmount(balanceFor(account, transfers, cents), currency)}</strong></div>}
      {error && <p role="alert" className="phone-app-error">{error}</p>}
      <button type="submit" className="phone-app-button primary" disabled={saving}>
        <Icon name="check" />{saving ? 'Saving…' : 'Save opening balance'}
      </button>
    </form>
  </dialog>
}
