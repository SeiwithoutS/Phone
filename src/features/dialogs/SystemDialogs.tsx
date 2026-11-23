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
