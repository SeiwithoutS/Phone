import { Dialog, FormField } from '../../components/phone'

export function AnnouncementActionsModal() {
  return (
    <Dialog id="announcement-actions-modal">
      <div style={{ width: "250px" }} className=" custom-modal-card">
        <div className="custom-modal-footer">
          {" "}
          <button id="announcement-action-pin" type="button">Pin Announcement</button>
          {" "}
          <button id="announcement-action-delete" className="btn-danger" type="button">Delete Announcement</button>
          {" "}
          <button id="announcement-action-cancel" style={{ marginTop: "8px", borderRadius: "8px", backgroundColor: "#f0f0f0" }} type="button">Cancel</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function AnnouncementBoardModal() {
  return (
    <Dialog id="announcement-board-modal">
      <div className="modal-content">
        <div className="modal-header">
          {" "}
          <span>Group Announcements</span>
          {" "}
        </div>
        <div id="announcement-board-content">{" "}</div>
        <div className="modal-footer">
          {" "}
          <button className="save" id="close-announcement-board-btn" style={{ width: "100%" }} type="button">Close</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function CreateCountdownModal() {
  return (
    <Dialog id="create-countdown-modal">
      <div className="modal-content" style={{ height: "auto" }}>
        <div className="modal-header">
          {" "}
          <span>New Countdown</span>
          {" "}
        </div>
        <div className="modal-body">
          <FormField id="countdown-title-input" label="Countdown Title">
            <input type="text" id="countdown-title-input" placeholder="Example: My birthday" />
          </FormField>
          <FormField id="countdown-date-input" label="Date and Time">
            <input type="datetime-local" id="countdown-date-input" />
          </FormField>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-create-countdown-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="confirm-create-countdown-btn" type="button">Save Countdown</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function CreatePollModal() {
  return (
    <Dialog id="create-poll-modal">
      <div className="modal-content" style={{ width: "300px", height: "auto" }}>
        <div className="modal-header">
          {" "}
          <span>Create Poll</span>
          {" "}
        </div>
        <div className="modal-body">
          <FormField id="poll-question-input" label="Poll Question">
            <textarea id="poll-question-input" rows={2} placeholder={"Example: What movie should we watch tonight?"} />
          </FormField>
          <div className="form-group">
            {" "}
            <label>Poll Options (at least 2)</label>
            <div id="poll-options-container" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{" "}</div>
            {" "}
            <button id="add-poll-option-btn" className="form-button form-button-secondary" style={{ marginTop: "12px" }} type="button">+ Add Option</button>
          </div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-create-poll-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="confirm-create-poll-btn" type="button">Create Poll</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
