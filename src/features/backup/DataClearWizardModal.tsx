import { Dialog } from '../../components/phone'

export function DataClearWizardModal() {
  return (
    <Dialog id="data-clear-wizard-modal">
      <div className="modal-content" style={{ height: "80%" }}>
        <div id="data-clear-step-1" className="wizard-step">
          <div className="modal-header">
            {" "}
            <span>{"Step 1 · Select characters"}</span>
            {" "}
            <label>
              {" "}
              <input type="checkbox" id="select-all-chars-for-clear" />
              {" Select All "}
            </label>
            {" "}
          </div>
          <div className="modal-body" id="data-clear-char-list" style={{ padding: "0" }}>{" "}</div>
          <div className="modal-footer">
            {" "}
            <button className="cancel" id="cancel-clear-wizard-btn-step1" type="button">Cancel</button>
            {" "}
            <button className="save" id="go-to-clear-step2-btn" type="button">Next</button>
            {" "}
          </div>
        </div>
        <div id="data-clear-step-2" className="wizard-step" style={{ display: "none" }}>
          <div className="modal-header">
            {" "}
            <span>{"Step 2 · Select data types"}</span>
            {" "}
            <label>
              {" "}
              <input type="checkbox" id="select-all-types-for-clear" />
              {" Select All "}
            </label>
            {" "}
          </div>
          <div className="modal-body" id="data-clear-type-list" style={{ padding: "0" }}>{" "}</div>
          <div className="modal-footer">
            {" "}
            <button className="form-button-secondary" id="back-to-clear-step1-btn" style={{ width: "30%", margin: "0" }} type="button">Back</button>
            {" "}
            <button className="cancel" id="cancel-clear-wizard-btn-step2" style={{ width: "30%", margin: "0" }} type="button">Cancel</button>
            {" "}
            <button className="save btn-danger" id="confirm-final-clear-btn" style={{ width: "30%", margin: "0" }} type="button">Confirm Cleanup</button>
            {" "}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
