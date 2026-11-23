import { useEffect, useRef, useState } from 'react'
import { Icon, IconButton } from '../../components/icons'
import { fileDataUrl, imageSource } from '../../runtime/files'
import type { LocalDatabase } from '../../storage/database'
import { useBankCurrency } from '../bank/useBankCurrency'
import { addMarketProduct } from './market'
import type { MarketKind } from './market'

export function MarketProductEditor({ database, initialKind, close, saved }: {
  database: LocalDatabase; initialKind: MarketKind; close: () => void; saved: (kind: MarketKind) => void
}) {
  const currency = useBankCurrency(database)
  const dialog = useRef<HTMLDialogElement>(null)
  const [kind, setKind] = useState(initialKind)
  const [url, setUrl] = useState('')
  const [upload, setUpload] = useState('')
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const preview = imageSource(upload || url)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return <dialog ref={dialog} className="phone-feature market-editor" aria-labelledby="market-editor-title" onCancel={event => {
    event.preventDefault()
    if (!busy) close()
  }}>
    <header className="bank-row"><h2 id="market-editor-title">Add product</h2><IconButton icon="close" label="Close" onClick={close} disabled={busy} /></header>
    <form className="phone-app-stack" onSubmit={async event => {
      event.preventDefault()
      if (busy || reading) return
      const fields = new FormData(event.currentTarget)
      setBusy(true)
      setError('')
      try {
        await addMarketProduct(database, { name: String(fields.get('name')), price: String(fields.get('price')),
          seller: String(fields.get('seller')), description: String(fields.get('description')), kind, image: upload || url })
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Could not save the product.')
        setBusy(false)
        return
      }
      saved(kind)
    }}>
      <div className="market-image-preview">{preview ? <img src={preview} alt="Product preview" onError={event => { event.currentTarget.hidden = true }} key={preview} /> : <Icon name="image" />}</div>
      <label>Upload image<input type="file" accept="image/*" disabled={busy || reading} onChange={async event => {
        const file = event.currentTarget.files?.[0]
        if (!file) return
        event.currentTarget.value = ''
        setReading(true)
        setError('')
        try {
          if (file.size > 4 * 1024 * 1024) throw new Error('Choose an image under 4 MB.')
          const next = imageSource(await fileDataUrl(file))
          if (!next) throw new Error('Choose a PNG, JPEG, WebP, GIF, or another supported format.')
          setUpload(next)
          setUrl('')
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not read the image.') }
        finally { setReading(false) }
      }} /></label>
      <label>Image URL<input type="url" value={url} onChange={event => { setUrl(event.target.value); setUpload('') }} placeholder="https://…" disabled={busy || reading} /></label>
      {upload && <button type="button" className="phone-app-button compact" onClick={() => setUpload('')} disabled={busy || reading}>Remove image</button>}
      <label>Product name<input name="name" required maxLength={100} disabled={busy} /></label>
      <div className="phone-app-two">
        <label>Price ({currency})<input name="price" inputMode="decimal" required placeholder="0.00" disabled={busy} /></label>
        <label>Category<select value={kind} onChange={event => setKind(event.target.value as MarketKind)} disabled={busy}>
          <option value="goods">Goods</option><option value="food">Food & drinks</option>
        </select></label>
      </div>
      <label>Shop name<input name="seller" maxLength={80} placeholder="Local Shop" disabled={busy} /></label>
      <label>Description<textarea name="description" maxLength={500} rows={3} disabled={busy} /></label>
      {error && <p role="alert" className="phone-app-error">{error}</p>}
      <button type="submit" className="phone-app-button primary" disabled={busy || reading}>{busy ? 'Saving…' : 'Save product'}</button>
    </form>
  </dialog>
}
