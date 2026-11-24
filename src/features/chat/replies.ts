import { iconPaths } from '../../components/icons'
import { getGeminiResponseText } from '../../legacy/api/client.js'
import { triggerAiResponse } from '../../legacy/chat/ai.js'
import { buildChatReplyContext } from '../../legacy/chat/ai/context.js'
import { alternateReplyBubbles } from '../../legacy/chat/ai/reply-bubbles.js'
import { openAdvancedMessageEditor } from '../../legacy/chat/editor.js'
import { enterSelectionMode } from '../../legacy/chat/messages.js'
import { requestContextCompletion } from '../api/completion'
import { latestUserTurn } from '../context/context'
import { isReply, isUserMessage, isVisibleReply, replyAnchor, replyForUser, replyTimestamp, replyTurn, turnVersions, withoutReplyVersions } from './reply-turns'
import { changeSession, manualMemory, mutateConversation, rerenderConversation, storeConversation } from './sessions'
import type { ChatMessage, DirectChat, GroupChat } from './model'

type Chat = DirectChat | GroupChat

function isEditableText(message: ChatMessage) {
  return typeof message.content === 'string' && (!message.type || ['text', 'offline_text', 'quote_reply'].includes(message.type))
}

function versionSignature(messages: ChatMessage[]) {
  return JSON.stringify(messages.filter(message => !message.isHidden).map(
    ({ senderName, type, content, dialogue, description, quote }) =>
      [senderName, type || 'text', content, dialogue, description, quote?.timestamp],
  ))
}

async function generateAlternatives(chat: Chat, turn: ChatMessage[], turnId: string, versions: Array<ChatMessage[] | null>) {
  const anchor = replyAnchor(chat.history, turn)
  const start = chat.history.indexOf(turn[0])
  const anchorIndex = anchor ? chat.history.indexOf(anchor) : -1
  const newerUser = anchor ? chat.history.findIndex((message, index) =>
    index > anchorIndex && index < start && isUserMessage(message)) : -1
  const preceding = chat.history.slice(0, newerUser === -1 ? start : newerUser)
  const contextChat = { ...chat, history: preceding, longTermMemory: manualMemory(chat) }
  const { systemPrompt, messagesPayload, activitySources } = await buildChatReplyContext(contextChat, chat.id, { alternate: true })
  const { history, request } = anchor ? latestUserTurn(messagesPayload, true) : { history: messagesPayload, request: [] }
  const opening = turn.some(message => message.isOpening)
  const previous = versions.slice(-4).map(version => (version ?? turn).filter(isReply)
    .map(message => String(message.content ?? '').slice(0, 350)).join('\n').slice(0, 2000))
  const instructions = systemPrompt + '\n\n# Alternate chat turn\n' +
    'Generate a complete alternative for this turn. ' +
    (opening ? 'Write a new opening. ' : '') + 'Avoid repeating the previous versions.'
  const response = await requestContextCompletion(contextChat, {
    instructions, history, rawHistory: preceding, task: 'QQ swipe',
    activity: [...activitySources, 'Previous versions to avoid repeating:\n' + JSON.stringify(previous)],
    request: request.length ? request : [{ role: 'user', content: opening
      ? 'Write an alternative opening.' : 'Write an alternative chat turn at this point.' }],
  }, { signal: AbortSignal.timeout(60000), swipes: !chat.settings.isOfflineMode })
  if (!response.ok) throw new Error('Could not generate a reply (HTTP ' + response.status + ').')
  const data = await response.json()
  let timestamp = replyTimestamp(chat.history.concat(...versions.flatMap(version => version ?? [])))
  const time = turn[0].replyTurnTime ?? turn.find(isReply)?.timestamp ?? Date.now()
  const seen = new Set(versions.map(version => versionSignature(version ?? turn)))
  const choices = [getGeminiResponseText(data), ...(data.eephoneAlternatives ?? [])]
  const alternatives = choices.flatMap(raw => {
    const messages: ChatMessage[] = alternateReplyBubbles(contextChat, raw, turnId, time, () => timestamp++, opening)
    const signature = versionSignature(messages)
    if (!messages.length || seen.has(signature)) return []
    seen.add(signature)
    return [messages]
  })
  if (!alternatives.length) throw new Error('The AI returned no new reply. Try again for another version.')
  return alternatives
}

