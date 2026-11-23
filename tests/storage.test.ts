import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import JSZip from 'jszip'
import { openLocalStore } from '../server/storage.js'
import { normalizeWorldInfo } from '../src/features/world-book/model.js'
import { promptSteps, readTavernPreset } from '../src/features/presets/prompt-order.js'
import { buildContext, normalizeContext } from '../src/features/context/budget.js'
import { decodePortable, encodePortable } from '../src/storage/portable.js'

test('SillyTavern presets preserve ordering, roles, and disabled rows when assembling a prompt', () => {
  const prompts = [
    { identifier: 'skip', name: 'Disabled', content: 'Excluded' },
    { identifier: 'before', name: 'Main prompt', content: 'Start' },
    { identifier: 'after', name: 'Follow-up', content: 'Post-history', role: 'assistant' },
  ]
  const order = [
    { identifier: 'skip', enabled: false },
    { identifier: 'before', enabled: true },
    { identifier: 'worldInfoBefore', enabled: true },
    { identifier: 'worldInfoAfter', enabled: true },
    { identifier: 'chatHistory', enabled: true },
    { identifier: 'after', enabled: true },
  ]
  const entries = readTavernPreset({ prompts, prompt_order: [{ character_id: 100001, order }] })
  assert.deepEqual(entries.map(entry => entry.identifier), order.map(item => item.identifier))
  assert.equal(entries[0].enabled, false)
  assert.deepEqual(readTavernPreset({ data: { prompts, prompt_order: order } }), entries)
  const config = normalizeContext(undefined)
  const history = { qq: [{ message: { role: 'assistant', content: 'Earlier reply' } }] }
  const request = [{ role: 'user', content: 'Latest turn' }]
  const plan = buildContext(config, 'Base instructions', { worldInfo: 'Lore' }, history, request, promptSteps(entries))
  assert.deepEqual(plan.messages.map(message => message.content),
    ['Base instructions', 'Start', '# World Info\nLore', 'Earlier reply', 'Post-history', 'Latest turn'])
  assert.equal(plan.messages.at(-2)?.role, 'assistant')
  entries[4].enabled = false
  const withoutHistory = buildContext(config, '', {}, history, request, promptSteps(entries))
  assert.deepEqual(withoutHistory.messages.map(message => message.content), ['Start', 'Post-history', 'Latest turn'])
})

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

test('ZIP captures pending writes and can replace the local data file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eephone-export-'))
  const restored = await mkdtemp(join(tmpdir(), 'eephone-restore-'))
  try {
    const retired = { nextId: 2, rows: [{ id: 1, text: 'Old data' }] }
    await writeFile(join(directory, 'eephone.json'), JSON.stringify({
      version: 1, revision: 4, tables: { doubanPosts: retired },
    }))
    const store = openLocalStore(directory)
    const settings = { nextId: 1, rows: [{ id: 'social-profile', value: { name: 'Local profile' } }] }
    const saved = store.save({ revision: 4, tables: { deviceSettings: settings } })
    const zipped = store.backup()
    await saved
    const archive = await JSZip.loadAsync(await zipped)
    const snapshot = await archive.file('eephone.json')?.async('string')
    assert.ok(snapshot)
    assert.deepEqual(JSON.parse(snapshot).tables.doubanPosts, retired)
    await writeFile(join(restored, 'eephone.json'), snapshot)
    const reopened = await openLocalStore(restored).snapshot()
    assert.equal(reopened.revision, 5)
    assert.deepEqual(reopened.tables.deviceSettings, settings)
  } finally {
    await rm(directory, { recursive: true, force: true })
    await rm(restored, { recursive: true, force: true })
  }
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

test('selective ZIP includes precisely the requested tables, even when one is empty', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eephone-partial-'))
  try {
    const store = openLocalStore(directory)
    await store.save({ revision: 0, tables: {
      bankTransfers: { nextId: 1, rows: [{ id: 'transfer-1', cents: 2500 }] },
      apiConfig: { nextId: 1, rows: [{ id: 'main', model: 'local-model' }] },
    } })
    const archive = await JSZip.loadAsync(await store.backup(['bankTransfers', 'personaPresets']))
    const source = await archive.file('eephone.json')?.async('string')
    assert.ok(source)
    const snapshot = JSON.parse(source)
    assert.equal(snapshot.partial, true)
    assert.deepEqual(Object.keys(snapshot.tables), ['bankTransfers', 'personaPresets'])
    assert.deepEqual(snapshot.tables.bankTransfers.rows, [{ id: 'transfer-1', cents: 2500 }])
    assert.deepEqual(snapshot.tables.personaPresets, { nextId: 1, rows: [] })
    assert.ok((await store.snapshot()).tables.apiConfig)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
