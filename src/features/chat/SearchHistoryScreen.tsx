import { PhoneFeatureHeader, Screen } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function SearchHistoryScreen() {
  return (
    <Screen id="search-history-screen" className="phone-feature">
      <PhoneFeatureHeader title="Search Chat History" onBack={() => showScreen('chat-settings-screen')} />
      <div id="search-bar" style={{ padding: "10px 15px", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--secondary-bg)", flexShrink: "0" }}>
        <div className="chat-search-fields">
          {" "}
          <input type="search" id="keyword-search-input" aria-label="Keyword" placeholder="Enter a keyword…" />
          {" "}
          <input type="date" id="date-search-input" aria-label="Message date" />
          {" "}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {" "}
          <button id="execute-search-btn" className="form-button" style={{ marginTop: "0", flexGrow: "1" }} type="button">Search</button>
          {" "}
          <button id="clear-search-btn" className="form-button form-button-secondary" style={{ marginTop: "0", flexGrow: "1" }} type="button">Reset</button>
          {" "}
        </div>
      </div>
      <div id="chat-search-results-list" className="list-container" style={{ padding: "15px", display: "flex", flexDirection: "column", gap: "15px" }}>{" "}</div>
    </Screen>
  )
}
