import { IconButton } from '../../components/icons'
import { BackButton, FormField, Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function ApiSettingsScreen() {
  return (
    <Screen id="api-settings-screen">
      <ScreenHeader>
        {" "}
        <BackButton onClick={() => showScreen("home-screen")} />
        {" "}
        <span>API Connections</span>
        {" "}
        <span style={{ width: "30px" }} />
        {" "}
      </ScreenHeader>
      <div className="form-container">
        <h3 style={{ marginTop: "0", borderBottom: "1px solid var(--ui-divider)", paddingBottom: "10px" }}>API Presets</h3>
        <div className="form-group">
          {" "}
          <label htmlFor="api-preset-select">Select a preset</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {" "}
            <select id="api-preset-select" style={{ flexGrow: "1" }} />
            {" "}
            <IconButton icon="check" id="save-api-preset-btn" label="Save API preset" />
            {" "}
            <IconButton icon="trash" id="delete-api-preset-btn" label="Delete API preset" />
            {" "}
          </div>
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ marginTop: "0", borderBottom: "1px solid var(--ui-divider)", paddingBottom: "10px" }}>Chat Completion API</h3>
        <p style={{ fontSize: "14px", color: "var(--ui-muted)", backgroundColor: "var(--ui-raised)", padding: "10px", borderRadius: "8px" }}>
          {" Choose a model with vision support to send images, such as"}
          <code style={{ backgroundColor: "var(--ui-surface)", padding: "2px 4px", borderRadius: "4px" }}>gpt-4o</code>
          {"or"}
          <code style={{ backgroundColor: "var(--ui-surface)", padding: "2px 4px", borderRadius: "4px" }}>gpt-4-vision-preview</code>
          {"。 "}
        </p>
        <FormField id="api-provider" label="Chat Completion Source">
          <select id="api-provider" defaultValue="openai"><option value="openai">OpenAI-compatible</option><option value="gemini">Google Gemini</option></select>
        </FormField>
        <FormField id="proxy-url" label="Base URL (/v1 is optional)">
          <input type="text" id="proxy-url" placeholder="Example: https://api.openai.com" />
        </FormField>
        <FormField id="api-key" label="API Key">
          <input type="password" id="api-key" placeholder="sk-..." />
        </FormField>
        <div className="form-group">
          {" "}
          <label htmlFor="model-select">Model</label>
          {" "}
          <input id="model-select" list="model-select-options" placeholder="Enter a model ID" autoComplete="off" />
          <datalist id="model-select-options" />
          {" "}
        </div>
        {" "}
        <button className="form-button" id="fetch-models-btn" type="button">Connect / Fetch Models</button>
        <button className="form-button form-button-secondary" id="test-api-connection-btn" type="button">Test Connection</button>
        <p id="api-connection-status" role="status" />
        <div className="form-group api-image-input-setting">
          <label htmlFor="send-images-to-ai-switch">Send images to AI
            <small>Off by default. Chat and Social use written photo descriptions. Enable this for a model that supports images.</small>
          </label>
          <label className="toggle-switch">
            <input type="checkbox" id="send-images-to-ai-switch" />
            <span className="slider" />
          </label>
        </div>
        <hr style={{ margin: "24px 0", opacity: "0.3" }} />
        <h3>Generation</h3>
        <div className="api-generation-grid">
          <FormField id="api-context-size" label="Context Size (tokens)"><input id="api-context-size" type="number" min={1024} max={2000000} defaultValue={32768} /></FormField>
          <FormField id="api-max-response" label="Max Response Length (tokens)"><input id="api-max-response" type="number" min={1} defaultValue={4096} /></FormField>
          <FormField id="api-swipes" label="Multiple swipes per generation"><input id="api-swipes" type="number" min={1} max={5} defaultValue={1} /></FormField>
          <FormField id="api-top-p" label="Top P"><input id="api-top-p" type="number" min={0} max={1} step={0.01} defaultValue={1} /></FormField>
          <FormField id="api-frequency-penalty" label="Frequency Penalty"><input id="api-frequency-penalty" type="number" min={-2} max={2} step={0.01} defaultValue={0} /></FormField>
          <FormField id="api-presence-penalty" label="Presence Penalty"><input id="api-presence-penalty" type="number" min={-2} max={2} step={0.01} defaultValue={0} /></FormField>
        </div>
        <label className="api-streaming"><input id="api-streaming" type="checkbox" /> Streaming</label>
        <div className="form-group">
          {" "}
          <label htmlFor="api-temperature-slider">
            {"Temperature "}
            <span id="api-temperature-value">0.8</span>
          </label>
          <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Higher values make replies more varied. Lower values make them more predictable. Suggested range 0.7–1.0. "}</p>
          {" "}
          <input type="range" id="api-temperature-slider" min="0" max="2" step="0.1" style={{ width: "100%", marginTop: "8px" }} defaultValue="0.8" />
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ borderBottom: "1px solid var(--ui-divider)", paddingBottom: "10px" }}>Background Activity</h3>
        <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {" "}
          <label htmlFor="background-activity-switch" style={{ marginBottom: "0" }}>
            {" Enable background character activity "}
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#ff6b6b", marginTop: "5px" }}>{" Background activity increases API usage and costs. "}</p>
          </label>
          {" "}
          <input type="checkbox" id="background-activity-switch" style={{ width: "auto", height: "20px" }} />
          {" "}
        </div>
        <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
          {" "}
          <label htmlFor="background-interval-input" style={{ marginBottom: "0" }}>
            {" Check interval (seconds) "}
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Suggested range 60–300. Longer intervals reduce costs and slow character activity. "}</p>
            {" "}
          </label>
          {" "}
          <input type="number" id="background-interval-input" min="30" style={{ width: "80px", textAlign: "center" }} defaultValue="60" />
          {" "}
        </div>
        <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
          {" "}
          <label htmlFor="block-cooldown-input" style={{ marginBottom: "0" }}>
            {" Cooldown after blocking (hours) "}
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" A blocked character may send a new friend request after this cooldown. "}</p>
            {" "}
          </label>
          {" "}
          <input type="number" id="block-cooldown-input" min="0.1" step="0.1" style={{ width: "80px", textAlign: "center" }} defaultValue="1" />
          {" "}
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ borderBottom: "1px solid var(--ui-divider)", paddingBottom: "10px" }}>Voice Messages (MiniMax TTS)</h3>
        <p style={{ fontSize: "14px", color: "var(--ui-muted)", backgroundColor: "var(--ui-raised)", padding: "10px", borderRadius: "8px" }}>
          {" Prefix an AI reply with "}
          <code style={{ backgroundColor: "var(--ui-surface)", padding: "2px 4px", borderRadius: "4px" }}>{"[V]"}</code>
          {" to turn it into a playable voice message."}
        </p>
        <FormField id="minimax-group-id" label="Minimax Group ID">
          <input type="text" id="minimax-group-id" placeholder="Enter your Group ID" />
        </FormField>
        <FormField id="minimax-api-key" label="Minimax API Key">
          <input type="password" id="minimax-api-key" placeholder="Enter your API key" />
        </FormField>
        <div className="form-group">
          {" "}
          <label htmlFor="minimax-model-select">Voice Model</label>
          {" "}
          <select id="minimax-model-select">
            <option value="speech-01">speech-01 (Standard)</option>
            <option value="speech-02">speech-02 (HD)</option>
          </select>
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ borderBottom: "1px solid var(--ui-divider)", paddingBottom: "10px" }}>Performance and Display</h3>
        <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
          {" "}
          <label htmlFor="chat-list-render-window-input" style={{ marginBottom: "0" }}>
            {" Chat list page size "}
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Number of conversations loaded each time you scroll. Default 30. "}</p>
            {" "}
          </label>
          {" "}
          <input type="number" id="chat-list-render-window-input" min="10" style={{ width: "80px", textAlign: "center" }} defaultValue="30" />
          {" "}
        </div>
        <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
          {" "}
          <label htmlFor="chat-render-window-input" style={{ marginBottom: "0" }}>
            {" Initial messages per chat "}
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Number of recent messages shown when opening a chat. Higher values take longer to load. "}</p>
            {" "}
          </label>
          {" "}
          <input type="number" id="chat-render-window-input" min="10" style={{ width: "80px", textAlign: "center" }} defaultValue="50" />
          {" "}
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ borderBottom: "1px solid var(--ui-divider)", paddingBottom: "10px" }}>Image Generation</h3>
        <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {" "}
          <label htmlFor="enable-ai-drawing-switch" style={{ marginBottom: "0" }}>
            {" Enable AI image generation "}
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" When disabled, generated images use placeholders to reduce bandwidth and API costs. "}</p>
            {" "}
          </label>
          {" "}
          <label className="toggle-switch">
            {" "}
            <input type="checkbox" id="enable-ai-drawing-switch" />
            {" "}
            <span className="slider" />
            {" "}
          </label>
          {" "}
        </div>
        <hr style={{ margin: "20px 0", opacity: ".3" }} />
        <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label htmlFor="novelai-switch" style={{ marginBottom: "0" }}>
            {" Enable NovelAI image generation "}
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Generate anime-style images with the NovelAI API. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Triple-click an image to download it. Use the test dialog to try a model or artist tags. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" 429 — Rate limit. Wait a few seconds and retry. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" 403 — Account or subscription limit. Try a smaller size or check available credits. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" 403 can also occur if image generation is disabled. Check the setting and image size. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" 401 — Check your NovelAI API key and permissions. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" If the browser reports Failed to fetch, check the proxy settings below. "}</p>
          </label>
          <label className="toggle-switch">
            <input type="checkbox" id="novelai-switch" />
            <span className="slider" />
          </label>
        </div>
        <div id="novelai-details" style={{ display: "none" }}>
          <div className="form-group">
            <label htmlFor="novelai-model" style={{ color: "var(--ui-text)" }}>NovelAI Model</label>
            <select id="novelai-model" style={{ backgroundColor: "var(--ui-raised)", color: "var(--ui-text)", border: "1px solid var(--ui-divider)", padding: "8px", borderRadius: "4px" }}>
              <option value="nai-diffusion-4-curated-preview">NAI Diffusion V4.5 Curated (SFW)</option>
              <option value="nai-diffusion-4-5-full">NAI Diffusion V4.5 Full</option>
              <option value="nai-diffusion-3">NAI Diffusion Anime V3 (Legacy)</option>
              <option value="nai-diffusion-furry-3">NAI Diffusion Furry V3 (Legacy)</option>
            </select>
            <p style={{ fontSize: "12px", color: "var(--ui-muted)", marginTop: "5px" }}>{" Requires an API key with an Opus subscription. "}</p>
          </div>
          <div className="form-group">
            <label htmlFor="novelai-api-key" style={{ color: "var(--ui-text)" }}>NovelAI API Key</label>
            <div style={{ position: "relative" }}>
              <input type="password" id="novelai-api-key" placeholder="pst-xxxxxxxxxxxxxxxx" style={{ backgroundColor: "var(--ui-raised)", color: "var(--ui-text)", border: "1px solid var(--ui-divider)", paddingRight: "40px" }} />
              <span id="novelai-key-toggle" style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", userSelect: "none", fontSize: "18px" }}>{"🧐"}</span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--ui-muted)", marginTop: "5px" }}>
              {" Get your key from "}
              <a href="https://novelai.net" target="_blank" style={{ color: "#007bff" }}>NovelAI</a>
              {" Get an API Key "}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
            <button type="button" id="novelai-settings-btn" style={{ flex: "1", backgroundColor: "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "9px", cursor: "pointer" }}>{" Generation Settings "}</button>
            <button type="button" id="novelai-test-btn" style={{ flex: "1", backgroundColor: "#28a745", color: "white", border: "none", padding: "10px 20px", borderRadius: "9px", cursor: "pointer" }}>{" Test Generation "}</button>
          </div>
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ borderBottom: "1px solid var(--ui-divider)", paddingBottom: "10px" }}>Storage Optimization</h3>
        <p id="total-image-size-display" style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "15px", textAlign: "center" }}>{" Calculating local image size… "}</p>
        <button className="form-button form-button-secondary" id="compress-images-btn" style={{ backgroundColor: "var(--ui-positive-soft)", color: "var(--ui-positive)", borderColor: "var(--ui-divider)" }} type="button">{" Compress Local Images "}</button>
        <p style={{ fontSize: "12px", color: "#8a8a8a", marginTop: "8px", lineHeight: "1.5" }}>
          {" Convert local images such as avatars, stickers, and chat media to JPEG to reduce storage usage. "}
          <br />
          <strong style={{ color: "#ff3b30" }}>Compression is permanent and reduces image quality. Back up your data first.</strong>
        </p>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        {" "}
        <button className="form-button" id="save-api-settings-btn" style={{ marginTop: "20px" }} type="button">Save All Settings</button>
        {" "}
        <button type="button" className="form-button form-button-secondary" onClick={() => showScreen("backup-screen")}>Open Backup</button>
        <details className="settings-disclosure">
        <summary>Data maintenance</summary>
        <div className="settings-tools"><span>Legacy JSON backup</span><IconButton icon="upload" id="import-btn" label="Import legacy JSON backup" /></div>
        <button className="form-button form-button-secondary" id="cleanup-data-btn" style={{ backgroundColor: "var(--ui-danger-soft)", color: "var(--ui-danger)", borderColor: "var(--ui-divider)", marginTop: "10px" }} type="button">Clean Up Unused Data</button>
        <button className="form-button form-button-secondary" id="delete-world-books-btn" style={{ backgroundColor: "var(--ui-danger-soft)", color: "var(--ui-danger)", borderColor: "var(--ui-divider)", marginTop: "10px" }} type="button">Delete World Info</button>
        <button className="form-button form-button-secondary" id="clear-specific-data-btn" style={{ backgroundColor: "var(--ui-danger-soft)", color: "var(--ui-danger)", borderColor: "var(--ui-divider)", marginTop: "10px" }} type="button">Advanced Data Cleanup</button>
        <button className="form-button form-button-secondary" id="check-and-fix-data-btn" style={{ backgroundColor: "var(--ui-accent-soft)", color: "var(--ui-accent)", borderColor: "var(--ui-divider)", marginTop: "10px" }} type="button">Check and Repair Data</button>
        {" "}
        <input id="import-data-input" type="file" accept="application/json" hidden />
        </details>
      </div>
    </Screen>
  )
}
