import { BackButton, FilePicker, Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function WallpaperScreen() {
  return (
    <Screen id="wallpaper-screen">
      <ScreenHeader>
        {" "}
        <BackButton onClick={() => showScreen("home-screen")} />
        {" "}
        <span>Appearance</span>
        {" "}
        <span style={{ width: "30px" }} />
        {" "}
      </ScreenHeader>
      <div className="form-container">
        {" "}
        <label style={{ fontWeight: "500", color: "var(--text-secondary)" }}>EPhone Home Wallpaper</label>
        <div id="wallpaper-preview">Upload an image below</div>
        <div className="bg-upload-container">
          {" "}
          <button className="form-button-secondary" onClick={() => document.getElementById("wallpaper-upload-input")?.click()} type="button">Local Upload</button>
          {" "}
          <button id="upload-ephone-bg-url-btn" className="form-button-secondary" type="button">Image URL</button>
          {" "}
          <button id="remove-ephone-bg-btn" className="form-button-secondary" type="button">Remove Wallpaper</button>
          {" "}
        </div>
        {" "}
        <FilePicker id="wallpaper-upload-input" accept="image/*" />
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        {" "}
        <label style={{ fontWeight: "500", color: "var(--text-secondary)" }}>Character Phone Wallpaper</label>
        <div id="cphone-wallpaper-preview">Upload an image below</div>
        <div className="bg-upload-container">
          {" "}
          <button className="form-button-secondary" onClick={() => document.getElementById("cphone-wallpaper-upload-input")?.click()} type="button">Local Upload</button>
          {" "}
          <button id="upload-cphone-bg-url-btn" className="form-button-secondary" type="button">Image URL</button>
          {" "}
          <button id="remove-cphone-bg-btn" className="form-button-secondary" type="button">Remove Wallpaper</button>
          {" "}
        </div>
        {" "}
        <FilePicker id="cphone-wallpaper-upload-input" accept="image/*" />
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        {" "}
        <label style={{ fontWeight: "500", color: "var(--text-secondary)" }}>Default Chat Background</label>
        <div id="global-bg-preview" className="wallpaper-preview" style={{ height: "160px", width: "90px" }}>Upload an image below</div>
        <div className="bg-upload-container">
          {" "}
          <button className="form-button-secondary" onClick={() => document.getElementById("global-bg-input")?.click()} type="button">Local Upload</button>
          {" "}
          <button id="upload-global-bg-url-btn" className="form-button-secondary" type="button">Image URL</button>
          {" "}
          <button id="remove-global-bg-btn" className="form-button-secondary" type="button">Remove Global Background</button>
          {" "}
        </div>
        {" "}
        <FilePicker id="global-bg-input" accept="image/*" />
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {" "}
          <label htmlFor="theme-toggle-switch" style={{ marginBottom: "0" }}>Dark Mode</label>
          {" "}
          <label className="toggle-switch">
            {" "}
            <input type="checkbox" id="theme-toggle-switch" />
            {" "}
            <span className="slider" />
          </label>
          {" "}
        </div>
        <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {" "}
          <label htmlFor="status-bar-toggle-switch" style={{ marginBottom: "0" }}>Show Status Bar</label>
          {" "}
          <label className="toggle-switch">
            {" "}
            <input type="checkbox" id="status-bar-toggle-switch" />
            {" "}
            <span className="slider" />
            {" "}
          </label>
          {" "}
        </div>
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <div style={{ width: "100%", textAlign: "left", marginBottom: "15px" }}>
          {" "}
          <label style={{ fontWeight: "500", color: "var(--text-secondary)" }}>Message Notification Sound</label>
          {" "}
        </div>
        <div className="form-group" style={{ width: "100%" }}>
          {" "}
          <label htmlFor="notification-sound-url-input">Sound file URL (.mp3, .wav, .ogg)</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "8px" }}>
            {" "}
            <input type="text" id="notification-sound-url-input" placeholder="Leave blank to use the default sound" style={{ flexGrow: "1" }} />
            {" "}
            <button id="test-sound-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px" }} type="button">{"▶"}</button>
            <button id="reset-sound-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px" }} type="button">Reset</button>
            {" "}
          </div>
        </div>
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <div style={{ width: "100%", textAlign: "left", marginBottom: "15px" }}>
          {" "}
          <label style={{ fontWeight: "500", color: "var(--text-secondary)" }}>EPhone App Icons</label>
          {" "}
        </div>
        <div id="icon-settings-grid" />
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <div className="form-group" style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            {" "}
            <label>Chat Toolbar Order</label>
            {" "}
            <button id="reset-button-order-btn" title="Restore Default Order" className="form-button-secondary" style={{ margin: "0", padding: "4px 12px", fontSize: "13px" }} type="button" aria-label="Restore Default Order">Reset Order</button>
            {" "}
          </div>
          <p style={{ fontSize: "12px", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" Drag the buttons below to reorder them. Changes are saved automatically. "}</p>
          <div id="button-order-editor" style={{ display: "flex", flexWrap: "wrap", gap: "10px", padding: "10px", backgroundColor: "#f0f2f5", borderRadius: "8px", border: "1px solid var(--border-color)" }}>{" "}</div>
        </div>
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <div style={{ width: "100%", textAlign: "left", marginBottom: "15px" }}>
          {" "}
          <label style={{ fontWeight: "500", color: "var(--text-secondary)" }}>Character Phone App Icons</label>
          {" "}
        </div>
        <div id="cphone-icon-settings-grid" />
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <h3 style={{ marginTop: "0", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", width: "100%", textAlign: "left" }}>Appearance Presets</h3>
        <p style={{ fontSize: "12px", color: "#8a8a8a", marginTop: "-5px", lineHeight: "1.5", width: "100%", textAlign: "left" }}>{" Save or load wallpaper, icons, toolbar order, and theme."}</p>
        <div className="form-group" style={{ width: "100%" }}>
          {" "}
          <label htmlFor="appearance-preset-select">Select a preset</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {" "}
            <select id="appearance-preset-select" style={{ flexGrow: "1" }} />
            {" "}
            <button id="save-appearance-preset-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px" }} type="button">Save</button>
            {" "}
            <button id="delete-appearance-preset-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px", backgroundColor: "#ffebee", color: "#d32f2f", borderColor: "#ffcdd2" }} type="button">Delete</button>
            {" "}
          </div>
        </div>
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <h3 style={{ marginTop: "0", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", width: "100%", textAlign: "left" }}>CSS Presets</h3>
        <div className="form-group" style={{ width: "100%" }}>
          {" "}
          <label htmlFor="css-preset-select">Select a preset</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {" "}
            <select id="css-preset-select" style={{ flexGrow: "1" }} />
            {" "}
            <button id="save-css-preset-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px" }} type="button">Save</button>
            {" "}
            <button id="delete-css-preset-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px", backgroundColor: "#ffebee", color: "#d32f2f", borderColor: "#ffcdd2" }} type="button">Delete</button>
            {" "}
          </div>
        </div>
        <div className="form-group" style={{ width: "100%" }}>
          {" "}
          <label htmlFor="global-css-input">
            {" Global Custom CSS "}
            <button id="reset-global-css-btn" type="button" style={{ background: "none", border: "1px solid #ccc", color: "#555", fontSize: "12px", padding: "2px 8px", borderRadius: "5px", cursor: "pointer", marginLeft: "10px" }}>Reset</button>
            {" "}
          </label>
          {" "}
          <textarea id="global-css-input" rows={6} style={{ width: "100%", marginTop: "8px", fontFamily: "monospace", fontSize: "16px", resize: "vertical" }} placeholder="/* Enter your custom CSS here */" />
          {" "}
        </div>
        {" "}
        <button className="form-button form-button-secondary" id="import-appearance-btn" style={{ marginTop: "10px" }} type="button">Import Appearance (JSON)</button>
        <FilePicker id="import-appearance-input" accept="application/json" />
        {" "}
        <button className="form-button" id="save-wallpaper-btn" style={{ marginTop: "30px" }} type="button">Save Appearance Settings</button>
      </div>
    </Screen>
  )
}
