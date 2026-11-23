import { Dialog } from '../../components/phone'

export function DeleteWorldBooksModal() {
  return (
    <Dialog id="delete-world-books-modal">
      <div className="modal-content" style={{ height: "70%" }}>
        <div className="modal-header">
          {" "}
          <span>Select Mini Prompts to Delete</span>
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
