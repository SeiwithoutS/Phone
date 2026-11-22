import { Dialog } from '../../components/phone'

export function CharacterNaiPromptsModal() {
  return (
    <Dialog id="character-nai-prompts-modal" style={{ display: "none" }}>
      <div className="modal-content">
        <div className="modal-header">
          <span>Character NovelAI Prompts</span>
          <span className="close" id="close-character-nai-prompts" style={{ cursor: "pointer", float: "right", fontSize: "28px", fontWeight: "bold" }}>{"×"}</span>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: "13px", color: "#666", marginBottom: "20px", backgroundColor: "#f0f8ff", padding: "12px", borderRadius: "6px", borderLeft: "3px solid #007bff" }}>{" These prompts apply to images generated for this character. "}</p>
          <div className="form-group">
            <label htmlFor="character-nai-positive" style={{ color: "#333", fontWeight: "600" }}>{" Positive Prompt "}</label>
            <textarea id="character-nai-positive" rows={4} style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "10px", width: "100%", borderRadius: "4px", resize: "vertical", fontSize: "13px" }} placeholder="Example: masterpiece, best quality, 1girl, detailed eyes, long hair, anime style" />
            <small style={{ display: "block", color: "#666", fontSize: "12px", marginTop: "5px" }}>{" Describe the desired image style or add artist tags. "}</small>
          </div>
          <div className="form-group">
            <label htmlFor="character-nai-negative" style={{ color: "#333", fontWeight: "600" }}>{" Negative Prompt "}</label>
            <textarea id="character-nai-negative" rows={4} style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "10px", width: "100%", borderRadius: "4px", resize: "vertical", fontSize: "13px" }} placeholder="Example: lowres, bad anatomy, bad hands, text, error, missing fingers" />
            <small style={{ display: "block", color: "#666", fontSize: "12px", marginTop: "5px" }}>{" Describe what the image should avoid. "}</small>
          </div>
        </div>
        <div className="modal-footer">
          <button id="reset-character-nai-prompts-btn" className="form-button form-button-secondary" style={{ marginRight: "10px" }} type="button">Clear Prompts</button>
          <button id="save-character-nai-prompts-btn" className="form-button form-button-secondary" type="button">Save</button>
        </div>
      </div>
    </Dialog>
  )
}

