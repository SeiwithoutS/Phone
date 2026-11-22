import type { Snapshot, StoredRow, TableData, TableName } from '../../shared/storage'
import { decodePortable, encodePortable } from './portable'
import { schema } from '../../shared/storage'
import { Table } from './table'
import { normalizeWorldInfo } from '../features/world-book/model'

const names = Object.keys(schema) as TableName[]
type TableMap = Record<TableName, Table>
type Scope = TableMap & { table: (name: TableName) => Table; tables: Table[] }
type TableRef = Table | TableName
type Operation<T> = (scope: Scope) => T | Promise<T>

const emptyTable = (): TableData => ({ nextId: 1, rows: [] })
const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})
const legacyDatabaseName = 'GeminiChatDB'
const preferenceKeys = ['ephone-theme', 'ephoneLastActiveTimestamp', 'unreadPostsCount',
  'dismissedUpdateVersion', 'novelai-enabled', 'novelai-model', 'novelai-api-key', 'novelai-settings']

async function readLegacyTables(): Promise<Partial<Record<TableName, StoredRow[]>>> {
  if (!indexedDB.databases || !(await indexedDB.databases()).some(db => db.name === legacyDatabaseName)) return {}
  const db = await requestResult(indexedDB.open(legacyDatabaseName))
  try {
    const names = [...db.objectStoreNames].filter(name => Object.hasOwn(schema, name))
    if (!names.length) return {}
    const read = db.transaction(names, 'readonly')
    return Object.fromEntries(await Promise.all(names.map(async name =>
      [name, await requestResult(read.objectStore(name).getAll())])))
  } finally {
    db.close()
  }
}

function exchange(method: 'GET'): Promise<Snapshot>
function exchange(method: 'PATCH', body: unknown): Promise<{ revision: number }>
async function exchange(method: 'GET' | 'PATCH', body?: unknown) {
  const response = await fetch('/api/storage', {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Could not save local data.')
  }
  return data
}

function makeScope(
  read: (name: TableName) => TableData,
  write: <T>(name: TableName, update: (table: TableData) => T) => Promise<T>,
  allowed: ReadonlySet<TableName> = new Set(names),
): Scope {
  const tables = names.map(name => new Table(name, schema[name], () => read(name), update => write(name, update)))
  const byName = Object.fromEntries(tables.map(table => [table.name, table])) as TableMap
  return Object.assign(byName, {
    tables,
    table(name: TableName) {
      if (!allowed.has(name)) throw new Error(`Unavailable table: ${name}`)
      return byName[name]
    },
  })
}

// Expose named tables for existing callers (db.chats, tx.worldBooks, etc.).
export interface LocalDatabase extends Scope {}
export class LocalDatabase {
  #revision: number
  #data: Record<TableName, TableData>
  #queue: Promise<unknown> = Promise.resolve()

  constructor({ revision, tables }: Snapshot) {
    this.#revision = revision
    this.#data = Object.fromEntries(names.map(name =>
      [name, tables[name] ? decodePortable(tables[name]) : emptyTable()])) as Record<TableName, TableData>
    Object.assign(this, makeScope(
      name => this.#data[name],
      (name, update) => this.#commit([name], scoped => scoped[name].write(update)),
    ))
  }

  transaction<T>(mode: 'rw', ...args: [...refs: (TableRef | TableRef[])[], operation: Operation<T>]) {
    if (mode !== 'rw') throw new Error('Unsupported transaction mode')
    const operation = args.pop() as Operation<T>
    const refs = (args as (TableRef | TableRef[])[]).flat()
    const selected = [...new Set(refs.map(ref => typeof ref === 'string' ? ref : ref.name))]
    return this.#commit(selected, operation)
  }

  #commit<T>(selected: TableName[], operation: Operation<T>): Promise<T> {
    const save = this.#queue.then(async () => {
      const allowed = new Set(selected)
      const changed = new Map<TableName, TableData>()
      const scoped = makeScope(
        name => changed.get(name) ?? this.#data[name],
        async (name, update) => {
          if (!allowed.has(name)) throw new Error(`Table ${name} is outside the transaction`)
          const data = changed.get(name) ?? structuredClone(this.#data[name])
          changed.set(name, data)
          return update(data)
        },
        allowed,
      )
      const result = await operation(scoped)
      if (!changed.size) return result
      const patch = await encodePortable(Object.fromEntries(changed))
      const { revision } = await exchange('PATCH', { revision: this.#revision, tables: patch })
      this.#revision = revision
      for (const [name, table] of changed) this.#data[name] = table
      return result
    })
    this.#queue = save.catch(error => {
      window.dispatchEvent(new CustomEvent('eephone:storage-error', { detail: error.message }))
    })
    return save
  }

  getPreference(key: string) {
    return this.#data.deviceSettings.rows.find(item => item.id === key)?.value ?? null
  }
}

export async function openLocalDatabase() {
  const storage = await exchange('GET')
  const db = new LocalDatabase(storage)
  if (storage.revision !== 0) return db

  const previous = await readLegacyTables()
  const settings = preferenceKeys.map(id => ({ id, value: localStorage.getItem(id) }))
    .filter(entry => entry.value !== null)
  if (!Object.keys(previous).length && !settings.length) return db

  await db.transaction('rw', db.tables, async tx => {
    for (const name of names) {
      const rows = previous[name]
      if (!rows) continue
      if (name === 'worldBooks') rows.forEach(row => normalizeWorldInfo(row))
      await tx.table(name).bulkPut(rows)
    }
    await tx.deviceSettings.bulkPut(settings)
  })
  return db
}
