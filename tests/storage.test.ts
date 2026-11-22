import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { openLocalStore } from '../server/storage.js'
import { normalizeWorldInfo } from '../src/features/world-book/model.js'
import { decodePortable, encodePortable } from '../src/storage/portable.js'

test('competing writes commit once and reopening reads the winning revision', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eephone-storage-'))
  try {
    const store = openLocalStore(directory)
    const save = (name: string) => store.save({
      revision: 0,
      tables: { chats: { nextId: 1, rows: [{ id: 'c1', name }] } },
    })
    const [first, second] = await Promise.allSettled([save('First'), save('Second')])
    assert.deepEqual(first, { status: 'fulfilled', value: { revision: 1 } })
    assert.equal(second.status, 'rejected')
    assert.equal(second.reason.status, 409)
    const data = await openLocalStore(directory).snapshot()
    assert.equal(data.revision, 1)
    assert.deepEqual(data.tables.chats?.rows, [{ id: 'c1', name: 'First' }])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('portable media retains bytes, MIME type, and dates through JSON', async () => {
  const binary = new Blob([new Uint8Array([0, 128, 255])], { type: 'image/png' })
  const date = new Date('2026-03-14T00:00:00Z')
  const data = decodePortable(JSON.parse(JSON.stringify(await encodePortable([binary, date]))))
  assert.ok(Array.isArray(data))
  assert.ok(data[0] instanceof Blob)
  assert.equal(data[0].type, 'image/png')
  assert.deepEqual([...new Uint8Array(await data[0].arrayBuffer())], [0, 128, 255])
  assert.deepEqual(data[1], date)
})

test('older World Info imports retain entry metadata and explicit disabled state', () => {
  assert.deepEqual(normalizeWorldInfo({ content: 'Lore' }).content, [
    { comment: 'Migrated entry', keys: [], content: 'Lore', enabled: true },
  ])
  assert.deepEqual(normalizeWorldInfo({ content: [null, { content: 'One', priority: 7 }, { content: 'Two', enabled: false }] }).content, [
    { content: 'One', priority: 7, enabled: true },
    { content: 'Two', enabled: false },
  ])
})
