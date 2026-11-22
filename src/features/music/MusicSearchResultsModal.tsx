import { Dialog } from '../../components/phone'

export function MusicSearchResultsModal() {
  return (
    <Dialog id="music-search-results-modal">
      <div className="modal-content" style={{ height: "70%" }}>
        <div className="modal-header">
          {" "}
          <span>Search Results</span>
          {" "}
          <label style={{ fontSize: "14px", fontWeight: "normal", display: "flex", alignItems: "center", gap: "5px" }}>
            {" "}
            <input type="checkbox" id="select-all-music-search" />
            {" Select All "}
          </label>
          {" "}
        </div>
        <div className="modal-body" id="search-results-list" style={{ padding: "0" }}>{" "}</div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-music-search-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="add-selected-music-btn" type="button">Add Selected</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
