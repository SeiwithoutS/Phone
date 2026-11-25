import { Icon, IconButton } from '../../components/icons'
import { HeaderSaveButton, PhoneFeatureHeader, FilePicker, Screen } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function WallpaperScreen() {
  return (
    <Screen id="wallpaper-screen">
      <PhoneFeatureHeader title="Appearance" onBack={() => showScreen('home-screen')}
        actions={<HeaderSaveButton id="save-wallpaper-btn" label="Save Appearance settings" />} />
      <div className="form-container">
        {" "}
        <label style={{ fontWeight: "500", color: "var(--text-secondary)" }}>EPhone Home Wallpaper</label>
        <div id="wallpaper-preview">Upload an image below</div>
        <div className="bg-upload-container">
          {" "}
          <IconButton icon="upload" label="Upload an image" onClick={() => document.getElementById("wallpaper-upload-input")?.click()} />
          {" "}
          <IconButton icon="link" id="upload-ephone-bg-url-btn" label="Set EPhone wallpaper URL" />
          {" "}
          <IconButton icon="trash" id="remove-ephone-bg-btn" label="Remove EPhone wallpaper" />
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
          <IconButton icon="upload" label="Upload an image" onClick={() => document.getElementById("cphone-wallpaper-upload-input")?.click()} />
          {" "}
          <IconButton icon="link" id="upload-cphone-bg-url-btn" label="Set Cphone wallpaper URL" />
          {" "}
          <IconButton icon="trash" id="remove-cphone-bg-btn" label="Remove Cphone wallpaper" />
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
          <IconButton icon="upload" label="Upload an image" onClick={() => document.getElementById("global-bg-input")?.click()} />
          {" "}
          <IconButton icon="link" id="upload-global-bg-url-btn" label="Set default chat background URL" />
          {" "}
          <IconButton icon="trash" id="remove-global-bg-btn" label="Remove default chat background" />
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
        <div className="form-group settings-tools">
          <label htmlFor="qq-action-language" style={{ marginBottom: 0 }}>QQ action notices</label>
          <select id="qq-action-language" defaultValue="en">
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </div>
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <section className="phone-app-card message-sound-card">
          <div className="message-sound-heading">
            <Icon name="volume" />
            <label htmlFor="message-sound-toggle"><strong>Message sounds</strong><small>Play a sound when you send or receive a message.</small></label>
            <label className="toggle-switch">
              <input type="checkbox" id="message-sound-toggle" role="switch" aria-label="Message sounds" />
              <span className="slider" />
            </label>
          </div>
          <label htmlFor="notification-sound-url-input">Custom received sound URL</label>
          <div className="sound-controls">
            <input type="url" id="notification-sound-url-input" placeholder="Use the default when blank" />
            <IconButton icon="play" id="test-sound-received" label="Preview received sound" />
            <IconButton icon="reset" id="reset-sound-btn" label="Restore default received sound" />
          </div>
          <div className="sound-controls">
            <span>Sent sound</span><IconButton icon="play" id="test-sound-sent" label="Preview sent sound" />
          </div>
        </section>
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <details className="settings-disclosure icon-settings-panel">
          <summary>EPhone app names and icons</summary>
          <div id="icon-settings-grid" />
        </details>
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <div className="form-group" style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            {" "}
            <label>Chat Toolbar Order</label>
            {" "}
            <IconButton icon="reset" id="reset-button-order-btn" label="Restore default toolbar order" />
            {" "}
          </div>
          <p style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Drag the buttons below to reorder them. Changes are saved automatically. "}</p>
          <div id="button-order-editor" style={{ display: "flex", flexWrap: "wrap", gap: "10px", padding: "10px", backgroundColor: "var(--ui-raised)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>{" "}</div>
        </div>
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <details className="settings-disclosure icon-settings-panel">
          <summary>Cphone app names and icons</summary>
          <div id="cphone-icon-settings-grid" />
        </details>
        <hr style={{ width: "80%", opacity: "0.3", margin: "30px 0" }} />
        <h3 style={{ marginTop: "0", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", width: "100%", textAlign: "left" }}>Appearance Presets</h3>
        <p style={{ fontSize: "0.75rem", color: "#8a8a8a", marginTop: "-5px", lineHeight: "1.5", width: "100%", textAlign: "left" }}>{" Save or load wallpaper, icons, toolbar order, and theme."}</p>
        <div className="form-group" style={{ width: "100%" }}>
          {" "}
          <label htmlFor="appearance-preset-select">Select a preset</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {" "}
            <select id="appearance-preset-select" style={{ flexGrow: "1" }} />
            {" "}
            <IconButton icon="check" id="save-appearance-preset-btn" label="Save appearance preset" />
            {" "}
            <IconButton icon="trash" id="delete-appearance-preset-btn" label="Delete appearance preset" />
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
            <IconButton icon="check" id="save-css-preset-btn" label="Save CSS preset" />
            {" "}
            <IconButton icon="trash" id="delete-css-preset-btn" label="Delete CSS preset" />
            {" "}
          </div>
        </div>
        <div className="form-group" style={{ width: "100%" }}>
          {" "}
          <label htmlFor="global-css-input">
            {" Global Custom CSS "}
            <IconButton icon="reset" id="reset-global-css-btn" label="Reset global CSS" />
            {" "}
          </label>
          {" "}
          <textarea id="global-css-input" rows={6} style={{ width: "100%", marginTop: "8px", fontFamily: "monospace", fontSize: "1rem", resize: "vertical" }} placeholder="/* Enter your custom CSS here */" />
          {" "}
        </div>
        {" "}
        <div className="settings-tools"><span>Appearance JSON</span><IconButton icon="import" id="import-appearance-btn" label="Import appearance JSON" /></div>
        <FilePicker id="import-appearance-input" accept="application/json" />
        {" "}
      </div>
    </Screen>
  )
}
