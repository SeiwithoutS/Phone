import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import JSZip from 'jszip'
import { openLocalStore } from '../server/storage.js'
import { normalizeWorldInfo } from '../src/features/world-book/model.js'
import { promptSteps, readTavernPreset } from '../src/features/presets/prompt-order.js'
import { buildContext, latestUserTurn, messageTokens, normalizeContext } from '../src/features/context/budget.js'
import { localDateKey, resolveTimeZone, timeDifference } from '../src/features/chat/location.js'
import { formatChatActionNotice } from '../src/features/chat/action-notices.js'
import { changeCharacterNickname, describeUserIdentity, recoverLegacyNickname } from '../src/features/chat/user-identity.js'
import { decodePortable, encodePortable } from '../src/storage/portable.js'

test('legacy chat action notices translate their labels and preserve their original text fields', () => {
  const notice = (content: string, role = 'system', type = 'pat_message') => formatChatActionNotice({ role, type, content })
  const status = '[Thẩm Chỉ Duật的状态已更新为: Vẫn thức, đang nhìn điện thoại và nghĩ đến em.]'
  assert.equal(notice(status), '[Thẩm Chỉ Duật updated their status: Vẫn thức, đang nhìn điện thoại và nghĩ đến em.]')
  assert.equal(notice('Thẩm Chỉ Duật 拍了拍我 một cái thật khẽ'), 'Thẩm Chỉ Duật nudged you một cái thật khẽ')
  assert.equal(notice('Me 拍了拍 “沈止聿” 轻轻地'), 'Me nudged “沈止聿” 轻轻地')
  assert.equal(notice('[♪ Thẩm Chỉ Duật 为你切歌: 《晚安》 - A singer]'), '[♪ Thẩm Chỉ Duật changed the song to “晚安” - A singer]')
  assert.equal(notice(status, 'assistant', 'text'), status)
  assert.equal(notice(status, 'system', 'app_action_status'), status)
  assert.equal(notice('我还醒着。'), '我还醒着。')
  assert.equal(notice('Thẩm Chỉ Duật nudged you'), 'Thẩm Chỉ Duật nudged you')
  const vi = (content: string, role = 'system', type = 'pat_message') => formatChatActionNotice({ role, type, content }, 'vi')
  assert.equal(vi(status), '[Thẩm Chỉ Duật đã cập nhật trạng thái: Vẫn thức, đang nhìn điện thoại và nghĩ đến em.]')
  assert.equal(vi('Thẩm Chỉ Duật nudged you một cái thật khẽ'), 'Thẩm Chỉ Duật đã vỗ nhẹ vào bạn một cái thật khẽ')
  assert.equal(vi('“Thẩm Chỉ Duật” changed your nickname to “Bạc hà nhỏ”'), '“Thẩm Chỉ Duật” đã đổi biệt danh của bạn thành “Bạc hà nhỏ”')
  assert.equal(vi('Bank transfer failed: Insufficient balance', 'system', 'app_action_status'), 'Chuyển khoản thất bại: Insufficient balance')
  assert.equal(vi('你撤回了一条消息', 'user', 'recalled_message'), 'Bạn đã thu hồi một tin nhắn.')
  assert.equal(notice('对方撤回了一条消息', 'assistant', 'recalled_message'), 'The character recalled a message.')
  assert.equal(vi(status, 'assistant', 'text'), status)
})

test('character nickname changes preserve the applied persona name and recover known legacy nicknames', () => {
  const settings = { myNickname: 'An', myPersona: 'A student', characterNickname: '' }
  const chat = { name: 'Minh', settings }
  const notices = changeCharacterNickname(chat, '  Bạc hà nhỏ  ', 100)
  assert.equal(settings.myNickname, 'An')
  assert.equal(settings.characterNickname, 'Bạc hà nhỏ')
  assert.equal(notices?.[0].content, '“Minh” changed your nickname to “Bạc hà nhỏ”')
  assert.equal(notices?.[1].isHidden, true)
  assert.equal(changeCharacterNickname(chat, 'Bạc hà nhỏ', 102), undefined)
  assert.equal(changeCharacterNickname({ ...chat, isGroup: true }, 'New nickname', 103), undefined)
  assert.match(describeUserIdentity(settings), /display name is “An”.*nickname for the user in this chat is “Bạc hà nhỏ”/)

  const legacy = { myNickname: 'Bạc hà nhỏ', myPersona: settings.myPersona }
  const recover = (personas: Array<{ name: string; persona: string }>) => recoverLegacyNickname(legacy, notices ?? [], personas)
  assert.deepEqual(recover([{ name: 'An', persona: 'A student' }]), { myNickname: 'An', characterNickname: 'Bạc hà nhỏ' })
  assert.equal(recover([{ name: 'An', persona: 'A student' }, { name: 'Mai', persona: 'A student' }]), undefined)
  assert.equal(recoverLegacyNickname({ ...legacy, characterNickname: '' }, notices ?? [], [{ name: 'An', persona: 'A student' }]), undefined)
  const older = { ...notices![0], timestamp: 90, content: '"Minh" changed your nickname to "An nhỏ"' }
  assert.deepEqual(recoverLegacyNickname({ ...legacy, myNickname: 'An nhỏ' }, [], [{ name: 'An', persona: 'A student' }],
    [{ history: [older] }]), { myNickname: 'An', characterNickname: 'An nhỏ' })
  assert.deepEqual(recoverLegacyNickname(legacy, [older], [{ name: 'An', persona: 'A student' }],
    [{ history: notices }]), { myNickname: 'An', characterNickname: 'Bạc hà nhỏ' })
})

