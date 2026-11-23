import { IconButton } from '../../components/icons'
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
        <IconButton icon="check" id="save-preset-btn" label="Save preset" />
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
          <IconButton icon="upload" id="import-preset-btn" label="Import preset" />
          {" "}
          <IconButton icon="folder" id="manage-preset-categories-btn" label="Manage preset categories" />
          {" "}
          <IconButton icon="plus" id="add-preset-btn" label="Add preset" />
          {" "}
        </div>
      </ScreenHeader>
      <div id="preset-tabs" />
      <div id="preset-content-container" />
    </Screen>
  )
}
