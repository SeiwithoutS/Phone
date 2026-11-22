import { Dialog } from '../../components/phone'

export function AvatarFrameModal() {
  return (
    <Dialog id="avatar-frame-modal">
      <div className="modal-content">
        <div className="modal-header">
          {" "}
          <span>Select Avatar Frame</span>
          <div className="header-actions">
            {" "}
            <button id="manage-frames-btn" className="action-button" type="button">Manage</button>
            {" "}
            <button id="upload-custom-frame-btn" className="action-button" type="button">Upload</button>
            {" "}
            <button id="batch-import-frames-btn" className="action-button" type="button">Batch Import</button>
            {" "}
          </div>
        </div>
        <div className="modal-body">
          <div className="frame-tabs">
            <div id="ai-frame-tab" className="frame-tab active">Character</div>
            <div id="my-frame-tab" className="frame-tab">Mine</div>
          </div>
          <div id="ai-frame-content" className="frame-content">
            <div id="ai-frame-grid" className="frame-grid">{" "}</div>
          </div>
          <div id="my-frame-content" className="frame-content" style={{ display: "none" }}>
            <div id="my-frame-grid" className="frame-grid">{" "}</div>
          </div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-frame-settings-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="save-frame-settings-btn" type="button">Save</button>
          {" "}
        </div>
        <div id="frame-action-bar" style={{ display: "none" }}>
          {" "}
          <label className="select-all-label" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {" "}
            <input type="checkbox" id="select-all-frames-checkbox" />
            {" Select All "}
          </label>
          {" "}
          <button id="delete-selected-frames-btn" className="action-bar-btn" type="button">Delete (0)</button>
        </div>
      </div>
    </Dialog>
  )
}
