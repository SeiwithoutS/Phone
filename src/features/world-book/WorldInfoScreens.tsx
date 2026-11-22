import { BackButton, Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function WorldBookScreen() {
  return (
    <Screen id="world-book-screen">
      <ScreenHeader>
        <div className="header-left-actions">
          <BackButton onClick={() => showScreen("home-screen")} />
          <button type="button" className="phone-button action-btn" id="import-world-book-btn" title="Import World Info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
          <button type="button" className="phone-button action-btn" id="export-world-book-btn" title="Export World Info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

        </div>

        <span>World Info</span>
        <div className="header-actions">
          <button type="button" className="phone-button action-btn" id="manage-world-book-categories-btn" title="Manage Categories">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </button>
          <button type="button" className="phone-button action-btn" id="add-world-book-btn" aria-label="Create World Info">+</button>

        </div>
      </ScreenHeader>
      <div id="world-book-tabs" />
      <div id="world-book-content-container" />
    </Screen>
  )
}
