import { Dialog, FilePicker } from '../../components/phone'

export function ClearPostsModal() {
  return (
    <Dialog id="clear-posts-modal">
      <div className="modal-content" style={{ height: "70%" }}>
        <div className="modal-header">
          {" "}
          <span>Select Data to Clear</span>
          {" "}
        </div>
        <div className="modal-body" id="clear-posts-list" style={{ padding: "0" }}>{" "}</div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-clear-posts-btn" type="button">Cancel</button>
          {" "}
          <button className="save btn-danger" id="confirm-clear-posts-btn" type="button">Confirm Clear</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function CreatePostModal() {
  return (
    <Dialog id="create-post-modal">
      <div className="modal-content" style={{ height: "auto", maxHeight: "90%" }}>
        <div className="modal-header">
          {" "}
          <span>Create Post</span>
          {" "}
        </div>
        <div className="modal-body">
          <div className="form-group">
            {" "}
            <textarea id="post-public-text" rows={3} placeholder={"Share an update… (optional public text)"} />
            {" "}
          </div>
          <div className="post-mode-switcher">
            {" "}
            <button id="switch-to-image-mode" className="mode-btn active" type="button">Upload Image</button>
            {" "}
            <button id="switch-to-text-image-mode" className="mode-btn" type="button">Use Text Image</button>
            {" "}
          </div>
          <div className="form-group">
            {" "}
            <label>Visibility</label>
            <div id="post-visibility-options" style={{ display: "flex", gap: "15px", marginBottom: "10px" }}>
              {" "}
              <label>
                <input type="radio" name="visibility" defaultChecked defaultValue="public" />
                {" Public"}
              </label>
              {" "}
              <label>
                <input type="radio" name="visibility" defaultValue="include" />
                {" Selected Groups"}
              </label>
              {" "}
            </div>
            <div id="post-visibility-groups" style={{ display: "none", maxHeight: "120px", overflowY: "auto", background: "#f9f9f9", padding: "10px", borderRadius: "8px" }}>{" "}</div>
          </div>
          <div id="image-mode-content" className="post-mode-content active">
            <div className="form-group">
              <div id="post-image-preview-container" className="post-image-preview-container">
                {" "}
                <img id="post-image-preview" alt="Image Preview" />
                {" "}
                <button id="post-remove-image-btn" type="button" aria-label="Close">{"×"}</button>
                {" "}
              </div>
              <div className="post-image-upload-options">
                {" "}
                <button id="post-upload-local-btn" className="form-button-secondary" type="button">Local Upload</button>
                {" "}
                <button id="post-use-url-btn" className="form-button-secondary" type="button">Image URL</button>
                {" "}
                <FilePicker id="post-local-image-input" accept="image/*" />
                {" "}
              </div>
            </div>
            <div id="post-image-desc-group" className="form-group" style={{ display: "none" }}>
              {" "}
              <label>Image Description (required for the AI)</label>
              {" "}
              <input type="text" id="post-image-description" placeholder="Describe the image for the AI" />
              {" "}
            </div>
          </div>
          <div id="text-image-mode-content" className="post-mode-content">
            <div className="form-group">
              {" "}
              <label>Text Image (description shown when opening the image)</label>
              {" "}
              <textarea id="post-hidden-text" rows={4} placeholder={"Describe the image here…"} />
              {" "}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-create-post-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="confirm-create-post-btn" type="button">Publish</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function PostActionsModal() {
  return (
    <Dialog id="post-actions-modal">
      <div style={{ width: "250px" }} className=" custom-modal-card">
        <div className="custom-modal-footer">
          {" "}
          <button id="edit-post-btn" type="button">Edit Post</button>
          {" "}
          <button id="copy-post-btn" type="button">Copy Content</button>
          {" "}
          <button id="cancel-post-action-btn" type="button">Cancel</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function QzoneStickerPanel() {
  return (
    <div id="qzone-sticker-panel">
      <div id="qzone-sticker-grid" />
    </div>
  )
}

export function RepostModal() {
  return (
    <Dialog id="repost-modal">
      <div style={{ width: "280px" }} className=" custom-modal-card">
        <div className="custom-modal-header">Repost</div>
        <div className="custom-modal-body">
          {" "}
          <textarea id="repost-comment-input" placeholder="Add a comment (optional)" style={{ width: "100%", minHeight: "60px", resize: "vertical", border: "1px solid #ccc", borderRadius: "6px", padding: "8px", fontSize: "1rem", boxSizing: "border-box" }} />
          {" "}
        </div>
        <div className="custom-modal-footer">
          {" "}
          <button id="repost-cancel-btn" type="button">Cancel</button>
          {" "}
          <button id="repost-confirm-btn" className="confirm-btn" type="button">Confirm</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
