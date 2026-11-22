export function CustomModalOverlay() {
  return (
    <div id="custom-modal-overlay">
      <div id="custom-modal">
        <div className="custom-modal-header" id="custom-modal-title" />
        <div className="custom-modal-body" id="custom-modal-body" />
        <div className="custom-modal-footer">
          {" "}
          <button id="custom-modal-cancel" type="button">Cancel</button>
          {" "}
          <button id="custom-modal-confirm" className="confirm-btn" type="button">Confirm</button>
          {" "}
        </div>
      </div>
    </div>
  )
}

export function UpdateNoticeModal() {
  return (
    <div id="update-notice-modal">
      <div className="update-notice-content">
        <div className="update-notice-body" id="update-notice-body">{" "}</div>
        <div className="update-notice-footer">
          {" "}
          <button id="update-notice-confirm-btn" type="button">Got It</button>
          {" "}
          <button id="update-notice-dismiss-btn" type="button">Dismiss</button>
          {" "}
        </div>
      </div>
    </div>
  )
}
