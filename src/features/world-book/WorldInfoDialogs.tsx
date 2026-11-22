import { Dialog } from '../../components/phone'

export function DeleteWorldBooksModal() {
  return (
    <Dialog id="delete-world-books-modal">
      <div className="modal-content" style={{ height: "70%" }}>
        <div className="modal-header">
          {" "}
          <span>Select World Info to Delete</span>
          {" "}
          <label style={{ fontSize: "14px", fontWeight: "normal", display: "flex", alignItems: "center", gap: "5px" }}>
            {" "}
            <input type="checkbox" id="select-all-world-books-for-clear" />
            {" Select All "}
          </label>
          {" "}
        </div>
        <div className="modal-body" id="delete-world-books-list" style={{ padding: "0" }}>{" "}</div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-delete-world-books-btn" type="button">Cancel</button>
          {" "}
          <button className="save btn-danger" id="confirm-delete-world-books-btn" type="button">Confirm Delete</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function WorldBookCategoryManagerModal() {
  return (
    <Dialog id="world-book-category-manager-modal">
      <div className="modal-content" style={{ height: "60%" }}>
        <div className="modal-header">
          {" "}
          <span>Manage World Info Categories</span>
          {" "}
        </div>
        <div className="modal-body">
          <div className="form-group">
            {" "}
            <label>New Category</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {" "}
              <input type="text" id="new-category-name-input" placeholder={"Enter a category name…"} style={{ flexGrow: "1" }} />
              {" "}
              <button id="add-new-category-btn" className="form-button" style={{ width: "auto", marginTop: "0", padding: "0 15px" }} type="button">Add</button>
              {" "}
            </div>
          </div>
          <hr style={{ opacity: "0.2" }} />
          <div id="existing-categories-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{" "}</div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="save" id="close-category-manager-btn" style={{ width: "100%" }} type="button">Done</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
