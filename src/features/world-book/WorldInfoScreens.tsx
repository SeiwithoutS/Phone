import { Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'
import { IconButton } from '../../components/icons'

export function WorldBookScreen() {
  return (
    <Screen id="world-book-screen" aria-labelledby="mini-prompts-title">
      <ScreenHeader className="mini-prompts-header">
        <IconButton icon="back" label="Back" onClick={() => showScreen('home-screen')} />
        <h1 id="mini-prompts-title">Mini Prompts</h1>
        <div className="mini-prompts-tools" role="group" aria-label="Mini Prompts tools">
          <IconButton icon="upload" label="Import Mini Prompts" id="import-world-book-btn" />
          <IconButton icon="download" label="Export Mini Prompts" id="export-world-book-btn" />
          <IconButton icon="folder" label="Categories" id="manage-world-book-categories-btn" />
          <IconButton icon="plus" label="Create Mini Prompts" id="add-world-book-btn" />
        </div>
      </ScreenHeader>
      <div id="world-book-tabs" />
      <div id="world-book-content-container" />
    </Screen>
  )
}
