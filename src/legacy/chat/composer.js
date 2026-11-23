import { sessionChanging } from '../../features/chat/sessions'
import { playSilentAudio } from '../calls/audio.js'
import { triggerAiResponse } from './ai.js'
import { cancelReplyMode, handleUserPat } from './attachments.js'
import { appendMessage } from './conversation.js'
import { renderChatList } from './list.js'
import { controls, runtime } from '../runtime/state.js'

export function bindChatComposer() {
  const input = document.getElementById('chat-input')
  const send = document.getElementById('send-btn')
  controls.chatInput = input

  send.addEventListener('click', () => {
    playSilentAudio()
    const content = input.value.trim()
    const chatId = runtime.state.activeChatId
    if (!content || !chatId || sessionChanging(chatId)) return

    const chat = runtime.state.chats[chatId]
    if (!chat) return
    const message = { role: 'user', content, timestamp: Date.now() }
    if (runtime.currentReplyContext) message.quote = runtime.currentReplyContext

    appendMessage(message, chat)
    chat.history.push(message)
    // The database emits a storage error event if the save fails.
    void runtime.db.chats.put(chat).then(renderChatList).catch(() => {})
    input.value = ''
    input.style.height = 'auto'
    input.focus()
    cancelReplyMode()
  })

  document.getElementById('wait-reply-btn').addEventListener('click', triggerAiResponse)
  document.getElementById('pat-btn').addEventListener('click', () => {
    const chat = runtime.state.chats[runtime.state.activeChatId]
    if (chat && !chat.isGroup) void handleUserPat(chat.id, chat.originalName)
  })
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
    event.preventDefault()
    send.click()
  })
  bindGroupMentions(input)
}

function bindGroupMentions(input) {
  const popup = document.getElementById('chat-at-mention-popup')
  const hide = () => { popup.style.display = 'none' }

  input.addEventListener('input', () => {
    const chat = runtime.state.chats[runtime.state.activeChatId]
    const value = input.value
    const match = value.match(/@([\p{L}\w]*)$/u)
    popup.replaceChildren()
    if (!chat?.isGroup || !match) {
      hide()
      return
    }

    const search = match[1].toLowerCase()
    const ownName = chat.settings.myNickname
    for (const member of chat.members ?? []) {
      const name = member.groupNickname
      if (!name || name === ownName || !name.toLowerCase().includes(search)) continue
      const item = document.createElement('div')
      item.className = 'at-mention-item'
      item.textContent = name
      item.addEventListener('mousedown', event => {
        event.preventDefault()
        input.value = value.slice(0, match.index) + '@' + name + ' '
        hide()
        input.focus()
      })
      popup.appendChild(item)
    }
    popup.style.display = popup.childElementCount ? 'block' : 'none'
  })

  input.addEventListener('blur', () => { setTimeout(hide, 200) })
}
