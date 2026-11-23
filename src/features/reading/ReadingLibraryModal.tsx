import { IconButton } from '../../components/icons'
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
            <IconButton icon="import" id="import-new-book-btn-header" label="Import Book" />
            {" "}
            <IconButton icon="close" id="close-reading-library-btn-header" label="Close" />
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