test('locations resolve independently and use daylight-saving offsets for the selected date', () => {
  assert.equal(resolveTimeZone('Hồ Chí Minh, Việt Nam', '').zone, 'Asia/Ho_Chi_Minh')
  assert.deepEqual(resolveTimeZone('Berlin', 'Asia/Saigon'), { zone: 'Asia/Saigon', source: 'manual' })
  assert.equal(resolveTimeZone('Unknown fictional city', 'Invalid/Zone').source, 'device')
  const january = new Date('2026-01-01T23:30:00Z')
  const july = new Date('2026-07-01T23:30:00Z')
  assert.equal(localDateKey('Europe/Berlin', january), '2026-01-02')
  assert.equal(timeDifference('Europe/Berlin', 'Asia/Ho_Chi_Minh', january), '6h behind your time')
  assert.equal(timeDifference('Europe/Berlin', 'Asia/Ho_Chi_Minh', july), '5h behind your time')
})

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

test('QQ Mini Prompts can be embedded between the persona and tools without changing preset slots', () => {
  const config = normalizeContext(undefined)
  const fixed = { miniPrompts: '# Linked World Book\nCharacter preferences', worldInfo: 'Lore activated by keyword' }
  const request = [{ role: 'user', content: 'Current turn' }]
  const plan = buildContext(config, 'Persona', fixed, {}, request, undefined, 'Available actions')
  assert.deepEqual(plan.messages.map(message => message.content), [
    'Persona\n\n# Linked World Book\nCharacter preferences\n\nAvailable actions', '# World Info\nLore activated by keyword', 'Current turn',
  ])
  assert.equal(plan.used, 3 + plan.messages.reduce((sum, message) => sum + messageTokens(message), 0))
  assert.equal(plan.used, 3 + plan.sections.reduce((sum, section) => sum + section.tokens, 0))
  assert.equal(plan.sections.find(section => section.id === 'miniPrompts')?.inline, true)

  const steps = [{ message: { role: 'system', content: 'Preset guidance' } }, { slot: 'miniPrompts', enabled: true }] as const
  const ordered = buildContext(config, 'Persona', fixed, {}, request, [...steps], 'Available actions')
  assert.deepEqual(ordered.messages.map(message => message.content), [
    'Persona\n\nAvailable actions', '# World Info\nLore activated by keyword', 'Preset guidance', '# Linked World Book\nCharacter preferences', 'Current turn',
  ])
  const disabled = buildContext(config, 'Persona', fixed, {}, request, [{ slot: 'miniPrompts', enabled: false }], 'Available actions')
  assert.equal(disabled.messages.some(message => String(message.content).includes('Character preferences')), false)
  config.sources.miniPrompts.enabled = false
  const excluded = buildContext(config, 'Persona', fixed, {}, request, undefined, 'Available actions')
  assert.equal(excluded.messages[0]?.content, 'Persona\n\nAvailable actions')
})

test('all pending QQ messages survive a zero history allowance in chronological order', () => {
  const messages = [
    { role: 'user', content: 'Earlier question' },
    { role: 'assistant', content: 'Earlier reply' },
    { role: 'user', content: 'Em nhớ anh.' },
    { role: 'system', content: 'App event' },
    { role: 'user', content: 'Em muốn ôm.' },
  ]
  const { history, request } = latestUserTurn(messages)
  assert.deepEqual(history, messages.slice(0, 2))
  const config = normalizeContext({ sources: { qq: { enabled: true, percent: 0 } } })
  const plan = buildContext(config, '', {}, { qq: history.map(message => ({ message })) }, request)
  assert.deepEqual(plan.messages, messages.slice(2))
  assert.deepEqual(latestUserTurn(messages.slice(0, 2)), { history: messages.slice(0, 2), request: [] })
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
