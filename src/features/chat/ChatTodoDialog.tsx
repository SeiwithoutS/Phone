import { useLayoutEffect, useRef, useState } from 'react'
import { IconButton } from '../../components/icons'
import { runtime } from '../../legacy/runtime/state.js'

type Task = { id: string; text: string; owner: 'user' | 'character'; done: boolean }

export function ChatTodoDialog({ close }: { close: () => void }) {
  const chatId = runtime.state.activeChatId
  const chat = chatId ? runtime.state.chats[chatId] : undefined
  const [items, setItems] = useState<Task[]>(() => (chat?.chatTasks as Task[] | undefined) || [])
  const [owner, setOwner] = useState<Task['owner']>('user')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function update(next: Task[]) {
    if (!chat || busy) return false
    setBusy(true)
    setError('')
    try {
      await runtime.db.chats.update(chat.id, { chatTasks: next })
      chat.chatTasks = next
      setItems(next)
      return true
    } catch {
      setError('Could not save the to-do list.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const visible = items.filter(item => item.owner === owner)
  return <dialog ref={dialog} className="qq-chat-dialog phone-feature" aria-labelledby="todo-heading"
    onCancel={event => { event.preventDefault(); if (!busy) close() }}
    onClick={event => { if (event.target === event.currentTarget && !busy) close() }}>
    <section className="qq-dialog-body">
      <div className="qq-dialog-header"><IconButton icon="close" label="Close to-do list" disabled={busy} onClick={close} />
        <h2 id="todo-heading">To-do list</h2></div>
      <div className="qq-dialog-content phone-app-stack">
        <div className="chat-tabs" role="group" aria-label="Task owner">
          <button type="button" aria-pressed={owner === 'user'} onClick={() => setOwner('user')}>Me</button>
          <button type="button" aria-pressed={owner === 'character'} onClick={() => setOwner('character')}>{chat?.name || 'Character'}</button>
        </div>
        {visible.length > 0 ? <p className="phone-app-muted">{visible.filter(item => item.done).length} of {visible.length} completed</p> :
          <p className="phone-app-muted">No tasks yet.</p>}
        {visible.map(item => <div className="bank-row" key={item.id}>
          <label className="chat-task-item"><input type="checkbox" checked={item.done} disabled={busy} onChange={event => {
            const done = event.currentTarget.checked
            void update(items.map(task => task.id === item.id ? { ...task, done } : task))
          }} />{item.text}</label>
          <IconButton icon="trash" label={'Remove ' + item.text} disabled={busy} onClick={() =>
            void update(items.filter(task => task.id !== item.id))} />
        </div>)}
        <form className="phone-app-two" onSubmit={async event => {
          event.preventDefault()
          const value = text.trim()
          if (value && await update([...items, { id: crypto.randomUUID(), text: value, done: false, owner }])) setText('')
        }}>
          <input required aria-label="New task" placeholder="New task" value={text} maxLength={200} onChange={event => setText(event.target.value)} />
          <button type="submit" className="phone-app-button primary" disabled={busy || !text.trim()}>Add</button>
        </form>
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  </dialog>
}