export function NovelaiSettingsModal() {
  return (
    <Dialog id="novelai-settings-modal" style={{ display: "none" }}>
      <div className="modal-content" style={{ maxWidth: "600px", width: "90%", maxHeight: "85vh", overflowY: "auto" }}>
        <div className="modal-header">
          <span>NovelAI Generation Settings</span>
          <span className="close" id="close-novelai-settings" style={{ cursor: "pointer", float: "right", fontSize: "28px", fontWeight: "bold" }}>{"×"}</span>
        </div>
        <div className="modal-body" style={{ padding: "20px" }}>
          <div className="form-group">
            <label style={{ color: "#333" }}>Image Size (small images are included with Opus)</label>
            <select id="nai-resolution" style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "8px", width: "100%", borderRadius: "4px" }} defaultValue="1024x1024">
              <optgroup label="Small images">
                <option value="512x768">{"Portrait (512 × 768)"}</option>
                <option value="768x512">{"Landscape (768 × 512)"}</option>
                <option value="640x640">{"Square (640 × 640)"}</option>
              </optgroup>
              <optgroup label="Normal">
                <option value="832x1216">{"Portrait (832 × 1216)"}</option>
                <option value="1216x832">{"Landscape (1216 × 832)"}</option>
                <option value="1024x1024">{"Square (1024 × 1024)"}</option>
              </optgroup>
              <optgroup label="Wallpaper sizes">
                <option value="1088x1920">{"Portrait (1088 × 1920)"}</option>
                <option value="1920x1088">{"Landscape (1920 × 1088)"}</option>
              </optgroup>
            </select>
            <small style={{ color: "#666" }}>Standard NovelAI dimensions give the best results.</small>
          </div>
          <div className="form-group">
            <label style={{ color: "#333" }}>Sampling Steps</label>
            <input type="number" id="nai-steps" min="1" max="50" style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "8px", width: "100%", borderRadius: "4px" }} defaultValue="28" />
            <small style={{ color: "#666" }}>Suggested value 28. More steps take longer.</small>
          </div>
          <div className="form-group">
            <label style={{ color: "#333" }}>Prompt Guidance (CFG Scale)</label>
            <input type="number" id="nai-cfg-scale" min="1" max="20" step="0.5" style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "8px", width: "100%", borderRadius: "4px" }} defaultValue="5" />
            <small style={{ color: "#666" }}>Suggested value 5. Sets how closely the image follows the prompt.</small>
          </div>
          <div className="form-group">
            <label style={{ color: "#333" }}>Sampler</label>
            <select id="nai-sampler" style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "8px", width: "100%", borderRadius: "4px" }} defaultValue="k_euler_ancestral">
              <option value="k_euler">Euler</option>
              <option value="k_euler_ancestral">Euler Ancestral</option>
              <option value="k_dpmpp_2s_ancestral">DPM++ 2S Ancestral</option>
              <option value="k_dpmpp_2m">DPM++ 2M</option>
              <option value="k_dpmpp_sde">DPM++ SDE</option>
              <option value="ddim">DDIM</option>
            </select>
          </div>
          <div className="form-group">
            <label style={{ color: "#333" }}>Seed</label>
            <input type="number" id="nai-seed" min="-1" max="9999999999" style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "8px", width: "100%", borderRadius: "4px" }} defaultValue="-1" />
            <small style={{ color: "#666" }}>Use -1 for random generation or reuse a seed to reproduce an image.</small>
          </div>
          <div className="form-group">
            <label style={{ color: "#333" }}>Undesired Content Preset</label>
            <select id="nai-uc-preset" style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "8px", width: "100%", borderRadius: "4px" }} defaultValue="1">
              <option value="0">Preset 0 - Heavy</option>
              <option value="1">Preset 1 - Light</option>
              <option value="2">Preset 2 - Human Focus</option>
              <option value="3">Preset 3 - None</option>
            </select>
          </div>
          <div className="form-group">
            <label style={{ color: "#333" }}>Quality Tags</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input type="checkbox" id="nai-quality-toggle" defaultChecked style={{ width: "auto" }} />
              <span style={{ color: "#666", fontSize: "14px" }}>Automatically Add Quality Tags</span>
            </div>
          </div>
          <div className="form-group">
            <label style={{ color: "#333" }}>SMEA (Detail Enhancement)</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input type="checkbox" id="nai-smea" defaultChecked style={{ width: "auto" }} />
              <span style={{ color: "#666", fontSize: "14px" }}>Enable SMEA</span>
            </div>
          </div>
          <div className="form-group">
            <label style={{ color: "#333" }}>SMEA DYN (Dynamic SMEA)</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input type="checkbox" id="nai-smea-dyn" style={{ width: "auto" }} />
              <span style={{ color: "#666", fontSize: "14px" }}>Enable Dynamic SMEA</span>
            </div>
          </div>
          <div className="form-group">
            <label style={{ color: "#333" }}>Default Positive Prompt</label>
            <textarea id="nai-default-positive" rows={3} style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "8px", width: "100%", borderRadius: "4px", resize: "vertical" }} placeholder="masterpiece, best quality, 1girl, beautiful..." defaultValue="masterpiece, best quality, 1girl, beautiful, detailed face, detailed eyes, long hair, anime style" />
            <small style={{ color: "#666" }}>Used when the test prompt is blank.</small>
          </div>
          <div className="form-group">
            <label style={{ color: "#333" }}>Default Negative Prompt</label>
            <textarea id="nai-default-negative" rows={3} style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "8px", width: "100%", borderRadius: "4px", resize: "vertical" }} placeholder="lowres, bad anatomy, bad hands, text, error..." defaultValue="lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry" />
          </div>
          <div className="form-group" style={{ borderTop: "1px solid #ddd", paddingTop: "15px", marginTop: "15px" }}>
            <label style={{ color: "#333" }}>CORS Proxy</label>
            <select id="nai-cors-proxy" style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "8px", width: "100%", borderRadius: "4px" }} defaultValue={"https://corsproxy.io/?"}>
              <option value={""}>Direct Connection</option>
              <option value={"https://corsproxy.io/?"}>corsproxy.io</option>
              <option value={"https://api.allorigins.win/raw?url="}>allorigins.win</option>
              <option value="https://cors-anywhere.herokuapp.com/">cors-anywhere (requires activation)</option>
              <option value="custom">Custom Proxy</option>
            </select>
            <small style={{ color: "#e74c3c", display: "block", marginTop: "8px" }}>{" If the browser blocks cross-origin requests, configure a compatible proxy. "}</small>
          </div>
          <div id="nai-custom-proxy-group" className="form-group" style={{ display: "none" }}>
            <label style={{ color: "#333" }}>Custom Proxy URL</label>
            <input type="text" id="nai-custom-proxy-url" placeholder={"https://your-proxy.com/?"} style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "8px", width: "100%", borderRadius: "4px" }} />
            <small style={{ color: "#666" }}>End the URL with / or ?. Example: https://proxy.com/?</small>
          </div>
        </div>
        <div className="modal-footer">
          <button id="reset-nai-settings-btn" className="form-button form-button-secondary" style={{ marginRight: "10px" }} type="button">Restore Defaults</button>
          <button id="save-nai-settings-btn" className="form-button form-button-secondary" type="button">Save Settings</button>
        </div>
      </div>
    </Dialog>
  )
}

