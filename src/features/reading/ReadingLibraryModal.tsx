import { Dialog } from '../../components/phone'

export function ReadingLibraryModal() {
  return (
    <Dialog id="reading-library-modal">
      <div className="modal-content" style={{ height: "70%" }}>
        <div className="modal-header">
          {" "}
          <span>My Library</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="import-new-book-btn-header" title="Import Book">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {" "}
            </span>
            {" "}
            <span className="action-btn" id="close-reading-library-btn-header" title="Close">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              {" "}
            </span>
            {" "}
          </div>
        </div>
        <div id="reading-library-search-container">
          {" "}
          <input type="search" id="reading-library-search-input" placeholder={"Search book titles…"} />
          {" "}
        </div>
        <div className="modal-body" style={{ padding: "0", flexGrow: "1", overflowY: "auto" }}>
          <div id="reading-library-list">{" "}</div>
        </div>
      </div>
    </Dialog>
  )
}
