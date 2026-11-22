import { BackButton, Screen, ScreenHeader } from '../../components/phone'

export function LongTermMemoryScreen() {
  return (
    <Screen id="long-term-memory-screen">
      <ScreenHeader>
        {" "}
        <BackButton id="memory-screen-back-btn" />
        {" "}
        <span>Long-Term Memory</span>
        <div className="header-actions">
          {" "}
          <span className="action-btn" id="refine-memory-btn-header">Refine</span>
          {" "}
          <span className="action-btn" id="summarize-recent-btn-header">Summarize</span>
          {" "}
          <span className="action-btn" id="add-manual-memory-btn-header">+</span>
          {" "}
        </div>
      </ScreenHeader>
      <div className="list-container" id="memory-list-container" style={{ padding: "15px", display: "flex", flexDirection: "column", gap: "15px", backgroundColor: "#f0f2f5" }}>{" "}</div>
    </Screen>
  )
}