async function editMessage(chat: Chat, message: ChatMessage, text: string) {
  await mutateConversation(chat, async () => {
    const index = chat.history.indexOf(message)
    if (index < 0) throw new Error('This message has changed. Open it and try again.')
    const history = chat.history.slice()
    const swipes = message.swipes
    history[index] = { ...message, content: text, plainText: true,
      ...(swipes && { swipes: { ...swipes, variants: swipes.variants.map((variant, position) =>
        position === swipes.index ? { text, plainText: true } : variant) } }),
    }
    await storeConversation(chat, { history })
    rerenderConversation(chat, true)
  })
}

async function swipeReply(chat: Chat, message: ChatMessage, direction: -1 | 1, alwaysGenerate = false) {
  await mutateConversation(chat, async () => {
    const turn = replyTurn(chat.history, message)
    if (!turn) throw new Error('This reply has changed. Open it and try again.')
    const { variants: saved, index } = turnVersions(turn)
    const variants = saved.slice()
    const next = alwaysGenerate ? variants.length : index + direction
    if (next < 0) return
    const turnId = turn[0].replyTurnId ?? crypto.randomUUID()
    const time = turn[0].replyTurnTime ?? turn.find(isReply)?.timestamp
    if (next === variants.length) variants.push(...await generateAlternatives(chat, turn, turnId, variants))
    const replaced = new Set(turn)
    if (!turn.every(item => chat.history.includes(item))) throw new Error('This reply has changed. Open it and try again.')
    const replyToUserTimestamp = turn[0].replyToUserTimestamp === undefined
      ? replyAnchor(chat.history, turn)?.timestamp ?? null : turn[0].replyToUserTimestamp
    const nextTurn = variants[next]!.map(item => ({
      ...withoutReplyVersions(item), replyTurnId: turnId, replyTurnTime: time, replyToUserTimestamp,
    }))
    variants[index] = turn.map(withoutReplyVersions)
    variants[next] = null
    nextTurn[0].replyVersions = { variants, index: next }
    const start = chat.history.indexOf(turn[0])
    const history = chat.history.slice(0, start).concat(nextTurn, chat.history.slice(start).filter(item => !replaced.has(item)))
    await storeConversation(chat, { history, longTermMemory: manualMemory(chat), lastMemorySummaryTimestamp: 0 })
    rerenderConversation(chat, true)
  })
}

export async function regenerateReply(chat: Chat) {
  const lastUser = chat.history.findLast(isUserMessage)
  const target = !lastUser || chat.isSpectatorGroup ? chat.history.findLast(isVisibleReply) : replyForUser(chat.history, lastUser)
  if (target) return swipeReply(chat, target, 1, true)
  if (lastUser) await triggerAiResponse()
  else throw new Error('Send a message before generating a reply.')
}

function swipeMenuTarget(history: ChatMessage[], message: ChatMessage) {
  if (isUserMessage(message)) return replyForUser(history, message)
  if (!isVisibleReply(message)) return
  const turn = replyTurn(history, message)
  if (!turn || turn.find(item => isVisibleReply(item) &&
    !['recalled_message', 'post_deleted_notice', 'pat_message', 'app_action_status'].includes(item.type ?? '')) !== message) return
  const anchor = replyAnchor(history, turn)
  const anchoredReply = anchor && replyForUser(history, anchor)
  if (!anchoredReply || !turn.includes(anchoredReply)) return message
}

const icons = {
  edit: iconPaths.edit,
  branch: 'M6 5v15m0-7h6a5 5 0 0 0 5-5V5m-3 3 3-3 3 3',
  previous: 'm14 6-6 6 6 6',
  next: 'm10 6 6 6-6 6',
}

