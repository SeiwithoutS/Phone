import { Dialog, FormField } from '../../components/phone'

export function SharedHistoryViewerModal() {
  return (
    <Dialog id="shared-history-viewer-modal">
      <div className="modal-content" style={{ height: "80%" }}>
        <div className="modal-header">
          {" "}
          <span id="shared-history-viewer-title">Chat History</span>
          {" "}
        </div>
        <div className="modal-body" id="shared-history-viewer-content" style={{ backgroundColor: "#f0f2f5" }}>{" "}</div>
        <div className="modal-footer">
          {" "}
          <button className="save" id="close-shared-history-viewer-btn" style={{ width: "100%" }} type="button">Close</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function ShareLinkModal() {
  return (
    <Dialog id="share-link-modal">
      <div className="modal-content" style={{ width: "300px", height: "auto" }}>
        <div className="modal-header">
          {" "}
          <span>Share Link</span>
          {" "}
        </div>
        <div className="modal-body">
          <FormField id="link-title-input" label="Title">
            <input type="text" id="link-title-input" placeholder="Enter the article or link title" />
          </FormField>
          <FormField id="link-description-input" label="Summary (optional)">
            <textarea id="link-description-input" rows={2} placeholder="Briefly describe this link" />
          </FormField>
          <FormField id="link-source-input" label="Source Name (optional)">
            <input type="text" id="link-source-input" placeholder="Example: Daily News" />
          </FormField>
          <FormField id="link-content-input" label="Full Content (optional, for in-app browser)">
            <textarea id="link-content-input" rows={4} placeholder="Paste or enter the full article text" />
          </FormField>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-share-link-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="confirm-share-link-btn" type="button">Share</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function ShareTargetModal() {
  return (
    <Dialog id="share-target-modal">
      <div className="modal-content" style={{ height: "70%" }}>
        <div className="modal-header">
          {" "}
          <span>{"Share to…"}</span>
          {" "}
        </div>
        <div className="modal-body" id="share-target-list" style={{ padding: "0" }}>{" "}</div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-share-target-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="confirm-share-target-btn" type="button">Confirm Share</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
