import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { Icon, IconButton } from './icons'

type EntryRow = { id: string; title: string; enabled: boolean; detail?: string; marker?: boolean }

export function PromptEntryList({ rows, move, toggle, fields, openNew, showTokens = false }: {
  rows: EntryRow[]; move: (from: number, to: number) => void; toggle: (id: string) => void
  fields: (id: string) => ReactNode; openNew?: string; showTokens?: boolean
}) {
  const [opened, setOpened] = useState<{ id?: string; newId?: string }>({})
  const [dragging, setDragging] = useState<number>()
  const [target, setTarget] = useState<number>()
  const [announcement, setAnnouncement] = useState('')
  const list = useRef<HTMLOListElement>(null)
  const drag = useRef<{ index: number; target: number; pointer: number; y: number; time: number; started: boolean } | undefined>(undefined)
  const active = opened.newId === openNew ? opened.id : openNew
  useEffect(() => {
    if (!openNew) return
    const row = [...(list.current?.children ?? [])].find(item => (item as HTMLElement).dataset.entryId === openNew)
    row?.scrollIntoView({ block: 'nearest' })
  }, [openNew])

  function reorder(from: number, to: number) {
    if (to === from || to < 0 || to >= rows.length) return
    move(from, to)
    setAnnouncement(rows[from].title + ' moved to position ' + (to + 1) + '.')
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>, index: number) {
    if (!event.isPrimary || event.button !== 0 || rows.length < 2) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { index, target: index, pointer: event.pointerId, y: event.clientY, time: Date.now(), started: false }
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current || event.pointerId !== current.pointer) return
    if (!current.started && (Math.abs(event.clientY - current.y) < 6 || (event.pointerType === 'touch' && Date.now() - current.time < 140))) return
    current.started = true
    setDragging(current.index)
    const scroll = list.current?.closest<HTMLElement>('.form-container, .phone-app-scroll')
    if (scroll) {
      const bounds = scroll.getBoundingClientRect()
      if (event.clientY > bounds.bottom - 35) scroll.scrollTop += 24
      else if (event.clientY < bounds.top + 35) scroll.scrollTop -= 24
    }
    const row = [...(list.current?.children ?? [])].find(element => {
      const bounds = element.getBoundingClientRect()
      return event.clientY >= bounds.top && event.clientY <= bounds.bottom + 6
    })
    if (row instanceof HTMLElement) {
      current.target = Number(row.dataset.entryIndex)
      setTarget(current.target)
    }
  }

  function stop(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    const current = drag.current
    if (!current || event.pointerId !== current.pointer) return
    drag.current = undefined
    setDragging(undefined)
    setTarget(undefined)
    if (commit && current.started) reorder(current.index, current.target)
  }

  return <>
    <div className="prompt-entry-heading"><strong>Entries</strong><small>Hold and drag to reorder</small>{showTokens && <small>Est. tokens</small>}</div>
    <ol ref={list} className="prompt-entry-list">
      {rows.map((row, index) => {
        const expanded = active === row.id
        return <li key={row.id} data-entry-id={row.id} data-entry-index={index} data-enabled={row.enabled}
          data-dragging={dragging === index} data-drop={target === index && dragging !== index}>
          <div className="prompt-entry-row">
            <button className="ui-icon-button prompt-drag" type="button" title="Hold and drag, or use the up and down arrows"
              aria-label={'Reorder ' + row.title} disabled={rows.length < 2}
              onPointerDown={event => pointerDown(event, index)} onPointerMove={pointerMove}
              onPointerUp={event => stop(event, true)} onPointerCancel={event => stop(event, false)}
              onLostPointerCapture={event => stop(event, false)} onKeyDown={event => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                event.preventDefault()
                reorder(index, index + (event.key === 'ArrowUp' ? -1 : 1))
              }}><Icon name="drag" /></button>
            <button type="button" className="prompt-entry-title" aria-expanded={expanded}
              onClick={() => setOpened({ id: expanded ? undefined : row.id, newId: openNew })}>
              <Icon name={row.marker ? 'pin' : 'book'} /><span>{row.title}</span><Icon name={expanded ? 'close' : 'edit'} />
            </button>
            <label className="toggle-switch prompt-entry-switch">
              <input type="checkbox" role="switch" aria-label={'Include ' + row.title} checked={row.enabled} onChange={() => toggle(row.id)} />
              <span className="slider" />
            </label>
            {row.detail && <small className="prompt-entry-detail">{row.detail}</small>}
          </div>
          <div className="prompt-entry-fields phone-app-stack" hidden={!expanded}>{fields(row.id)}</div>
        </li>
      })}
    </ol>
    {!rows.length && <p className="phone-app-muted">Add an entry to get started.</p>}
    <span className="sr-only" role="status">{announcement}</span>
  </>
}

export function movePromptEntry<T>(entries: T[], from: number, to: number) {
  const reordered = [...entries]
  reordered.splice(to, 0, ...reordered.splice(from, 1))
  return reordered
}

export function CollectionLayoutButton({ grid, change }: { grid: boolean; change: () => void }) {
  return <IconButton icon={grid ? 'list' : 'grid'} label={grid ? 'Switch to list view' : 'Switch to grid view'} onClick={change} />
}
