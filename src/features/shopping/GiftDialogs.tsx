import { Dialog } from '../../components/phone'

export function GiftReceiptModal() {
  return (
    <Dialog id="gift-receipt-modal">
      <div className="modal-content">
        <div className="modal-header">
          {" "}
          <span>Receipt</span>
          {" "}
        </div>
        <div className="modal-body" id="gift-receipt-body">{" "}</div>
        <div className="modal-footer">
          {" "}
          <button className="save" id="close-receipt-btn" style={{ width: "100%" }} type="button">Close</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function GiftRecipientModal() {
  return (
    <Dialog id="gift-recipient-modal">
      <div className="modal-content" style={{ height: "70%" }}>
        <div className="modal-header">
          {" "}
          <span>Select Gift Recipient</span>
          {" "}
          <label style={{ fontSize: "0.875rem", fontWeight: "normal", display: "flex", alignItems: "center", gap: "5px" }}>
            {" "}
            <input type="checkbox" id="select-all-recipients" />
            {" Select All "}
          </label>
          {" "}
        </div>
        <div className="modal-body" id="gift-recipient-list" style={{ padding: "0" }}>{" "}</div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-gift-recipient-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="confirm-gift-recipient-btn" type="button">Send Gift</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
