import { BackButton, Dialog, FormField, Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function PresetActionsModal() {
  return (
    <Dialog id="preset-actions-modal">
      <div style={{ width: "250px" }} className=" custom-modal-card">
        <div className="custom-modal-footer">
          {" "}
          <button id="preset-action-edit" type="button">Edit Preset</button>
          {" "}
          <button id="preset-action-delete" className="btn-danger" type="button">Delete Preset</button>
          {" "}
          <button id="preset-action-cancel" style={{ marginTop: "8px", borderRadius: "8px", backgroundColor: "#f0f0f0" }} type="button">Cancel</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function PresetEditorScreen() {
  return (
    <Screen id="preset-editor-screen">
      <ScreenHeader>
        {" "}
        <BackButton onClick={() => showScreen("preset-screen")} />
        {" "}
        <span id="preset-editor-title">Edit Preset</span>
        {" "}
        <span className="save-btn" id="save-preset-btn">Save</span>
        {" "}
      </ScreenHeader>
      <div className="form-container">
        <FormField id="preset-name-input" label="Preset Name">
          <input type="text" id="preset-name-input" placeholder={"Enter a preset name…"} />
        </FormField>
        <FormField id="preset-category-select" label="Category">
          <select id="preset-category-select" />
        </FormField>
        <div className="form-group" style={{ flexGrow: "1", display: "flex", flexDirection: "column" }}>
          {" "}
          <label>Entries</label>
          <div id="preset-entries-container" style={{ display: "flex", flexDirection: "column", gap: "15px", overflowY: "auto", padding: "5px", flexGrow: "1" }}>{" "}</div>
        </div>
        {" "}
        <button type="button" id="add-preset-entry-btn" className="form-button form-button-secondary">{" + Add Entry "}</button>
      </div>
    </Screen>
  )
}

export function PresetScreen() {
  return (
    <Screen id="preset-screen">
      <ScreenHeader>
        {" "}
        <BackButton onClick={() => showScreen("home-screen")} />
        {" "}
        <span>Presets</span>
        <div className="header-actions">
          {" "}
          <span className="action-btn" id="import-preset-btn" title="Import Preset">
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {" "}
          </span>
          {" "}
          <span className="action-btn" id="manage-preset-categories-btn" title="Manage Categories">
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            {" "}
          </span>
          {" "}
          <span className="action-btn" id="add-preset-btn">+</span>
          {" "}
        </div>
      </ScreenHeader>
      <div id="preset-tabs" />
      <div id="preset-content-container" />
    </Screen>
  )
}
