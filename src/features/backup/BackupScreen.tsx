import { useContext, useEffect, useRef, useState } from 'react'
import { BackButton, Screen, ScreenContext, ScreenHeader } from '../../components/phone'
import { Icon, IconButton } from '../../components/icons'
import { showScreen } from '../../app/routes'
import type { LocalDatabase } from '../../storage/database'
import { schema } from '../../../shared/storage'
import type { TableName } from '../../../shared/storage'
import { handleSmartImport } from '../../legacy/backup/backup.js'

const categories = {
  'Chats and contacts': ['chats', 'qzoneGroups', 'memories', 'callRecords', 'npcs'],
  'Personas': ['personaPresets'],
  'World Info and prompts': ['lorebooks', 'worldBooks', 'worldBookCategories', 'presets', 'presetCategories'],
  'Social and albums': ['socialPosts', 'socialProfiles', 'socialNotifications', 'qzonePosts', 'qzoneSettings', 'qzoneAlbums', 'qzonePhotos', 'favorites'],
  'Stickers and frames': ['userStickers', 'stickerCategories', 'customAvatarFrames'],
  'Home and appearance': ['homeWidgets', 'appearancePresets', 'globalSettings'],
  'Shopping': ['shoppingProducts', 'shoppingCategories'],
  'Bank and orders': ['bankAccounts', 'bankTransfers', 'marketOrders'],
  'Music and reading': ['musicLibrary', 'readingLibrary'],
  'API and device settings': ['apiConfig', 'apiPresets', 'deviceSettings'],
} as const satisfies Record<string, readonly TableName[]>
const groups = Object.entries(categories)

export function BackupScreen({ database }: { database?: LocalDatabase }) {
  const active = useContext(ScreenContext) === 'backup-screen'
  const [selected, setSelected] = useState<string[]>(Object.keys(categories))
  const [counts, setCounts] = useState<Partial<Record<TableName, number>>>({})
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!active || !database) return
    let current = true
    void Promise.all(database.tables.map(async table => [table.name, await table.count()] as const))
      .then(entries => { if (current) setCounts(Object.fromEntries(entries)) })
      .catch(() => { if (current) setNotice('Could not count saved records.') })
    return () => { current = false }
  }, [database, active])

  async function download() {
    const names = groups.flatMap(([label, tables]) => selected.includes(label) ? [...tables] : [])
    if (!names.length) return
    setBusy(true)
    setNotice('')
    try {
      const partial = names.length !== Object.keys(schema).length
      const url = '/api/backup.zip' + (partial ? '?' + new URLSearchParams({ tables: names.join(',') }) : '')
      const result = await fetch(url)
      if (!result.ok) throw new Error('Export failed')
      const href = URL.createObjectURL(await result.blob())
      const link = document.createElement('a')
      link.href = href
      link.download = 'EPhone-' + (partial ? 'Selected-' : '') + 'Backup-' + new Date().toLocaleDateString('sv-SE') + '.zip'
      link.click()
      setTimeout(() => URL.revokeObjectURL(href), 1000)
      setNotice('Backup downloaded.')
    } catch {
      setNotice('Could not export the backup.')
    } finally {
      setBusy(false)
    }
  }

  return <Screen id="backup-screen" className="phone-feature">
    <ScreenHeader><BackButton onClick={() => showScreen('home-screen')} /><span>Backup</span><Icon name="folder" /></ScreenHeader>
    <div className="phone-app-scroll phone-app-stack">
      <section className="phone-app-card">
        <div className="bank-row"><h2>Export data</h2><div className="settings-tools">
          <button type="button" className="phone-app-button compact" onClick={() =>
            setSelected(selected.length === groups.length ? [] : Object.keys(categories))}>
            {selected.length === groups.length ? 'Clear all' : 'Select all'}
          </button>
          <IconButton icon="export" label="Export backup ZIP" disabled={busy || !selected.length} aria-busy={busy} onClick={() => void download()} />
        </div></div>
        <div className="backup-options">
          {groups.map(([label, tables]) => <label key={label}>
            <input type="checkbox" checked={selected.includes(label)} onChange={() => setSelected(current =>
              current.includes(label) ? current.filter(item => item !== label) : [...current, label])} />
            <span>{label}</span><small>{tables.reduce((total, table) => total + (counts[table] ?? 0), 0)}</small>
          </label>)}
        </div>
      </section>
      <section className="phone-app-card">
        <div className="bank-row"><h2>Restore from ZIP or JSON</h2><IconButton icon="import" label="Choose ZIP or JSON" disabled={busy} onClick={() => picker.current?.click()} /></div>
        <input ref={picker} hidden type="file" accept=".zip,.json,application/zip,application/json" onChange={async event => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return
          setBusy(true)
          try { await handleSmartImport(file) } finally { setBusy(false) }
        }} />
      </section>
      <details className="settings-disclosure">
        <summary>Restore a full ZIP from the data folder</summary>
        <ol>
          <li>Close EPhone and stop its server.</li>
          <li>Extract the full backup ZIP and keep a copy of your current <code>data/eephone.json</code>.</li>
          <li>Replace the file with the extracted <code>eephone.json</code>, then start EPhone.</li>
        </ol>
      </details>
      {notice && <p role="status">{notice}</p>}
    </div>
  </Screen>
}
