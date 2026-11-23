import { useState } from 'react'
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
        <h3 style={{ marginTop: "0", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>API Presets</h3>
        <div className="form-group">
          {" "}
          <label htmlFor="api-preset-select">Select a preset</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {" "}
            <select id="api-preset-select" style={{ flexGrow: "1" }} />
            {" "}
            <button id="save-api-preset-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px" }} type="button">Save</button>
            {" "}
            <button id="delete-api-preset-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px", backgroundColor: "#ffebee", color: "#d32f2f", borderColor: "#ffcdd2" }} type="button">Delete</button>
            {" "}
          </div>
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ marginTop: "0", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Chat Completion API</h3>
        <p style={{ fontSize: "14px", color: "#666", backgroundColor: "#f0f0f0", padding: "10px", borderRadius: "8px" }}>
          {" Choose a model with vision support to send images, such as"}
          <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "4px" }}>gpt-4o</code>
          {"or"}
          <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "4px" }}>gpt-4-vision-preview</code>
          {"。 "}
        </p>
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
        <button className="form-button" id="fetch-models-btn" type="button">Fetch Models</button>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Secondary API for memory summaries</h3>
        <p style={{ fontSize: "14px", color: "#666", backgroundColor: "#f0f0f0", padding: "10px", borderRadius: "8px" }}>{" Use a separate API for long-term memory summaries. Leave its fields empty to use the primary API. "}</p>
        <FormField id="secondary-proxy-url" label="Secondary Base URL">
          <input type="text" id="secondary-proxy-url" placeholder="Example: https://api.groq.com/openai" />
        </FormField>
        <FormField id="secondary-api-key" label="Secondary API Key">
          <input type="password" id="secondary-api-key" placeholder="gsk_..." />
        </FormField>
        <div className="form-group">
          {" "}
          <label htmlFor="secondary-model-select">Secondary Model</label>
          {" "}
          <input id="secondary-model-select" list="secondary-model-select-options" placeholder="Enter a model ID" autoComplete="off" />
          <datalist id="secondary-model-select-options" />
          {" "}
        </div>
        {" "}
        <button className="form-button form-button-secondary" id="fetch-secondary-models-btn" type="button">Fetch Secondary Models</button>
        <div className="form-group">
          {" "}
          <label htmlFor="api-temperature-slider">
            {"Temperature "}
            <span id="api-temperature-value">0.8</span>
          </label>
          <p style={{ fontSize: "12px", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" Higher values make replies more varied. Lower values make them more predictable. Suggested range 0.7–1.0. "}</p>
          {" "}
          <input type="range" id="api-temperature-slider" min="0" max="2" step="0.1" style={{ width: "100%", marginTop: "8px" }} defaultValue="0.8" />
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Background Activity</h3>
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
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" Suggested range 60–300. Longer intervals reduce costs and slow character activity. "}</p>
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
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" A blocked character may send a new friend request after this cooldown. "}</p>
            {" "}
          </label>
          {" "}
          <input type="number" id="block-cooldown-input" min="0.1" step="0.1" style={{ width: "80px", textAlign: "center" }} defaultValue="1" />
          {" "}
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Voice Messages (MiniMax TTS)</h3>
        <p style={{ fontSize: "14px", color: "#666", backgroundColor: "#f0f0f0", padding: "10px", borderRadius: "8px" }}>
          {" Prefix an AI reply with "}
          <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "4px" }}>{"[V]"}</code>
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
        <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Performance and Display</h3>
        <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
          {" "}
          <label htmlFor="chat-list-render-window-input" style={{ marginBottom: "0" }}>
            {" Chat list page size "}
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" Number of conversations loaded each time you scroll. Default 30. "}</p>
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
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" Number of recent messages shown when opening a chat. Higher values take longer to load. "}</p>
            {" "}
          </label>
          {" "}
          <input type="number" id="chat-render-window-input" min="10" style={{ width: "80px", textAlign: "center" }} defaultValue="50" />
          {" "}
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Image Generation</h3>
        <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {" "}
          <label htmlFor="enable-ai-drawing-switch" style={{ marginBottom: "0" }}>
            {" Enable AI image generation "}
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" When disabled, generated images use placeholders to reduce bandwidth and API costs. "}</p>
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
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#666", marginTop: "5px" }}>{" Generate anime-style images with the NovelAI API. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#666", marginTop: "5px" }}>{" Triple-click an image to download it. Use the test dialog to try a model or artist tags. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#666", marginTop: "5px" }}>{" 429 — Rate limit. Wait a few seconds and retry. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#666", marginTop: "5px" }}>{" 403 — Account or subscription limit. Try a smaller size or check available credits. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#666", marginTop: "5px" }}>{" 403 can also occur if image generation is disabled. Check the setting and image size. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#666", marginTop: "5px" }}>{" 401 — Check your NovelAI API key and permissions. "}</p>
            <p style={{ fontSize: "12px", fontWeight: "normal", color: "#666", marginTop: "5px" }}>{" If the browser reports Failed to fetch, check the proxy settings below. "}</p>
          </label>
          <label className="toggle-switch">
            <input type="checkbox" id="novelai-switch" />
            <span className="slider" />
          </label>
        </div>
        <div id="novelai-details" style={{ display: "none" }}>
          <div className="form-group">
            <label htmlFor="novelai-model" style={{ color: "#333" }}>NovelAI Model</label>
            <select id="novelai-model" style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "8px", borderRadius: "4px" }}>
              <option value="nai-diffusion-4-curated-preview">NAI Diffusion V4.5 Curated (SFW)</option>
              <option value="nai-diffusion-4-5-full">NAI Diffusion V4.5 Full</option>
              <option value="nai-diffusion-3">NAI Diffusion Anime V3 (Legacy)</option>
              <option value="nai-diffusion-furry-3">NAI Diffusion Furry V3 (Legacy)</option>
            </select>
            <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>{" Requires an API key with an Opus subscription. "}</p>
          </div>
          <div className="form-group">
            <label htmlFor="novelai-api-key" style={{ color: "#333" }}>NovelAI API Key</label>
            <div style={{ position: "relative" }}>
              <input type="password" id="novelai-api-key" placeholder="pst-xxxxxxxxxxxxxxxx" style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", paddingRight: "40px" }} />
              <span id="novelai-key-toggle" style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", userSelect: "none", fontSize: "18px" }}>{"🧐"}</span>
            </div>
            <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
              {" Get your key from "}
              <a href="https://novelai.net" target="_blank" style={{ color: "#007bff" }}>NovelAI</a>
              {" Get an API Key "}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
            <button type="button" id="novelai-settings-btn" style={{ flex: "1", backgroundColor: "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer" }}>{" Generation Settings "}</button>
            <button type="button" id="novelai-test-btn" style={{ flex: "1", backgroundColor: "#28a745", color: "white", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer" }}>{" Test Generation "}</button>
          </div>
        </div>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Storage Optimization</h3>
        <p id="total-image-size-display" style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "15px", textAlign: "center" }}>{" Calculating local image size… "}</p>
        <button className="form-button form-button-secondary" id="compress-images-btn" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", borderColor: "#c8e6c9" }} type="button">{" Compress Local Images "}</button>
        <p style={{ fontSize: "12px", color: "#8a8a8a", marginTop: "8px", lineHeight: "1.5" }}>
          {" Convert local images such as avatars, stickers, and chat media to JPEG to reduce storage usage. "}
          <br />
          <strong style={{ color: "#ff3b30" }}>Compression is permanent and reduces image quality. Back up your data first.</strong>
        </p>
        <hr style={{ margin: "30px 0", opacity: "0.3" }} />
        {" "}
        <button className="form-button" id="save-api-settings-btn" style={{ marginTop: "20px" }} type="button">Save All Settings</button>
        {" "}
        <UserDataBackup />
        <details className="settings-disclosure">
        <summary>Data maintenance</summary>
        <button className="form-button" id="import-btn" type="button">Import Legacy JSON Backup</button>
        <button className="form-button form-button-secondary" id="cleanup-data-btn" style={{ backgroundColor: "#ffebee", color: "#c62828", borderColor: "#ef9a9a", marginTop: "10px" }} type="button">Clean Up Unused Data</button>
        <button className="form-button form-button-secondary" id="delete-world-books-btn" style={{ backgroundColor: "#ffebee", color: "#c62828", borderColor: "#ef9a9a", marginTop: "10px" }} type="button">Delete World Info</button>
        <button className="form-button form-button-secondary" id="clear-specific-data-btn" style={{ backgroundColor: "#ffcdd2", color: "#b71c1c", borderColor: "#ef9a9a", marginTop: "10px" }} type="button">Advanced Data Cleanup</button>
        <button className="form-button form-button-secondary" id="check-and-fix-data-btn" style={{ backgroundColor: "#e3f2fd", color: "#0d47a1", borderColor: "#bbdefb", marginTop: "10px" }} type="button">Check and Repair Data</button>
        {" "}
        <input id="import-data-input" type="file" accept="application/json" hidden />
        </details>
      </div>
    </Screen>
  )
}

