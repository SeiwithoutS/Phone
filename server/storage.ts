import { open, chmod, mkdir, readFile, rename, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { schema } from '../shared/storage.js'
import type { Snapshot, TableName, Tables } from '../shared/storage.js'
import { localAddress, loopbackAddress } from './local-address.js'
import JSZip from 'jszip'

const maxBytes = 256 * 1024 * 1024
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const isKey = (key: unknown) => typeof key === 'string' || Number.isSafeInteger(key)

class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function validateTables(tables: unknown): asserts tables is Tables {
  if (!isObject(tables)) throw new HttpError(400, 'Expected an object with table data.')
  for (const [name, table] of Object.entries(tables)) {
    if (!Object.hasOwn(schema, name) || !isObject(table) ||
        typeof table.nextId !== 'number' || !Number.isSafeInteger(table.nextId) || table.nextId < 1 || !Array.isArray(table.rows)) {
      throw new HttpError(400, `Invalid local table: ${name}`)
    }
    const keys = new Set()
    for (const row of table.rows) {
      if (!isObject(row) || !isKey(row.id) || keys.has(row.id)) {
        throw new HttpError(400, `Invalid or duplicate record ID in ${name}.`)
      }
      keys.add(row.id)
    }
  }
}

async function readJson(request: IncomingMessage, sizeLimit = maxBytes): Promise<unknown> {
  const chunks = []
  let size = 0
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length
    if (size > sizeLimit) {
      request.resume()
      throw new HttpError(413, 'The request is too large.')
    }
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Invalid JSON.')
  }
}

function reply(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  response.end(JSON.stringify(body))
}

function assertLocalRequest(request: IncomingMessage, allowedHosts: ReadonlySet<string>) {
  const host = request.headers.host ?? ''
  const hostname = host.match(/^([a-z0-9.-]+)(?::\d+)?$/i)?.[1].toLowerCase()
  if (!hostname || !allowedHosts.has(hostname)) throw new HttpError(403, 'Local connections only.')
  if (request.headers.origin && request.headers.origin !== `http://${host}`) {
    throw new HttpError(403, 'Cross-origin access is disabled.')
  }
  const site = request.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') throw new HttpError(403, 'Cross-origin access is disabled.')
}

