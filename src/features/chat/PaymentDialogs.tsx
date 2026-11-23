import { Dialog, FormField } from '../../components/phone'

export function RedPacketDetailsModal() {
  return (
    <Dialog id="red-packet-details-modal">
      <div className="modal-content" style={{ width: "280px", height: "auto", backgroundColor: "#f7f7f7" }}>
        <div className="modal-header" style={{ backgroundColor: "#F96259", color: "white", borderBottom: "none", paddingBottom: "5px" }}>
          <div style={{ textAlign: "center", width: "100%" }}>
            <div id="rp-details-sender" style={{ fontSize: "16px" }} />
            <div style={{ fontSize: "13px", opacity: "0.8" }}>{"’s Red Envelope"}</div>
          </div>
        </div>
        <div className="modal-body" style={{ padding: "15px" }}>
          <p id="rp-details-greeting" style={{ textAlign: "center", fontSize: "20px", color: "#333", margin: "0 0 20px 0" }} />
          <div id="rp-details-my-amount" style={{ textAlign: "center", display: "none", marginBottom: "20px" }}>
            {" "}
            <span style={{ fontSize: "40px", fontWeight: "bold", color: "#E44D44" }}>0.00</span>
            {" "}
            <span style={{ fontSize: "18px", color: "#E44D44" }}>yuan</span>
            {" "}
          </div>
          <div id="rp-details-summary" style={{ fontSize: "13px", color: "#8a8a8a", borderTop: "1px solid #e0e0e0", paddingTop: "10px" }} />
          <div id="rp-details-list" style={{ maxHeight: "150px", overflowY: "auto", marginTop: "10px" }}>{" "}</div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="save" id="close-rp-details-btn" style={{ width: "100%" }} type="button">Close</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function RedPacketModal() {
  return (
    <Dialog id="red-packet-modal">
      <div className="modal-content" style={{ width: "300px", height: "auto" }}>
        <div className="modal-header">
          {" "}
          <span>Send Red Envelope</span>
          {" "}
        </div>
        <div className="modal-body" style={{ padding: "0" }}>
          <div className="frame-tabs">
            <div id="rp-tab-group" className="frame-tab active">Random Split</div>
            <div id="rp-tab-direct" className="frame-tab">Direct Envelope</div>
          </div>
          <div id="rp-content-group" className="frame-content" style={{ padding: "20px 15px" }}>
            <div className="form-group">
              {" "}
              <label>{"Total Amount (¥)"}</label>
              {" "}
              <input type="number" id="rp-group-amount" placeholder="0.00" />
              {" "}
            </div>
            <div className="form-group">
              {" "}
              <label>Number of Envelopes</label>
              {" "}
              <input type="number" id="rp-group-count" placeholder="Enter the number of envelopes" />
              {" "}
            </div>
            <div className="form-group">
              {" "}
              <label>Greeting</label>
              {" "}
              <input type="text" id="rp-group-greeting" placeholder={"Wishing you luck and prosperity!"} />
              {" "}
            </div>
            <p id="rp-group-total" style={{ textAlign: "center", fontSize: "24px", fontWeight: "bold", margin: "10px 0" }}>{"¥ 0.00"}</p>
            {" "}
            <button id="send-group-packet-btn" className="form-button" type="button">Fill Red Envelope</button>
          </div>
          <div id="rp-content-direct" className="frame-content" style={{ display: "none", padding: "20px 15px" }}>
            <div className="form-group">
              {" "}
              <label>Send To</label>
              {" "}
              <select id="rp-direct-receiver" />
              {" "}
            </div>
            <div className="form-group">
              {" "}
              <label>{"Amount (¥)"}</label>
              {" "}
              <input type="number" id="rp-direct-amount" placeholder="0.00" />
              {" "}
            </div>
            <div className="form-group">
              {" "}
              <label>Greeting</label>
              {" "}
              <input type="text" id="rp-direct-greeting" placeholder={"Wishing you luck and prosperity!"} />
              {" "}
            </div>
            <p id="rp-direct-total" style={{ textAlign: "center", fontSize: "24px", fontWeight: "bold", margin: "10px 0" }}>{"¥ 0.00"}</p>
            {" "}
            <button id="send-direct-packet-btn" className="form-button" type="button">Fill Red Envelope</button>
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: "center" }}>
          {" "}
          <button className="cancel" id="cancel-red-packet-btn" style={{ width: "100%" }} type="button">Cancel</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function TransferActionsModal() {
  return (
    <Dialog id="transfer-actions-modal">
      <div className="transfer-actions-content">
        <div className="transfer-actions-header">Choose an Action</div>
        <div className="transfer-actions-body">
          <p>
            {"You received a transfer from "}
            <strong id="transfer-sender-name" />
            {" ."}
          </p>
        </div>
        <div className="transfer-actions-footer">
          {" "}
          <button id="transfer-action-decline" className="action-btn decline" type="button">Decline</button>
          {" "}
          <button id="transfer-action-accept" className="action-btn accept" type="button">Accept</button>
          {" "}
        </div>
        {" "}
        <button id="transfer-action-cancel" className="cancel-btn" type="button" aria-label="Close">{"×"}</button>
      </div>
    </Dialog>
  )
}

export function TransferModal() {
  return (
    <div id="transfer-modal">
      <div className="transfer-content">
        <div className="transfer-header">Send them a surprise!</div>
        <div className="transfer-input-group">
          {" "}
          <label id="transfer-currency-label" htmlFor="transfer-amount">Transfer Amount</label>
          {" "}
          <input type="number" id="transfer-amount" placeholder="0.00" min="0" step="0.01" />
          {" "}
        </div>
        <div className="transfer-input-group">
          {" "}
          <label htmlFor="transfer-note">Note (optional)</label>
          {" "}
          <input type="text" id="transfer-note" placeholder={"Add a note…"} maxLength={20} />
          {" "}
        </div>
        <div className="transfer-actions">
          {" "}
          <button id="transfer-cancel-btn" type="button">Cancel</button>
          {" "}
          <button id="transfer-confirm-btn" type="button">Confirm Transfer</button>
          {" "}
        </div>
      </div>
    </div>
  )
}

export function WaimaiRequestModal() {
  return (
    <Dialog id="waimai-request-modal">
      <div className="modal-content" style={{ width: "290px" }}>
        <div className="modal-header">
          {" "}
          <span>Start Food Delivery Order</span>
          {" "}
        </div>
        <div className="modal-body">
          <FormField id="waimai-product-info" label="Item Details">
            <input type="text" id="waimai-product-info" placeholder="Example: Mango pomelo sago" />
          </FormField>
          <div className="form-group">
            {" "}
            <label htmlFor="waimai-amount">{"Order Amount (¥)"}</label>
            {" "}
            <input type="number" id="waimai-amount" placeholder="Example: 21" min="0" step="0.01" />
            {" "}
          </div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="save" id="waimai-order-for-ai-btn" type="button">Order for Character</button>
          {" "}
          <button className="save" id="waimai-confirm-btn" type="button">Send Request</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
