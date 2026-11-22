import { Dialog } from '../../components/phone'

export function CallMessageActionsModal() {
  return (
    <Dialog id="call-message-actions-modal">
      <div style={{ width: "250px" }} className=" custom-modal-card">
        <div className="custom-modal-footer">
          {" "}
          <button id="edit-call-message-btn" type="button">Edit</button>
          {" "}
          <button id="delete-call-message-btn" className="btn-danger" type="button">Delete</button>
          {" "}
          <button id="cancel-call-message-action-btn" style={{ marginTop: "8px", borderRadius: "8px", backgroundColor: "#f0f0f0" }} type="button">Cancel</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function CallTranscriptModal() {
  return (
    <Dialog id="call-transcript-modal">
      <div className="modal-content" style={{ height: "70%" }}>
        <div className="modal-header">
          {" "}
          <span id="transcript-modal-title">Call Details</span>
          {" "}
        </div>
        <div className="modal-body" id="call-transcript-modal-body" style={{ backgroundColor: "#f0f2f5" }}>{" "}</div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="delete-transcript-btn" style={{ backgroundColor: "#ff3b30", color: "white", borderColor: "#ff3b30" }} type="button">Delete Record</button>
          {" "}
          <button className="save" id="manual-summarize-btn" style={{ backgroundColor: "#ffc107", borderColor: "#ffc107" }} type="button">Summarize Manually</button>
          <button className="save" id="close-call-transcript-btn" style={{ width: "100%" }} type="button">Close</button>
        </div>
      </div>
    </Dialog>
  )
}

export function IncomingCallModal() {
  return (
    <Dialog id="incoming-call-modal">
      <div className="incoming-call-content">
        {" "}
        <img id="caller-avatar" className="caller-avatar" alt={""} />
        <div id="caller-name" className="caller-name" />
        <div className="caller-text">Incoming video call</div>
        <div className="incoming-call-actions">
          <div className="action-button-wrapper">
            {" "}
            <button id="decline-call-btn" className="call-action-btn decline" type="button" />
            {" "}
            <span>Decline</span>
            {" "}
          </div>
          <div className="action-button-wrapper">
            {" "}
            <button id="accept-call-btn" className="call-action-btn accept" type="button" />
            {" "}
            <span>Answer</span>
            {" "}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