function UserDataBackup() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function download() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/backup.zip', { cache: 'no-store' })
      if (!response.ok || !response.headers.get('content-type')?.includes('application/zip')) {
        throw new Error('The local backup could not be read.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = response.headers.get('content-disposition')?.match(/filename="([^"]+\.zip)"/)?.[1] ||
        'EPhone-User-Data-' + new Date().toISOString().slice(0, 10) + '.zip'
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      setError('Could not download the ZIP. Check that the EPhone server is running and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="local-backup">
    <h2>User Data</h2>
    <button type="button" className="phone-app-button" id="export-data-btn" disabled={busy} onClick={() => void download()}>
      {busy ? 'Preparing ZIP…' : 'Export User Data ZIP'}
    </button>
    {error && <p role="alert">{error}</p>}
    <details className="settings-disclosure">
      <summary>How to restore</summary>
      <ol>
        <li>Stop EPhone and close its browser tabs.</li>
        <li>Extract the ZIP. Keep a copy of your current <code>data/eephone.json</code>.</li>
        <li>Copy the extracted <code>eephone.json</code> into the <code>data</code> folder or the folder set by <code>EEPHONE_DATA_DIR</code>.</li>
        <li>Start EPhone and open it again.</li>
      </ol>
      <p>The ZIP includes API keys. Keep it private.</p>
    </details>
  </section>
}
