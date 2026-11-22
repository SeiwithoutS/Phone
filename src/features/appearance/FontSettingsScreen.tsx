import { BackButton, FormField, Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function FontSettingsScreen() {
  return (
    <Screen id="font-settings-screen">
      <ScreenHeader>
        {" "}
        <BackButton onClick={() => showScreen("home-screen")} />
        {" "}
        <span>Font Settings</span>
        {" "}
        <span style={{ width: "30px" }} />
        {" "}
      </ScreenHeader>
      <div className="form-container">
        <h3 style={{ marginTop: "0", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Font Presets</h3>
        <div className="form-group">
          {" "}
          <label htmlFor="font-preset-select">Select a preset</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {" "}
            <select id="font-preset-select" style={{ flexGrow: "1" }} />
            {" "}
            <button id="save-font-preset-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px" }} type="button">Save</button>
            {" "}
            <button id="delete-font-preset-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px", backgroundColor: "#ffebee", color: "#d32f2f", borderColor: "#ffcdd2" }} type="button">Delete</button>
            {" "}
          </div>
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <FormField id="font-url-input" label="Font URL (.ttf, .otf, .woff)">
          <input type="text" id="font-url-input" placeholder="https://..../font.ttf" />
        </FormField>
        <div className="form-group">
          {" "}
          <label>Live Preview</label>
          <div id="font-preview">
            <p style={{ fontSize: "20px", margin: "0 0 10px 0" }}>Hello World</p>
            <p style={{ margin: "0" }}>Sample text and numbers 12345.</p>
          </div>
        </div>
        {" "}
        <button className="form-button" id="save-font-btn" type="button">Save and Apply</button>
        {" "}
        <button className="form-button form-button-secondary" id="reset-font-btn" type="button">Restore Default Font</button>
      </div>
    </Screen>
  )
}
