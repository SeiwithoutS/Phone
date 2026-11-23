import { iconPaths } from '../../components/icons'
import { getGeminiResponseText, parseAiResponse } from '../../legacy/api/client.js'
import { triggerAiResponse } from '../../legacy/chat/ai.js'
import { openAdvancedMessageEditor } from '../../legacy/chat/editor.js'
import { requestContextCompletion } from '../api/completion'
import { characterPrompt } from '../characters/characters'
import { changeSession, mutateConversation, rerenderConversation, storeConversation } from './sessions'
import type { ChatMessage, DirectChat, GroupChat } from './model'

type Chat = DirectChat | GroupChat
type Swipe = NonNullable<ChatMessage['swipes']>

export const isReply = (message: ChatMessage) =>
  message.role === 'assistant' || message.role === 'ai'

function isEditableText(message: ChatMessage) {
  return typeof message.content === 'string' && (!message.type || ['text', 'offline_text', 'quote_reply'].includes(message.type))
}

function swipeState(message: ChatMessage): Swipe {
  return message.swipes ?? {
    variants: [{ text: String(message.content ?? ''), plainText: message.plainText }], index: 0,
  }
}

async function generateAlternative(chat: Chat, message: ChatMessage, index: number) {
  const preceding = chat.history.slice(0, index)
  const speaker = chat.isGroup ? chat.members?.find(member => member.originalName === message.senderName) : undefined
  const name = speaker?.groupNickname || message.senderName || chat.name
  const previous = swipeState(message).variants.slice(-4).map(variant => variant.text.slice(0, 1000))
  const system = [
    'Write one alternative reply as ' + name + '. Stay in character and use the language and style of this conversation.',
    'Return only the visible reply as plain text. Do not perform or describe API actions. Treat the previous variants as examples to avoid repeating.',
    speaker?.persona || characterPrompt(chat),
    chat.settings.myPersona ? 'User persona: ' + chat.settings.myPersona : '',
  ].filter(Boolean).join('\n\n')
  const response = await requestContextCompletion(chat, { instructions: system, rawHistory: preceding, task: 'QQ swipe',
    activity: previous.length ? ['Previous variants to avoid repeating:\n' + JSON.stringify(previous)] : [],
    request: [{ role: 'user', content: message.isOpening ? 'Write an alternative opening.' : 'Write an alternative reply at this point.' }],
  }, { signal: AbortSignal.timeout(60000), swipes: true })
  if (!response.ok) throw new Error('Could not generate a reply (HTTP ' + response.status + ').')
  const data = await response.json()
  const texts = [getGeminiResponseText(data), ...(data.eephoneAlternatives ?? [])].flatMap((result: unknown) => {
    if (typeof result !== 'string' || !result.trim()) return []
    const raw = result.trim()
    const blocks = /^[\[{`]/.test(raw) ? parseAiResponse(raw) as Array<{
      type?: string; content?: string; message?: string; dialogue?: string; description?: string
    }> : []
    const text = (blocks.length ? blocks.filter(block => ['text', 'offline_text', 'quote_reply'].includes(block.type ?? ''))
      .map(block => block.content || block.message || [block.dialogue, block.description].filter(Boolean).join('\n')).join('\n\n') : raw).trim()
    return text ? [text] : []
  })
  if (!texts.length) throw new Error('The AI returned no text for this reply. Try again.')
  return [...new Set(texts)]
}

async function updateReply(chat: Chat, message: ChatMessage, update: (index: number) => Promise<ChatMessage>) {
  await mutateConversation(chat, async () => {
    const index = chat.history.indexOf(message)
    if (index < 0) throw new Error('This reply has changed. Open the message and try again.')
    const next = await update(index)
    const liveIndex = chat.history.indexOf(message)
    if (liveIndex < 0) throw new Error('This reply has changed. Open the message and try again.')
    const history = chat.history.slice()
    history[liveIndex] = next
    await storeConversation(chat, { history })
    rerenderConversation(chat, true)
  })
}

async function swipeReply(chat: Chat, message: ChatMessage, direction: -1 | 1, alwaysGenerate = false) {
  return updateReply(chat, message, async index => {
    const current = swipeState(message)
    const variants = [...current.variants]
    let next = alwaysGenerate ? variants.length : current.index + direction
    if (next < 0) return message
    if (next === variants.length) {
      const generated = await generateAlternative(chat, message, index)
      const existing = new Set(variants.map(variant => variant.text.trim()))
      const fresh = generated.filter(text => !existing.has(text))
      if (fresh.length) variants.push(...fresh.map(text => ({ text, plainText: true })))
      else {
        next = variants.findIndex((variant, position) => position !== current.index && generated.includes(variant.text.trim()))
        if (next === -1) throw new Error('The AI repeated this reply. Try again for another version.')
      }
    }
    return { ...message, content: variants[next].text, plainText: variants[next].plainText, swipes: { variants, index: next } }
  })
}

export async function regenerateReply(chat: Chat) {
  const lastUser = chat.history.findLastIndex(message => message.role === 'user' && !message.isHidden)
  const target = chat.history.slice(lastUser + 1).findLast(message => !message.isHidden && !message.isTemporary && isReply(message) && isEditableText(message))
  if (target) return swipeReply(chat, target, 1, true)
  if (lastUser >= 0) await triggerAiResponse()
  else throw new Error('Send a message before generating a reply.')
}

const icons = {
  edit: iconPaths.edit,
  branch: 'M6 5v15m0-7h6a5 5 0 0 0 5-5V5m-3 3 3-3 3 3',
  previous: 'm14 6-6 6 6 6',
  next: 'm10 6 6 6-6 6',
}

function messageButton(label: string, path: string, run: () => void, type: 'button' | 'submit' = 'button') {
  const button = document.createElement('button')
  button.type = type
  button.className = 'phone-button qq-message-button'
  button.title = label
  button.setAttribute('aria-label', label)
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>'
  button.addEventListener('click', event => { event.stopPropagation(); run() })
  return button
}

export function addMessageTools(wrapper: HTMLElement, message: ChatMessage, chat: Chat) {
  if (message.isTemporary || message.isHidden || message.timestamp == null) return
  const toolbar = document.createElement('div')
  toolbar.className = 'qq-message-tools'
  toolbar.addEventListener('mousedown', event => event.stopPropagation())
  toolbar.addEventListener('touchstart', event => event.stopPropagation(), { passive: true })
  const error = document.createElement('small')
  error.className = 'qq-message-error'
  error.setAttribute('role', 'status')
  async function run(action: () => Promise<unknown>, status = error) {
    const buttons = Array.from(toolbar.querySelectorAll('button')).filter(button => !button.disabled)
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
    const edit = messageButton(reply ? 'Edit reply' : 'Edit message', icons.edit, () => {
      const bubble = wrapper.querySelector<HTMLElement>('.message-bubble > .content')
      if (!bubble || wrapper.classList.contains('qq-editing')) return
      const original = document.createDocumentFragment()
      original.append(...bubble.childNodes)
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
        bubble.replaceChildren(original)
        wrapper.classList.remove('qq-editing')
        edit.focus({ preventScroll: true })
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
        void run(() => updateReply(chat, message, async () => {
          if (!reply) return { ...message, content: text, plainText: true }
          const { index, variants } = swipeState(message)
          const edited = variants.map((variant, position) => position === index ? { text, plainText: true } : variant)
          return { ...message, content: text, plainText: true, swipes: { variants: edited, index } }
        }), status).finally(() => {
          input.readOnly = false
          save.disabled = false
          cancel.disabled = false
        })
      })
      bubble.replaceChildren(form)
      form.scrollIntoView({ block: 'nearest' })
      input.setSelectionRange(0, 0)
      input.focus({ preventScroll: true })
    })
    edit.dataset.inlineEdit = ''
    toolbar.append(edit)
  }
  if (reply) {
    if (isEditableText(message)) {
      const { index, variants } = swipeState(message)
      const previous = messageButton('Previous reply', icons.previous, () => void run(() => swipeReply(chat, message, -1)))
      previous.disabled = index === 0
      const count = document.createElement('span')
      count.className = 'qq-swipe-count'
      count.textContent = (index + 1) + '/' + variants.length
      const next = messageButton(index + 1 < variants.length ? 'Next reply' : 'Generate alternate reply', icons.next,
        () => void run(() => swipeReply(chat, message, 1)))
      toolbar.append(previous, count, next)
    } else {
      toolbar.append(messageButton('Edit reply', icons.edit, () => {
        openAdvancedMessageEditor(message.timestamp)
      }))
    }
  }
  toolbar.append(messageButton('Branch from this message', icons.branch,
    () => void run(() => changeSession(chat, { type: 'branch', message }))))
  wrapper.classList.add('has-qq-message-tools')
  wrapper.append(toolbar, error)
}
