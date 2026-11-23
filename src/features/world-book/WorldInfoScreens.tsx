import { BackButton, Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function WorldBookScreen() {
  return (
    <Screen id="world-book-screen">
      <ScreenHeader className="mini-prompts-header">
        <BackButton onClick={() => showScreen('home-screen')} />
        <span>Mini Prompts</span>
        <button type="button" className="phone-app-button primary" id="add-world-book-btn" aria-label="Create Mini Prompts">+ New prompt</button>
      </ScreenHeader>
      <div className="mini-prompts-tools" role="group" aria-label="Mini Prompt tools">
        <button type="button" className="phone-app-button compact" id="import-world-book-btn">Import</button>
        <button type="button" className="phone-app-button compact" id="export-world-book-btn">Export</button>
        <button type="button" className="phone-app-button compact" id="manage-world-book-categories-btn">Categories</button>
      </div>
      <div id="world-book-tabs" />
      <div id="world-book-content-container" />
    </Screen>
  )
}
