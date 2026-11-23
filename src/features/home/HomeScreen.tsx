import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { AppShortcut, BackButton, Screen, ScreenContext, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'
import { launcherLabels } from '../appearance/launcher-labels'
import { Icon, IconButton } from '../../components/icons'
import { ThemeToggle } from '../../components/ThemeToggle'
import type { LocalDatabase } from '../../storage/database'
import { screenActions } from '../../app/actions'
import { applyAppIcons } from '../../legacy/appearance/icons.js'
import { WidgetEditor, WidgetPreview, WidgetTile, widgetTemplateGroups, widgetTemplates, widgetTitle } from './HomeWidgets'
import type { HomeWidget } from './HomeWidgets'

const apps = {
  qq: { image: 'https://i.postimg.cc/MTC3Tkw8/IMG-6436.jpg', open: () => showScreen('chat-list-screen') },
  'world-info': { image: 'https://i.postimg.cc/HWf1JKzn/IMG-6435.jpg', open: () => showScreen('lorebook-screen') },
  wallpaper: { image: 'https://i.postimg.cc/T1j03pQr/IMG-6440.jpg', open: () => showScreen('wallpaper-screen') },
  edit: { image: 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1756312261242_qdqqd_g0eriz.jpeg', open: () => showScreen('character-edit-screen') },
  preset: { image: 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1758510900942_qdqqd_djw0z2.jpeg', open: screenActions.openPresetScreen },
  tutorial: { image: 'https://i.postimg.cc/d10GjC4g/IMG-7302.jpg', open: () => showScreen('tutorial-screen') },
  'world-book': { image: 'https://i.postimg.cc/HWf1JKzn/IMG-6435.jpg', open: () => showScreen('world-book-screen') },
  'api-settings': { image: 'https://i.postimg.cc/MK8rJ8t7/IMG-6438.jpg', open: () => showScreen('api-settings-screen') },
  font: { image: 'https://i.postimg.cc/pXxk1JXk/IMG-6442.jpg', open: () => showScreen('font-settings-screen') },
  'char-phone': { image: 'https://i.postimg.cc/pXj9h20L/IMG-7275.jpg', open: screenActions.openCharacterSelector },
  social: { image: 'https://i.postimg.cc/Pq2xJN1g/IMG-7301.jpg', open: () => showScreen('social-screen') },
  stickers: { image: '', open: () => showScreen('sticker-library-screen') },
  bank: { image: '', open: () => showScreen('bank-screen') },
  market: { image: '', open: () => showScreen('market-screen') },
  backup: { image: '', open: () => showScreen('backup-screen') },
  context: { image: '', open: () => showScreen('context-screen') },
}

export const launcherIcons = Object.fromEntries(Object.entries(apps).map(([id, app]) => [id, app.image]))

const firstPage = ['qq', 'world-info', 'wallpaper', 'edit'] as const
const secondPage = ['preset', 'tutorial', 'world-book', 'stickers', 'context', 'backup', 'bank', 'market'] as const
const dockApps = ['api-settings', 'font', 'char-phone', 'social'] as const
const layoutKey = 'home-layout'
type Location = number | 'dock'
type Item = { key: string; title: string; app?: keyof typeof apps; widget?: HomeWidget; initialPage: Location }
type Placement = { key: string; page: Location; slot?: number }
type PointerStart = { id: number; x: number; y: number; key?: string; timer?: number }

const appItems = (ids: readonly (keyof typeof apps)[], initialPage: Location): Item[] =>
  ids.map(id => ({ key: 'app:' + id, title: launcherLabels[id], app: id, initialPage }))
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
    const slot = typeof entry.slot === "number" && Number.isInteger(entry.slot) && entry.slot >= 0 && entry.slot < 120 ? entry.slot : undefined
    layout.push({ key: entry.key, page: entry.page, slot })
    keys.delete(entry.key)
  }
  for (const item of items) {
    if (!keys.has(item.key)) continue
    const page = item.initialPage === 'dock' && dockSize++ >= 4 ? 1 : item.initialPage
    layout.push({ key: item.key, page })
  }
  return layout
}


function gridPositions(entries: Placement[], items: Map<string, Item>) {
  const occupied = new Set<number>()
  const positions = new Map<string, { slot: number; span: number }>()
  const width = (entry: Placement) => {
    const size = items.get(entry.key)?.widget?.size
    return size === 'full' ? 4 : size === 'half' ? 2 : 1
  }
  function reserve(entry: Placement, slot: number, span: number) {
    if (slot % 4 + span > 4 || Array.from({ length: span }, (_, offset) => slot + offset).some(cell => occupied.has(cell))) return false
    for (let offset = 0; offset < span; offset++) occupied.add(slot + offset)
    positions.set(entry.key, { slot, span })
    return true
  }
  for (const entry of entries) {
    if (entry.slot !== undefined) reserve(entry, Math.floor(entry.slot / 4) * 4 + Math.min(entry.slot % 4, 4 - width(entry)), width(entry))
  }
  for (const entry of entries) {
    if (positions.has(entry.key)) continue
    let slot = 0
    while (!reserve(entry, slot, width(entry))) slot++
  }
  return positions
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
  const [template, setTemplate] = useState<HomeWidget>()
  const [widgetView, setWidgetView] = useState<'saved' | 'templates'>('templates')
  const [widgetFilter, setWidgetFilter] = useState<'All' | keyof typeof widgetTemplateGroups>('All')
  const visibleTemplates = widgetTemplates.filter(widget => widgetFilter === 'All' ||
    (widgetTemplateGroups[widgetFilter] as readonly string[]).includes(widget.kind))
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
  }, [active, database, savedLayout, widgets, widgetsOpen])

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

  async function changePlacement(key: string, target: Location, before?: string, slot?: number) {
    if (!database || busy || key === before) return
    const current = layout.find(entry => entry.key === key)
    if (!current) return
    let next = layout.filter(entry => entry.key !== key)
    const source = typeof current.page === 'number'
      ? gridPositions(layout.filter(entry => entry.page === current.page), byKey).get(key)
      : undefined
    const targetPositions = typeof target === 'number'
      ? gridPositions(layout.filter(entry => entry.page === target), byKey)
      : undefined
    const destination = before ? targetPositions?.get(before) : undefined
    const targetSlot = slot ?? destination?.slot
    const dockFull = target === 'dock' && next.filter(entry => entry.page === 'dock').length >= 4
    if (target === 'dock' && (byKey.get(key)?.widget || (dockFull && !before))) {
      setError('The dock holds up to four apps.')
      return
    }
    if (typeof target === 'number' && targetSlot !== undefined) {
      if (before && source && source.span === destination?.span) {
        next = next.filter(entry => entry.key !== before)
        next.unshift({ key: before, page: current.page, slot: source.slot })
      }
      next.unshift({ key, page: target, slot: targetSlot })
    } else if (typeof target === 'number' && current.page === target && source && targetPositions) {
      const end = Math.max(0, ...[...targetPositions].filter(([id]) => id !== key).map(([, position]) => position.slot + position.span))
      const slot = end % 4 + source.span > 4 ? Math.ceil(end / 4) * 4 : end
      next.push({ key, page: target, slot: slot < 120 ? slot : undefined })
    } else if (dockFull && before) {
      next = layout.map(entry => {
        if (entry.key === key) return { key: before, page: current.page, slot: source?.slot }
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
        event.currentTarget.setPointerCapture(event.pointerId)
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
      const hit = document.elementFromPoint(event.clientX, event.clientY)
      const target = hit?.closest<HTMLElement>('[data-home-item]')
      const targetKey = target?.dataset.homeItem
      const destination = layout.find(entry => entry.key === targetKey)
      if (destination && destination.key !== moving) {
        void changePlacement(moving, destination.page, destination.key)
      } else if (!destination) {
        const grid = hit?.closest<HTMLElement>('[data-home-grid]')
        if (grid) {
          const bounds = grid.getBoundingClientRect()
          const styles = getComputedStyle(grid)
          const pitch = Number.parseFloat(styles.gridAutoRows) + Number.parseFloat(styles.rowGap)
          const row = Math.min(29, Math.max(0, Math.floor((event.clientY - bounds.top) / pitch)))
          const column = Math.max(0, Math.min(3, Math.floor((event.clientX - bounds.left) / (bounds.width / 4))))
          void changePlacement(moving, Number(grid.dataset.homeGrid), undefined, row * 4 + column)
        } else if (hit?.closest('#desktop-dock')) void changePlacement(moving, 'dock')
      }
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
    setTemplate(undefined)
    setWidgetView('saved')
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
    const entries = layout.filter(entry => entry.page === location)
    const positions = location === 'dock' ? undefined : gridPositions(entries, byKey)
    if (positions) entries.sort((a, b) => positions.get(a.key)!.slot - positions.get(b.key)!.slot)
    return entries.map(entry => {
      const position = positions?.get(entry.key)
      const item = byKey.get(entry.key)!
      const app = item.app && apps[item.app]
      return <AppShortcut key={item.key} data-home-item={item.key}
        className={'home-tile ' + (item.widget ? 'home-widget-tile ' + item.widget.size : 'home-app-tile') +
          (hover === item.key && selected !== item.key ? ' drop-target' : '')}
        style={position ? { gridColumn: (position.slot % 4 + 1) + " / span " + position.span, gridRow: Math.floor(position.slot / 4) + 1 } : undefined}
        aria-pressed={arranging ? selected === item.key : undefined} aria-label={item.title}
        onContextMenu={event => event.preventDefault()} onClick={() => pick(item, location)}>
        {app ? <>
          <span className="home-icon-art">
            {item.app === "bank" ? <Icon name="bank" /> : item.app === "market" ? <Icon name="bag" /> : item.app === "backup" ? <Icon name="download" /> : <span aria-hidden="true" data-app-initial>{item.title[0]}</span>}
            <img id={'icon-img-' + item.app} src={app.image || undefined} hidden={!app.image} alt="" draggable={false}
              onError={event => { event.currentTarget.hidden = true }} />
          </span>
          <span className="home-app-label">{item.title}</span>
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
        <IconButton icon="stack" label="Widgets" className="home-tool" onClick={() => { setWidgetsOpen(true); setEditing(undefined) }} />
        <div className="home-tool-group">
          <ThemeToggle />
          <IconButton icon={arranging ? 'check' : 'edit'} label={arranging ? 'Done arranging' : 'Arrange'} className="home-tool" disabled={!database}
            onClick={() => arranging ? endArrangement() : setArranging(true)} />
        </div>
      </div>
      <div id="home-screen-pages-container">
        <div id="home-screen-pages" style={{ transform: 'translateX(-' + currentPage * 100 + '%)' }}>
          {Array.from({ length: lastPage + 1 }, (_, index) => <section key={index} className="home-screen-page" inert={index !== currentPage}
            aria-label={'Home screen page ' + (index + 1)}>
            <div className="home-tiles" data-home-grid={index}>{renderItems(index)}</div>
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
    {widgetsOpen && (editing ? <WidgetEditor widget={editing === 'new' ? undefined : editing} template={template}
      nextOrder={(widgets.at(-1)?.order ?? 0) + 1} close={() => { setEditing(undefined); setTemplate(undefined) }} save={save} remove={remove} />
      : <div className="widget-editor phone-feature">
        <ScreenHeader className="widget-list-header">
          <BackButton onClick={() => setWidgetsOpen(false)} />
          <span>Widgets</span>
          <IconButton icon="plus" label="Add widget" onClick={() => { setTemplate(undefined); setEditing('new') }} />
        </ScreenHeader>
        <div className="chat-tabs" role="group" aria-label="Widget categories">
          <button type="button" aria-pressed={widgetView === 'saved'} onClick={() => setWidgetView('saved')}>My widgets</button>
          <button type="button" aria-pressed={widgetView === 'templates'} onClick={() => setWidgetView('templates')}>Templates</button>
        </div>
        <div className="phone-app-scroll">
          {widgetView === 'templates' ? <>
            <div className="widget-filters" role="group" aria-label="Filter widget templates">
              {(['All', 'Photos', 'Notes', 'Time'] as const).map(group => <button key={group} type="button"
                aria-pressed={widgetFilter === group} onClick={() => setWidgetFilter(group)}>{group}</button>)}
            </div>
            <div className="widget-templates">
              {visibleTemplates.map(widget => <button key={widget.id} type="button" className="widget-template" onClick={() => {
                setTemplate(widget)
                setEditing('new')
              }} aria-label={'Use ' + widgetTitle(widget) + ' template'}>
                <WidgetPreview widget={widget} active={active} /><span>{widgetTitle(widget)}</span>
              </button>)}
            </div>
          </> : <>
          {widgets.length === 0 && <p className="phone-app-muted">Add a widget to your home screen.</p>}
          <div className="launcher-widget-grid">
            {widgets.map(widget => <WidgetTile key={widget.id} widget={widget} active={active} edit={() => setEditing(widget)} />)}
          </div>
          </>}
        </div>
      </div>)}
  </Screen>
}
