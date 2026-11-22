import { BackButton, Screen, ScreenHeader, Dialog } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function RenderingRulesScreen() {
  return (
    <Screen id="rendering-rules-screen">
      <ScreenHeader>
        {" "}
        <BackButton onClick={() => showScreen("home-screen")} />
        {" "}
        <span>Rendering Rules</span>
        {" "}
        <span className="action-btn" id="add-new-rule-btn">+</span>
        {" "}
      </ScreenHeader>
      <div id="rules-tabs">{" "}</div>
      <div id="rules-content-container">{" "}</div>
    </Screen>
  )
}

export function RuleEditorModal() {
  return (
    <Dialog id="rule-editor-modal">
      <div className="modal-content" style={{ height: "85%" }}>
        <div className="modal-header">
          {" "}
          <span id="rule-editor-title">Create Rule</span>
          {" "}
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div className="form-group" style={{ flexShrink: "0" }}>
            {" "}
            <label htmlFor="rule-name-input">Rule Name</label>
            {" "}
            <input type="text" id="rule-name-input" placeholder="Example: Delivery card" />
            {" "}
          </div>
          <div className="form-group" style={{ flexShrink: "0" }}>
            {" "}
            <label htmlFor="rule-chat-id-select">Scope</label>
            {" "}
            <select id="rule-chat-id-select">
              <option value="global">Global (all characters)</option>
            </select>
            {" "}
          </div>
          <div className="form-group" style={{ flexGrow: "1", display: "flex", flexDirection: "column" }}>
            {" "}
            <label htmlFor="rule-regex-input">Regular Expression (global flag)</label>
            {" "}
            <textarea id="rule-regex-input" rows={3} style={{ fontFamily: "monospace", resize: "vertical" }} placeholder={"Example: MTR\\\\[(.*?)\\\\]\\\\[(.*?)\\|(.*?)\\\\]"} />
          </div>
          <div className="form-group" style={{ flexGrow: "2", display: "flex", flexDirection: "column" }}>
            {" "}
            <label htmlFor="rule-template-input">{"HTML Template (use $1, $2, etc.)"}</label>
            {" "}
            <textarea id="rule-template-input" rows={6} style={{ fontFamily: "monospace", resize: "vertical" }} placeholder={"Example: <div class=`waimai-card`>...<span>$2</span>...</div>"} />
            {" "}
          </div>
          <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: "0" }}>
            {" "}
            <label htmlFor="rule-enabled-switch" style={{ marginBottom: "0" }}>Enable Rule</label>
            {" "}
            <label className="toggle-switch">
              {" "}
              <input type="checkbox" id="rule-enabled-switch" defaultChecked />
              <span className="slider" />
              {" "}
            </label>
            {" "}
          </div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-rule-editor-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="save-rule-btn" type="button">Save Rule</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
