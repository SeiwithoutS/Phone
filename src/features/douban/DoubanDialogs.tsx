import { Dialog } from '../../components/phone'

export function DoubanCastModal() {
  return (
    <Dialog id="douban-cast-modal">
      <div className="modal-content" style={{ height: "70%" }}>
        <div className="modal-header">
          {" "}
          <span>Select Douban Characters</span>
          {" "}
        </div>
        <div className="modal-body" id="douban-cast-list" style={{ padding: "0" }}>{" "}</div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-douban-cast-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="save-douban-cast-btn" type="button">Save and Refresh</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function DoubanSettingsModal() {
  return (
    <Dialog id="douban-settings-modal">
      <div className="modal-content">
        <div className="modal-header">
          {" "}
          <span>Douban Settings</span>
          {" "}
        </div>
        <div className="modal-body">
          <div className="form-group douban-settings-item">
            {" "}
            <label htmlFor="douban-min-posts-input">
              {" Posts per Generation "}
              <p style={{ fontSize: "12px", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" Set the minimum and maximum number of posts generated at once. "}</p>
              {" "}
            </label>
            <div className="douban-settings-controls">
              {" "}
              <input type="number" id="douban-min-posts-input" min="1" defaultValue="12" />
              {" "}
              <span>to</span>
              {" "}
              <input type="number" id="douban-max-posts-input" min="1" defaultValue="20" />
              {" "}
              <span>posts</span>
              {" "}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-douban-settings-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="save-douban-settings-btn" type="button">Save</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