function messageButton(label: string, path: string, run?: () => void, type: 'button' | 'submit' = 'button') {
  const button = document.createElement('button')
  button.type = type
  button.className = 'phone-button qq-message-button'
  button.title = label
  button.setAttribute('aria-label', label)
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>'
  button.addEventListener('click', event => { event.stopPropagation(); run?.() })
  return button
}

function positionMessageMenu(trigger: HTMLButtonElement, menu: HTMLElement) {
  const anchor = trigger.getBoundingClientRect()
  const { width, height } = menu.getBoundingClientRect()
  const gap = 6
  const left = anchor.right - width
  const below = anchor.bottom + gap
  const above = anchor.top - gap - height
  const top = below + height <= window.innerHeight - gap ? below : above
  menu.style.left = `${Math.max(gap, Math.min(left, window.innerWidth - width - gap))}px`
  menu.style.top = `${Math.max(gap, top)}px`
}

let messageMenuDismissalBound = false

function bindMessageMenuDismissal() {
  if (messageMenuDismissalBound) return
  messageMenuDismissalBound = true
  const dismiss = () => document.querySelector<HTMLElement>('.qq-message-menu:popover-open')?.hidePopover()
  document.addEventListener('scroll', event => {
    if (!(event.target instanceof HTMLElement) || event.target.id !== 'chat-messages') return
    const menu = event.target.querySelector<HTMLElement>('.qq-message-menu:popover-open')
    const trigger = menu?.parentElement?.querySelector<HTMLButtonElement>('.qq-message-menu-trigger')
    if (!menu || !trigger) return
    const anchor = trigger.getBoundingClientRect()
    const viewport = event.target.getBoundingClientRect()
    if (anchor.bottom <= viewport.top || anchor.top >= viewport.bottom) menu.hidePopover()
    else positionMessageMenu(trigger, menu)
  }, { capture: true, passive: true })
  window.addEventListener('resize', dismiss)
}

