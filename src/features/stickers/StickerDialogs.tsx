import { Dialog } from '../../components/phone'

export function StickerBindingModal() {
  return (
    <Dialog id="sticker-binding-modal">
      <div className="modal-content" style={{ height: "70%" }}>
        <div className="modal-header">
          <span>Link Category to Chats</span>
        </div>
        <div className="modal-body" id="sticker-binding-chat-list" style={{ padding: "0" }} />
        <div className="modal-footer">
          <button className="cancel" id="cancel-sticker-binding-btn" type="button">Cancel</button>
          <button className="save" id="save-sticker-binding-btn" type="button">Save</button>
        </div>
      </div>
    </Dialog>
  )
}

export function StickerCategoryManagerModal() {
  return (
    <Dialog id="sticker-category-manager-modal">
      <div className="modal-content" style={{ height: "60%" }}>
        <div className="modal-header">
          {" "}
          <span>Manage Sticker Categories</span>
          {" "}
        </div>
        <div className="modal-body">
          <div className="form-group">
            {" "}
            <label>New Category</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {" "}
              <input type="text" id="new-sticker-category-name-input" placeholder={"Enter a category name…"} style={{ flexGrow: "1" }} />
              {" "}
              <button id="add-new-sticker-category-btn" className="form-button" style={{ width: "auto", marginTop: "0", padding: "0 15px" }} type="button">Add</button>
              {" "}
            </div>
          </div>
          <hr style={{ opacity: "0.2" }} />
          <div id="existing-sticker-categories-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{" "}</div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="save" id="close-sticker-category-manager-btn" style={{ width: "100%" }} type="button">Done</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
