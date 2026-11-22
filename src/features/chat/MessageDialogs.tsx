import { Dialog } from '../../components/phone'

export function AiResponseEditorModal() {
  return (
    <Dialog id="ai-response-editor-modal">
      <div className="modal-content" style={{ height: "80%" }}>
        <div className="modal-header">
          {" "}
          <span>{"Director Mode · Last AI Response"}</span>
          {" "}
        </div>
        <div className="modal-body" id="ai-response-editor-body">
          <div id="ai-response-editor-container" style={{ display: "flex", flexDirection: "column", gap: "15px" }} />
          {" "}
          <button id="add-ai-response-block-btn" className="form-button form-button-secondary" style={{ marginTop: "15px" }} type="button">{" + Add Action "}</button>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-ai-response-editor-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="save-ai-response-editor-btn" type="button">Apply Changes</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function ChatListActionsModal() {
  return (
    <Dialog id="chat-list-actions-modal">
      <div style={{ width: "250px" }} className=" custom-modal-card">
        <div className="custom-modal-footer">
          {" "}
          <button id="chat-list-action-pin" type="button" />
          {" "}
          <button id="chat-list-action-delete" className="btn-danger" type="button">Delete Chat</button>
          {" "}
          <button id="chat-list-action-cancel" style={{ marginTop: "8px", borderRadius: "8px", backgroundColor: "#f0f0f0" }} type="button">Cancel</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function MessageActionsModal() {
  return (
    <Dialog id="message-actions-modal">
      <div style={{ width: "250px" }} className=" custom-modal-card">
        <div className="custom-modal-footer">
          {" "}
          <button id="edit-message-btn" type="button">Edit Message</button>
          {" "}
          <button id="copy-message-btn" type="button">Copy Text</button>
          {" "}
          <button id="copy-timestamp-btn" type="button">Copy Timestamp</button>
          {" "}
          <button id="recall-message-btn" type="button">Recall</button>
          {" "}
          <button id="publish-to-announcement-btn" style={{ display: "none" }} type="button">Post to Announcements</button>
          <button id="quote-message-btn" type="button">Quote</button>
          {" "}
          <button id="select-message-btn" type="button">Select Messages</button>
          {" "}
          <button id="cancel-message-action-btn" style={{ marginTop: "8px", borderRadius: "8px", backgroundColor: "#f0f0f0" }} type="button">Cancel</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function MessageEditorModal() {
  return (
    <Dialog id="message-editor-modal">
      <div className="modal-content" style={{ height: "75%" }}>
        <div className="modal-header">
          {" "}
          <span>Edit and Split Messages</span>
          {" "}
        </div>
        <div className="modal-body" id="message-editor-body">
          <div id="message-editor-container" />
          {" "}
          <button id="add-message-editor-block-btn" className="form-button form-button-secondary" style={{ marginTop: "15px" }} type="button">{" + Add Another Message "}</button>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-advanced-editor-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="save-advanced-editor-btn" type="button">Save Changes</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