export function addMessageTools(wrapper: HTMLElement, message: ChatMessage, chat: Chat) {
  if (message.isTemporary || message.isHidden || message.timestamp == null) return
  const bubble = wrapper.querySelector<HTMLElement>('.message-bubble')
  const content = bubble?.querySelector<HTMLElement>('.content')
  if (!bubble || !content) return
  bindMessageMenuDismissal()
  const toolbar = document.createElement('div')
  toolbar.className = 'qq-message-tools'
  toolbar.addEventListener('mousedown', event => event.stopPropagation())
  toolbar.addEventListener('touchstart', event => event.stopPropagation(), { passive: true })
  const trigger = messageButton('Message actions', iconPaths.more)
  trigger.className = 'phone-button qq-message-menu-trigger'
  const menu = document.createElement('div')
  menu.className = 'qq-message-menu'
  menu.popover = 'auto'
  menu.setAttribute('role', 'group')
  menu.setAttribute('aria-label', 'Message actions')
  trigger.popoverTargetElement = menu
  menu.addEventListener('toggle', () => {
    if (menu.matches(':popover-open')) positionMessageMenu(trigger, menu)
  })
  toolbar.append(trigger, menu)
  const actionButton = (label: string, path: string, action: () => void) => {
    const button = messageButton(label, path, action)
    button.className = 'phone-button qq-message-menu-action'
    button.append(label)
    return button
  }
  const error = document.createElement('small')
  error.className = 'qq-message-error'
  error.setAttribute('role', 'status')
  async function run(action: () => Promise<unknown>, status = error) {
    const buttons = Array.from(menu.querySelectorAll('button')).filter(button => !button.disabled)
    buttons.forEach(button => { button.disabled = true })
    status.textContent = ''
    toolbar.setAttribute('aria-busy', 'true')
    try { await action() }
    catch (failure) { status.textContent = failure instanceof Error ? failure.message : 'The action could not be completed.' }
    finally {
      buttons.forEach(button => { button.disabled = false })
      toolbar.removeAttribute('aria-busy')
    }
  }

  const reply = isReply(message)
  if ((reply || message.role === 'user') && isEditableText(message)) {
    const edit = actionButton(reply ? 'Edit reply' : 'Edit message', icons.edit, () => {
      if (wrapper.classList.contains('qq-editing')) return
      if (menu.matches(':popover-open')) menu.hidePopover()
      const original = document.createDocumentFragment()
      original.append(...content.childNodes)
      wrapper.classList.add('qq-editing')
      const form = document.createElement('form')
      form.className = 'qq-inline-edit'
      const input = document.createElement('textarea')
      input.setAttribute('aria-label', reply ? 'Reply text' : 'Message text')
      input.rows = 3
      input.required = true
      input.value = String(message.content ?? '')
      const originalText = input.value
      const status = document.createElement('p')
      status.className = 'qq-edit-status'
      status.setAttribute('role', 'status')
      const actions = document.createElement('div')
      actions.className = 'qq-inline-edit-actions'
      const close = () => {
        content.replaceChildren(original)
        wrapper.classList.remove('qq-editing')
        trigger.focus({ preventScroll: true })
      }
      const save = messageButton(reply ? 'Save reply' : 'Save message', iconPaths.check, () => {}, 'submit')
      const cancel = messageButton('Cancel', iconPaths.close, close)
      actions.append(cancel, save)
      form.append(input, status, actions)
      form.addEventListener('click', event => event.stopPropagation())
      form.addEventListener('mousedown', event => event.stopPropagation())
      form.addEventListener('touchstart', event => event.stopPropagation(), { passive: true })
      form.addEventListener('keydown', event => {
        if (event.isComposing) return
        if (event.key === 'Escape') { event.preventDefault(); cancel.click() }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          form.requestSubmit()
        }
      })
      form.addEventListener('submit', event => {
        event.preventDefault()
        if (save.disabled) return
        const text = input.value
        if (!text.trim()) {
          status.textContent = 'Enter some text to save this message.'
          input.focus()
          return
        }
        if (text === originalText) { close(); return }
        input.readOnly = true
        save.disabled = true
        cancel.disabled = true
        void run(() => editMessage(chat, message, text), status).finally(() => {
          input.readOnly = false
          save.disabled = false
          cancel.disabled = false
        })
      })
      content.replaceChildren(form)
      form.scrollIntoView({ block: 'nearest' })
      input.setSelectionRange(0, 0)
      input.focus({ preventScroll: true })
    })
    edit.dataset.inlineEdit = ''
    menu.append(edit)
  }
  if (reply && !isEditableText(message)) {
    menu.append(actionButton('Edit reply', icons.edit, () => {
      menu.hidePopover()
      openAdvancedMessageEditor(message.timestamp)
    }))
  }
  const selectDelete = actionButton('Select messages to delete', iconPaths.trash, () => {
    menu.hidePopover()
    enterSelectionMode(message, 'selected')
  })
  menu.append(selectDelete)
  menu.addEventListener('beforetoggle', event => {
    if (event.newState !== 'open' || toolbar.getAttribute('aria-busy') === 'true') return
    menu.querySelector('.qq-message-swipe')?.remove()
    const target = swipeMenuTarget(chat.history, message)
    const turn = target && replyTurn(chat.history, target)
    if (!target || !turn) return
    const { index, variants } = turnVersions(turn)
    const previous = messageButton('Previous reply', icons.previous, () => void run(() => swipeReply(chat, target, -1)))
    previous.disabled = index === 0
    const count = document.createElement('span')
    count.className = 'qq-swipe-count'
    count.textContent = (index + 1) + '/' + variants.length
    const next = messageButton(index + 1 < variants.length ? 'Next reply' : 'Generate alternate reply', icons.next,
      () => void run(() => swipeReply(chat, target, 1)))
    const swipe = document.createElement('div')
    swipe.className = 'qq-message-swipe'
    swipe.append(previous, count, next)
    selectDelete.before(swipe)
  })
  menu.append(actionButton('Branch from this message', icons.branch,
    () => void run(() => changeSession(chat, { type: 'branch', message }))))
  wrapper.classList.add('has-qq-message-tools')
  bubble.append(toolbar)
  wrapper.append(error)
}