async function replaceSnapshot(temporary: string, filename: string) {
  let retries = process.platform === 'win32' ? 4 : 0
  for (let wait = 20; ; wait *= 2) {
    try {
      await rename(temporary, filename)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (!retries || !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')) throw error
      retries--
      await delay(wait)
    }
  }
}

export function openLocalStore(directory: string) {
  const filename = resolve(directory, 'eephone.json')
  const retiredTables: Record<string, unknown> = {}
  let read = load()
  // Handle the promise before the first request arrives.
  void read.catch(() => {})
  let queue: Promise<unknown> = Promise.resolve()

  async function load(): Promise<Snapshot> {
    let stored: unknown
    try {
      stored = JSON.parse(await readFile(filename, 'utf8'))
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { version: 1, revision: 0, tables: {} }
      throw error
    }
    if (!isObject(stored) || stored.version !== 1 || typeof stored.revision !== 'number' || !Number.isSafeInteger(stored.revision) || stored.revision < 0) {
      throw new Error('Unsupported EPhone data file.')
    }
    if (isObject(stored.tables)) {
      // Keep old data in the local file while exposing only active tables to the app.
      for (const name of ['doubanPosts', 'renderingRules']) {
        if (Object.hasOwn(stored.tables, name)) {
          retiredTables[name] = stored.tables[name]
          delete stored.tables[name]
        }
      }
    }
    validateTables(stored.tables)
    return { version: 1, revision: stored.revision, tables: stored.tables }
  }

  async function commit(body: unknown) {
    if (!isObject(body) || !Number.isSafeInteger(body.revision)) throw new HttpError(400, 'Invalid data revision.')
    validateTables(body.tables)
    const current = await read
    if (body.revision !== current.revision) {
      throw new HttpError(409, 'Another tab saved new data. Reload this tab before making changes.')
    }
    const next: Snapshot = { version: 1, revision: current.revision + 1, tables: { ...current.tables, ...body.tables } }
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const temporary = `${filename}.${randomUUID()}.tmp`
    try {
      const file = await open(temporary, 'wx', 0o600)
      try {
        await file.writeFile(JSON.stringify({ ...next, tables: { ...retiredTables, ...next.tables } }))
        await file.sync()
      } finally {
        await file.close()
      }
      await replaceSnapshot(temporary, filename)
    } catch (error) {
      await unlink(temporary).catch(() => {})
      throw error
    }
    if (process.platform !== 'win32') await chmod(filename, 0o600).catch(() => {})
    read = Promise.resolve(next)
    return { revision: next.revision }
  }

  return {
    snapshot: () => read,
    async backup(selected?: TableName[]) {
      await queue
      const data = await read
      const archive = new JSZip()
      const tables = selected ? Object.fromEntries(selected.map(name =>
        [name, data.tables[name] ?? { nextId: 1, rows: [] }])) : { ...retiredTables, ...data.tables }
      archive.file('eephone.json', JSON.stringify({ ...data, ...(selected ? { partial: true } : {}), tables }))
      return archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    },
    save(body: unknown) {
      const result = queue.then(() => commit(body))
      queue = result.catch(() => {})
      return result
    },
  }
}

export function createStorageHandler(directory: string, host = localAddress().host) {
  const store = openLocalStore(directory)
  const allowedHosts = new Set([host, 'localhost', loopbackAddress])
  return async function storage(request: IncomingMessage, response: ServerResponse, next: () => void) {
    const path = request.url?.split('?')[0]
    if (path !== '/api/activity-log' && path !== '/api/storage' && path !== '/api/backup' && path !== '/api/backup.zip') {
      next()
      return
    }

    try {
      assertLocalRequest(request, allowedHosts)
      if (path === '/api/activity-log') {
        if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.')
        if (request.headers['content-type']?.split(';')[0] !== 'application/json') throw new HttpError(415, 'Expected JSON.')
        const event = await readJson(request, 1024)
        if (!isObject(event) || !['completion', 'bank.transfer', 'backup.restore'].includes(String(event.action)) ||
          !['ok', 'failed'].includes(String(event.result))) throw new HttpError(400, 'Invalid activity event.')
        const duration = typeof event.milliseconds === 'number' && Number.isFinite(event.milliseconds)
          ? ' · ' + Math.max(0, Math.round(event.milliseconds)) + 'ms' : ''
        if (event.result === 'ok') console.info('[EPhone]', event.action, 'ok' + duration)
        else console.warn('[EPhone]', event.action, 'failed' + duration)
        response.writeHead(204).end()
        return
      }
      if (request.method === 'GET') {
        if (path === '/api/backup.zip') {
          const query = new URL(request.url ?? '/', 'http://localhost').searchParams.get('tables')
          const selected = query?.split(',')
          if (selected?.some(name => !Object.hasOwn(schema, name)) || query === '') throw new HttpError(400, 'Invalid backup selection.')
          const archive = await store.backup(selected as TableName[] | undefined)
          console.info('[EPhone] backup.export ok · ' + (selected ? selected.length + ' tables' : 'full'))
          const day = new Date().toISOString().slice(0, 10)
          response.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="EPhone-User-Data-${day}.zip"`,
            'Content-Length': String(archive.length),
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          })
          response.end(archive)
          return
        }
        const data = await store.snapshot()
        if (path === '/api/storage') {
          reply(response, 200, data)
          return
        }
        const tables = Object.fromEntries((Object.keys(schema) as TableName[]).map(name =>
          [name, data.tables[name]?.rows ?? []]))
        const day = new Date().toISOString().slice(0, 10)
        reply(response, 200, { version: 4, timestamp: Date.now(), data: tables }, {
          'Content-Disposition': `attachment; filename="EPhone-Backup-${day}.json"`,
        })
        return
      }
      if (request.method !== 'PATCH' || path !== '/api/storage') throw new HttpError(405, 'Method not allowed.')
      if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
        throw new HttpError(415, 'Expected JSON.')
      }
      const body = await readJson(request)
      reply(response, 200, await store.save(body))
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      if (status === 500) console.error('Local storage error', error)
      reply(response, status, { error: error instanceof HttpError ? error.message : 'Could not read or save the local data file.' })
    }
  }
}
