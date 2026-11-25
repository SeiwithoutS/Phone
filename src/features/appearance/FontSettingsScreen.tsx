import { IconButton } from '../../components/icons'
import { HeaderSaveButton, PhoneFeatureHeader, FormField, Screen } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function FontSettingsScreen() {
  return (
    <Screen id="font-settings-screen" className="phone-feature">
      <PhoneFeatureHeader title="Font Settings" onBack={() => showScreen('home-screen')}
        actions={<HeaderSaveButton id="save-font-btn" label="Save and apply font" />} />
      <div className="form-container">
        <h3 style={{ marginTop: "0", borderBottom: "1px solid var(--ui-divider)", paddingBottom: "10px" }}>Font Presets</h3>
        <div className="form-group">
          {" "}
          <label htmlFor="font-preset-select">Select a preset</label>
          <div className="font-preset-controls">
            {" "}
            <select id="font-preset-select" />
            {" "}
            <IconButton icon="check" id="save-font-preset-btn" label="Save font preset" />
            {" "}
            <IconButton icon="trash" id="delete-font-preset-btn" label="Delete font preset" />
            {" "}
          </div>
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <FormField id="font-url-input" label="Font URL (.ttf, .otf, .woff)">
          <input type="text" id="font-url-input" placeholder="https://..../font.ttf" />
        </FormField>
        <div className="form-group">
          <label htmlFor="app-font-size">App text size <output id="app-font-size-value" htmlFor="app-font-size">100%</output></label>
          <input id="app-font-size" type="range" min={85} max={130} step={5} defaultValue={100} />
        </div>
        <div className="form-group">
          {" "}
          <label>Live Preview</label>
          <div id="font-preview">
            <p style={{ fontSize: "1.25em", margin: "0 0 10px 0" }}>Hello World</p>
            <p style={{ margin: "0" }}>Sample text and numbers 12345.</p>
          </div>
        </div>
        {" "}
        {" "}
        <button className="form-button form-button-secondary" id="reset-font-btn" type="button">Restore Default Font</button>
      </div>
    </Screen>
  )
}
