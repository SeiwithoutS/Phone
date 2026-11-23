import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { AppShortcut, BackButton, Screen, ScreenContext, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'
import { ThemeToggle } from '../../components/ThemeToggle'
import type { LocalDatabase } from '../../storage/database'
import { screenActions } from '../../app/actions'
import { applyAppIcons } from '../../legacy/appearance/icons.js'
import { WidgetEditor, WidgetPreview, WidgetTile, widgetTitle } from './HomeWidgets'
import type { HomeWidget } from './HomeWidgets'

const apps = {
  qq: { label: 'QQ', image: 'https://i.postimg.cc/MTC3Tkw8/IMG-6436.jpg', open: () => showScreen('chat-list-screen') },
  'world-info': { label: 'World Info', image: 'https://i.postimg.cc/HWf1JKzn/IMG-6435.jpg', open: () => showScreen('lorebook-screen') },
  wallpaper: { label: 'Appearance', image: 'https://i.postimg.cc/T1j03pQr/IMG-6440.jpg', open: () => showScreen('wallpaper-screen') },
  edit: { label: 'Edit', image: 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1756312261242_qdqqd_g0eriz.jpeg', open: () => showScreen('character-edit-screen') },
  preset: { label: 'Presets', image: 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1758510900942_qdqqd_djw0z2.jpeg', open: screenActions.openPresetScreen },
  tutorial: { label: 'Guide', image: 'https://i.postimg.cc/d10GjC4g/IMG-7302.jpg', open: () => showScreen('tutorial-screen') },
  'world-book': { label: 'Mini Prompts', image: 'https://i.postimg.cc/HWf1JKzn/IMG-6435.jpg', open: () => showScreen('world-book-screen') },
  'api-settings': { label: 'API Connections', image: 'https://i.postimg.cc/MK8rJ8t7/IMG-6438.jpg', open: () => showScreen('api-settings-screen') },
  font: { label: 'Fonts', image: 'https://i.postimg.cc/pXxk1JXk/IMG-6442.jpg', open: () => showScreen('font-settings-screen') },
  'char-phone': { label: 'Cphone', image: 'https://i.postimg.cc/pXj9h20L/IMG-7275.jpg', open: screenActions.openCharacterSelector },
  social: { label: 'Social', image: 'https://i.postimg.cc/Pq2xJN1g/IMG-7301.jpg', open: () => showScreen('social-screen') },
  stickers: { label: 'Stickers', image: '', open: () => showScreen('sticker-library-screen') },
  context: { label: 'Context', image: '', open: () => showScreen('context-screen') },
}

export const launcherIcons = Object.fromEntries(Object.entries(apps).map(([id, app]) => [id, app.image]))

const firstPage = ['qq', 'world-info', 'wallpaper', 'edit'] as const
const secondPage = ['preset', 'tutorial', 'world-book', 'stickers', 'context'] as const
const dockApps = ['api-settings', 'font', 'char-phone', 'social'] as const
const layoutKey = 'home-layout'
type Location = number | 'dock'
type Item = { key: string; title: string; app?: keyof typeof apps; widget?: HomeWidget; initialPage: Location }
type Placement = { key: string; page: Location }
type PointerStart = { id: number; x: number; y: number; key?: string; timer?: number }

const appItems = (ids: readonly (keyof typeof apps)[], initialPage: Location): Item[] =>
  ids.map(id => ({ key: 'app:' + id, title: apps[id].label, app: id, initialPage }))
const defaultApps = [...appItems(firstPage, 0), ...appItems(secondPage, 1), ...appItems(dockApps, 'dock')]

function placement(items: Item[], value: unknown) {
  const saved = Array.isArray(value) ? value as Placement[] : []
  const keys = new Set(items.map(item => item.key))
  const layout: Placement[] = []
  let dockSize = 0
  for (const entry of saved) {
    if (!entry || !keys.has(entry.key)) continue
    if (entry.page === 'dock') {
      if (!entry.key.startsWith('app:') || dockSize >= 4) continue
      dockSize++
    } else if (!Number.isInteger(entry.page) || entry.page < 0 || entry.page > 99) continue
    layout.push({ key: entry.key, page: entry.page })
    keys.delete(entry.key)
  }
  for (const item of items) {
    if (!keys.has(item.key)) continue
    const page = item.initialPage === 'dock' && dockSize++ >= 4 ? 1 : item.initialPage
    layout.push({ key: item.key, page })
  }
  return layout
}

export function HomeScreen({ database }: { database?: LocalDatabase }) {
  const active = useContext(ScreenContext) === 'home-screen'
  const [page, setPage] = useState(0)
  const [emptyPage, setEmptyPage] = useState(0)
  const [savedLayout, setSavedLayout] = useState<unknown>()
  const [widgets, setWidgets] = useState<HomeWidget[]>([])
  const [arranging, setArranging] = useState(false)
  const [selected, setSelected] = useState<string>()
  const [hover, setHover] = useState<string>()
  const [widgetsOpen, setWidgetsOpen] = useState(false)
  const [editing, setEditing] = useState<HomeWidget | 'new'>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const drag = useRef<PointerStart | undefined>(undefined)
  const dragging = useRef<string | undefined>(undefined)
  const suppressClick = useRef(false)

  useEffect(() => {
    if (!database || !active) return
    let current = true
    setSavedLayout(database.getPreference(layoutKey))
    void database.homeWidgets.orderBy('order').toArray().then(rows => {
      if (current) setWidgets(rows as HomeWidget[])
    }).catch(() => { if (current) setError('Widgets could not be loaded.') })
    return () => { current = false }
  }, [active, database])

  useLayoutEffect(() => {
    if (database) applyAppIcons()
  }, [database, savedLayout, widgets, widgetsOpen])

  const items = [...defaultApps, ...widgets.map((widget, index): Item => ({
    key: 'widget:' + widget.id, widget, title: widgetTitle(widget),
    initialPage: Math.min(99, 1 + Math.floor(index / 4)),
  }))]
  const byKey = new Map(items.map(item => [item.key, item]))
  const layout = placement(items, savedLayout)
  const lastPage = Math.max(1, emptyPage, ...layout.map(entry => typeof entry.page === 'number' ? entry.page : 0))
  const currentPage = Math.min(page, lastPage)
  const selectedItem = selected ? byKey.get(selected) : undefined
  const visible = active && !widgetsOpen
  const selectedPlacement = layout.find(entry => entry.key === selected)

  function endArrangement() {
    setArranging(false)
    setSelected(undefined)
    setEmptyPage(0)
  }

  async function changePlacement(key: string, target: Location, before?: string) {
    if (!database || busy || key === before) return
    const current = layout.find(entry => entry.key === key)
    if (!current) return
    let next = layout.filter(entry => entry.key !== key)
    const dockFull = target === 'dock' && next.filter(entry => entry.page === 'dock').length >= 4
    if (target === 'dock' && (byKey.get(key)?.widget || (dockFull && !before))) {
      setError('The dock holds up to four apps.')
      return
    }
    if (dockFull && before) {
      next = layout.map(entry => {
        if (entry.key === key) return { key: before, page: current.page }
        if (entry.key === before) return { key, page: 'dock' }
        return entry
      })
    } else {
      const index = before ? next.findIndex(entry => entry.key === before && entry.page === target) : -1
      next.splice(index < 0 ? next.length : index, 0, { key, page: target })
    }
    setBusy(true)
    setError('')
    try {
      await database.deviceSettings.put({ id: layoutKey, value: next })
      setSavedLayout(next)
      setSelected(undefined)
      if (typeof target === 'number') setPage(target)
    } catch { setError('The home layout could not be saved.') }
    finally { setBusy(false) }
  }

  function pick(item: Item, target: Location) {
    if (arranging) {
      if (selected && selected !== item.key) void changePlacement(selected, target, item.key)
      else setSelected(selected === item.key ? undefined : item.key)
      return
    }
    if (item.app) void apps[item.app].open()
    else if (item.widget) { setWidgetsOpen(true); setEditing(item.widget) }
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || busy) return
    suppressClick.current = false
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-home-item]')
    const key = cell?.dataset.homeItem
    const start: PointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, key }
    if (key && !arranging) start.timer = window.setTimeout(() => {
      dragging.current = key
      suppressClick.current = true
      setArranging(true)
      setSelected(key)
    }, 450)
    drag.current = start
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start || start.id !== event.pointerId) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) {
      clearTimeout(start.timer)
      if (arranging && start.key) {
        dragging.current = start.key
        suppressClick.current = true
        setSelected(start.key)
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-home-item]')
        setHover(target?.dataset.homeItem)
      }
    }
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const start = drag.current
    if (!start || start.id !== event.pointerId) return
    clearTimeout(start.timer)
    const moving = dragging.current
    drag.current = undefined
    dragging.current = undefined
    setHover(undefined)
    if (cancelled) return
    if (moving) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-home-item]')
      const targetKey = target?.dataset.homeItem
      const destination = layout.find(entry => entry.key === targetKey)
      if (destination && destination.key !== moving) void changePlacement(moving, destination.page, destination.key)
      return
    }
    if (arranging) return
    const dx = event.clientX - start.x
    if (Math.abs(dx) < 35 || Math.abs(dx) <= Math.abs(event.clientY - start.y)) return
    suppressClick.current = true
    setPage(Math.max(0, Math.min(lastPage, currentPage + (dx < 0 ? 1 : -1))))
  }

  async function save(widget: HomeWidget) {
    if (!database) return
    await database.homeWidgets.put(widget)
    setWidgets(items => items.some(item => item.id === widget.id)
      ? items.map(item => item.id === widget.id ? widget : item)
      : [...items, widget])
    setEditing(undefined)
  }

  async function remove(widget: HomeWidget) {
    if (!database) return
    await database.homeWidgets.delete(widget.id)
    setWidgets(items => items.filter(item => item.id !== widget.id))
    if (selected === 'widget:' + widget.id) setSelected(undefined)
    setEditing(undefined)
  }

  function renderItems(location: Location) {
    return layout.filter(entry => entry.page === location).map(entry => {
      const item = byKey.get(entry.key)!
      const app = item.app && apps[item.app]
      return <AppShortcut key={item.key} data-home-item={item.key}
        className={'home-tile ' + (item.widget ? 'home-widget-tile ' + item.widget.size : 'home-app-tile') +
          (hover === item.key && selected !== item.key ? ' drop-target' : '')}
        aria-pressed={arranging ? selected === item.key : undefined} aria-label={item.title}
        onContextMenu={event => event.preventDefault()} onClick={() => pick(item, location)}>
        {app ? <>
          <span className="home-icon-art">
            <span aria-hidden="true">{item.app === 'stickers' ? '😊' : app.label[0]}</span>
            <img id={'icon-img-' + item.app} src={app.image || undefined} hidden={!app.image} alt="" draggable={false}
              onError={event => { event.currentTarget.hidden = true }} />
          </span>
          <span className="home-app-label">{app.label}</span>
        </> : item.widget && <WidgetPreview widget={item.widget} active={visible && location === currentPage} />}
      </AppShortcut>
    })
  }

  return <Screen id="home-screen">
    <div className={'home-desktop' + (arranging ? ' arranging' : '')} hidden={widgetsOpen}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => pointerEnd(event)}
      onPointerCancel={event => pointerEnd(event, true)}
      onClickCapture={event => {
        if (!suppressClick.current || event.detail === 0) return
        suppressClick.current = false
        event.stopPropagation()
      }}>
      <div className="home-tools">
        <button className="home-tool" type="button" onClick={() => { setWidgetsOpen(true); setEditing(undefined) }}>Widgets</button>
        <div className="home-tool-group">
          <ThemeToggle />
          <button className="home-tool" type="button" disabled={!database}
            onClick={() => arranging ? endArrangement() : setArranging(true)}>{arranging ? 'Done' : 'Arrange'}</button>
        </div>
      </div>
      <div id="home-screen-pages-container">
        <div id="home-screen-pages" style={{ transform: 'translateX(-' + currentPage * 100 + '%)' }}>
          {Array.from({ length: lastPage + 1 }, (_, index) => <section key={index} className="home-screen-page" inert={index !== currentPage}
            aria-label={'Home screen page ' + (index + 1)}>
            <div className="home-tiles">{renderItems(index)}</div>
          </section>)}
        </div>
      </div>
      {arranging && <div className="home-arrange" role="region" aria-label="Arrange home screen">
        <p>{selectedItem ? 'Moving ' + selectedItem.title : 'Choose an app or widget to move.'}</p>
        <div>
          {selectedItem && <button type="button" className="home-tool" disabled={busy || selectedPlacement?.page === currentPage}
            onClick={() => void changePlacement(selectedItem.key, currentPage)}>Move to this page</button>}
          {selectedItem?.app && selectedPlacement?.page !== 'dock' && <button type="button" className="home-tool" disabled={busy}
            onClick={() => void changePlacement(selectedItem.key, 'dock')}>Move to dock</button>}
          {selectedItem && selectedPlacement?.page === currentPage && <button type="button" className="home-tool" disabled={busy}
            onClick={() => void changePlacement(selectedItem.key, currentPage)}>Move to end</button>}
          <button type="button" className="home-tool" disabled={lastPage >= 99} onClick={() => {
            setEmptyPage(lastPage + 1)
            setPage(lastPage + 1)
          }}>Add page</button>
        </div>
      </div>}
      {error && !widgetsOpen && <p className="home-error" role="alert">{error}</p>}
      <nav id="home-screen-pagination" aria-label="Home screen pages">
        {lastPage < 7 ? Array.from({ length: lastPage + 1 }, (_, index) => <AppShortcut key={index}
          className="pagination-dot" aria-label={'Home page ' + (index + 1)} aria-current={index === currentPage ? 'page' : undefined}
          onClick={() => setPage(index)} />) : <>
          <button type="button" className="home-tool" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span aria-live="polite">{currentPage + 1} / {lastPage + 1}</span>
          <button type="button" className="home-tool" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next</button>
        </>}
      </nav>
      <nav id="desktop-dock" aria-label="Dock">{renderItems('dock')}</nav>
    </div>
    {widgetsOpen && (editing ? <WidgetEditor widget={editing === 'new' ? undefined : editing}
      nextOrder={(widgets.at(-1)?.order ?? 0) + 1} close={() => setEditing(undefined)} save={save} remove={remove} />
      : <div className="widget-editor phone-feature">
        <ScreenHeader className="widget-list-header">
          <BackButton onClick={() => setWidgetsOpen(false)} />
          <span>Widgets</span>
          <button type="button" className="phone-app-button" onClick={() => setEditing('new')}>Add widget</button>
        </ScreenHeader>
        <div className="phone-app-scroll">
          {widgets.length === 0 && <p className="phone-app-muted">Add a widget to your home screen.</p>}
          <div className="launcher-widget-grid">
            {widgets.map(widget => <WidgetTile key={widget.id} widget={widget} active={active} edit={() => setEditing(widget)} />)}
          </div>
        </div>
      </div>)}
  </Screen>
}
