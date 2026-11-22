import { BackButton, Screen, ScreenHeader } from '../../components/phone'

export function SearchHistoryScreen() {
  return (
    <Screen id="search-history-screen">
      <ScreenHeader>
        {" "}
        <BackButton id="search-history-back-btn" />
        {" "}
        <span>Search Chat History</span>
        {" "}
        <span style={{ width: "30px" }} />
        {" "}
      </ScreenHeader>
      <div id="search-bar" style={{ padding: "10px 15px", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--secondary-bg)", flexShrink: "0" }}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          {" "}
          <input type="search" id="keyword-search-input" placeholder={"Enter a keyword…"} style={{ flexGrow: "1", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "16px" }} />
          {" "}
          <input type="date" id="date-search-input" style={{ padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "16px" }} />
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
