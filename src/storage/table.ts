import type { Key, StoredRow, TableData, TableName } from '../../shared/storage'

type Predicate = (record: StoredRow) => boolean
type Changes = Record<string, unknown> | ((record: StoredRow) => void)
type InputRow = Record<string, unknown> & { id?: Key }
type Write = <T>(update: (data: TableData) => T) => Promise<T>

function getField(record: StoredRow, path: string): unknown {
  return path.split('.').reduce<unknown>((value, part) =>
    typeof value === 'object' && value !== null ? Reflect.get(value, part) : undefined, record)
}

const validKey = (value: unknown) => typeof value === 'string' || Number.isFinite(value) || value instanceof Date

function compare(left: unknown, right: unknown) {
  if (left === right) return 0
  if (typeof left !== typeof right) return typeof left === 'number' ? -1 : 1
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime()
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left) < String(right) ? -1 : 1
}

interface QueryOptions {
  field: string
  tests: Predicate[]
  ordered: boolean
  descending: boolean
  maximum: number
}

class Query {
  private readonly options: QueryOptions

  constructor(private readonly table: Table, options: Partial<QueryOptions> = {}) {
    this.options = { field: 'id', tests: [], ordered: false, descending: false, maximum: Infinity, ...options }
  }

  private copy(changes: Partial<QueryOptions>) { return new Query(this.table, { ...this.options, ...changes }) }
  reverse() { return this.copy({ descending: !this.options.descending }) }
  limit(maximum: number) { return this.copy({ maximum }) }
  filter(predicate: Predicate) { return this.copy({ tests: [...this.options.tests, predicate] }) }
  and(predicate: Predicate) { return this.filter(predicate) }
  equals(value: unknown) { return this.filter(row => getField(row, this.options.field) === value) }
  equalsIgnoreCase(value: unknown) {
    const needle = String(value).toLowerCase()
    return this.filter(row => String(getField(row, this.options.field) ?? '').toLowerCase() === needle)
  }
  anyOf(values: Iterable<unknown>) {
    const set = new Set(values)
    return this.filter(row => set.has(getField(row, this.options.field)))
  }
  noneOf(values: Iterable<unknown>) {
    const set = new Set(values)
    return this.filter(row => validKey(getField(row, this.options.field)) && !set.has(getField(row, this.options.field)))
  }

  select(rows: StoredRow[]) {
    const field = this.options.field
    let matches = rows.filter(row => (!this.options.ordered || validKey(getField(row, field)))
      && this.options.tests.every(test => test(row)))
    matches.sort((a, b) => compare(getField(a, field), getField(b, field)) || compare(a.id, b.id))
    if (this.options.descending) matches.reverse()
    return matches.slice(0, this.options.maximum)
  }

  async toArray() { return structuredClone(this.select(this.table.read().rows)) }
  async first() { return (await this.limit(1).toArray())[0] }
  async count() { return this.select(this.table.read().rows).length }
  async primaryKeys() { return this.select(this.table.read().rows).map(row => row.id) }
  async each(callback: (row: StoredRow) => void) {
    for (const record of await this.toArray()) callback(record)
  }

  delete() {
    return this.table.write(table => {
      const ids = new Set(this.select(table.rows).map(row => row.id))
      table.rows = table.rows.filter(row => !ids.has(row.id))
      return ids.size
    })
  }

  modify(changes: Changes) {
    return this.table.write(table => {
      const rows = this.select(table.rows)
      for (const row of rows) {
        if (typeof changes === 'function') changes(row)
        else Object.assign(row, structuredClone(changes))
      }
      return rows.length
    })
  }
}

export class Table {
  constructor(
    readonly name: TableName,
    readonly definition: { autoIncrement: boolean },
    readonly read: () => TableData,
    readonly write: Write,
  ) {}

  async count() { return this.read().rows.length }

  where(field: string | Record<string, unknown>) {
    if (typeof field === 'string') return new Query(this, { field })
    const criteria = Object.entries(field)
    return this.toCollection().filter(row => criteria.every(([name, value]) => getField(row, name) === value))
  }
  orderBy(field: string) { return new Query(this, { field, ordered: true }) }
  toCollection() { return new Query(this) }
  toArray() { return this.toCollection().toArray() }
  each(callback: (row: StoredRow) => void) { return this.toCollection().each(callback) }
  async get(key: Key) {
    const row = this.read().rows.find(item => item.id === key)
    return row === undefined ? undefined : structuredClone(row)
  }

  add(row: InputRow) { return this.#save([row], true) }
  put(row: InputRow) { return this.#save([row], false) }
  bulkAdd(rows: InputRow[]) { return this.#save(rows, true) }
  bulkPut(rows: InputRow[]) { return this.#save(rows, false) }
  delete(key: Key) { return this.bulkDelete([key]) }
  bulkDelete(keys: Iterable<Key>) {
    const set = new Set(keys)
    return this.write(table => {
      table.rows = table.rows.filter(row => !set.has(row.id))
    })
  }

  clear() { return this.write(table => { table.rows = [] }) }
  restore(rows: InputRow[], nextId?: number) { return this.#save(rows, false, { nextId }) }
  update(key: Key, changes: Record<string, unknown>) {
    return this.write(table => {
      const row = table.rows.find(item => item.id === key)
      if (!row) return 0
      Object.assign(row, structuredClone(changes), { id: key })
      return 1
    })
  }

  #save(rows: InputRow[], addOnly: boolean, restore?: { nextId?: number }) {
    const records = structuredClone(rows)
    return this.write(table => {
      if (restore) {
        table.rows = []
        if (this.definition.autoIncrement && restore.nextId != null) table.nextId = Math.max(table.nextId, restore.nextId)
      }
      const index = new Map(table.rows.map((row, position) => [row.id, position]))
      let key: Key | undefined
      for (const row of records) {
        if (row.id === undefined && this.definition.autoIncrement) row.id = table.nextId++
        key = row.id
        if (typeof key !== 'string' && (typeof key !== 'number' || !Number.isSafeInteger(key))) {
          throw new Error(`Missing or invalid record ID in ${this.name}`)
        }
        if (this.definition.autoIncrement && typeof key === 'number') {
          table.nextId = Math.max(table.nextId, key + 1)
        }
        const position = index.get(key)
        const saved: StoredRow = { ...row, id: key }
        if (position === undefined) {
          index.set(key, table.rows.length)
          table.rows.push(saved)
        } else if (addOnly) {
          throw new Error(`An item with ID ${key} already exists in ${this.name}`)
        } else {
          table.rows[position] = saved
        }
      }
      return key
    })
  }
}
