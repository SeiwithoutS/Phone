import { useState } from 'react'
import { CollectionLayoutButton } from '../../components/PromptEntryList'
import { Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'
import { IconButton } from '../../components/icons'

export function WorldBookScreen() {
  const [grid, setGrid] = useState(false)
  return (
    <Screen id="world-book-screen" aria-labelledby="mini-prompts-title" className="prompt-collection-screen" data-grid={grid}>
      <ScreenHeader className="mini-prompts-header">
        <IconButton icon="back" label="Back" onClick={() => showScreen('home-screen')} />
        <h1 id="mini-prompts-title">Mini Prompts</h1>
        <div className="mini-prompts-tools" role="group" aria-label="Mini Prompts tools">
          <CollectionLayoutButton grid={grid} change={() => setGrid(!grid)} />
          <IconButton icon="import" label="Import Mini Prompts" id="import-world-book-btn" />
          <IconButton icon="export" label="Export all Mini Prompts" id="export-world-book-btn" />
          <IconButton icon="plus" label="Create Mini Prompts" id="add-world-book-btn" />
        </div>
      </ScreenHeader>
      <div id="world-book-content-container" className="prompt-collection-cards prompt-collection-scroll" data-grid={grid} />
    </Screen>
  )
}