export function NovelaiTestModal() {
  return (
    <Dialog id="novelai-test-modal" style={{ display: "none" }}>
      <div className="modal-content" style={{ maxWidth: "700px", width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <span>Test NovelAI Generation</span>
          <span className="close" id="close-novelai-test" style={{ cursor: "pointer", float: "right", fontSize: "28px", fontWeight: "bold" }}>{"×"}</span>
        </div>
        <div className="modal-body" style={{ padding: "20px" }}>
          <div className="form-group">
            <label style={{ color: "#333" }}>Positive Prompt (for this test)</label>
            <textarea id="nai-test-prompt" rows={4} style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "10px", width: "100%", borderRadius: "4px", resize: "vertical" }} placeholder="1girl, solo, long hair, blue eyes, smile..." defaultValue="1girl, solo, long hair, blue eyes, smile, outdoors, cherry blossoms, spring" />
          </div>
          <div className="form-group">
            <label style={{ color: "#333" }}>Negative Prompt (optional)</label>
            <textarea id="nai-test-negative" rows={3} style={{ backgroundColor: "#f8f9fa", color: "#333", border: "1px solid #ccc", padding: "10px", width: "100%", borderRadius: "4px", resize: "vertical" }} placeholder="Leave blank to use the default negative prompt" />
          </div>
          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <button id="nai-generate-btn" style={{ backgroundColor: "#007bff", color: "white", border: "none", padding: "12px 30px", borderRadius: "6px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }} type="button">{" Generate Image "}</button>
          </div>
          <div id="nai-test-status" style={{ textAlign: "center", color: "#666", margin: "15px 0", display: "none" }}>{" Generating image… "}</div>
          <div id="nai-test-result" style={{ display: "none", marginTop: "20px" }}>
            <div style={{ fontWeight: "bold", color: "#333", marginBottom: "10px" }}>Result</div>
            <div style={{ textAlign: "center", background: "#f8f9fa", padding: "15px", borderRadius: "8px", border: "1px solid #e9ecef" }}>
              <img id="nai-result-image" style={{ maxWidth: "100%", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} alt={""} />
            </div>
            <div style={{ marginTop: "10px", textAlign: "center" }}>
              <button id="nai-download-btn" className="form-button-secondary" style={{ margin: "0" }} type="button">Download Image</button>
            </div>
          </div>
          <div id="nai-test-error" style={{ display: "none", marginTop: "15px", padding: "12px", background: "#f8d7da", color: "#721c24", borderRadius: "6px", border: "1px solid #f5c6cb" }} />
        </div>
        <div className="modal-footer">
          <button id="close-nai-test-btn" className="form-button" type="button">Close</button>
        </div>
      </div>
    </Dialog>
  )
}
