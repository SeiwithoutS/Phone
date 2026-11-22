import { AppShortcut, BackButton, Dialog, Screen, ScreenHeader, activateOnKey } from '../../components/phone'
import { screenActions } from '../../app/actions'

export function CharacterPhoneScreen() {
  return (
    <Screen id="character-phone-screen">
      <div id="char-home-screen" className="char-screen active">
        <div id="char-clock-container">
          <div id="char-main-time">12:00</div>
          <div id="char-main-date">Monday, January 1</div>
        </div>
        <div id="char-app-grid">
          <div className="app-row">
            <AppShortcut className="app-icon" onClick={() => { void screenActions.openCharApp("qq") }}>
              <div className="icon-bg">
                <img id="cphone-icon-img-qq" alt={""} />
              </div>
              <span className="label">QQ</span>
            </AppShortcut>
            <AppShortcut className="app-icon" onClick={() => { void screenActions.openCharApp("album") }}>
              <div className="icon-bg">
                <img id="cphone-icon-img-album" alt={""} />
              </div>
              <span className="label">Album</span>
            </AppShortcut>
            <AppShortcut className="app-icon" onClick={() => { void screenActions.openCharApp("browser") }}>
              <div className="icon-bg">
                <img id="cphone-icon-img-browser" alt={""} />
              </div>
              <span className="label">Browser</span>
            </AppShortcut>
            <AppShortcut className="app-icon" onClick={() => { void screenActions.openCharApp("taobao") }}>
              <div className="icon-bg">
                <img id="cphone-icon-img-taobao" alt={""} />
              </div>
              <span className="label">Shopping</span>
            </AppShortcut>
          </div>
          <div className="app-row">
            <AppShortcut className="app-icon" onClick={() => { void screenActions.openCharApp("memo") }}>
              <div className="icon-bg">
                <img id="cphone-icon-img-memo" alt={""} />
              </div>
              <span className="label">Notes</span>
            </AppShortcut>
            <AppShortcut className="app-icon" onClick={() => { void screenActions.openCharApp("diary") }}>
              <div className="icon-bg">
                <img id="cphone-icon-img-diary" alt={""} />
              </div>
              <span className="label">Diary</span>
            </AppShortcut>
            <AppShortcut className="app-icon" onClick={() => { void screenActions.openCharApp("amap") }}>
              <div className="icon-bg">
                <img id="cphone-icon-img-amap" alt={""} />
              </div>
              <span className="label">Maps</span>
            </AppShortcut>
            <AppShortcut className="app-icon" onClick={() => { void screenActions.openCharApp("usage") }}>
              <div className="icon-bg">
                <img id="cphone-icon-img-usage" alt={""} />
              </div>
              <span className="label">App Activity</span>
            </AppShortcut>
          </div>
          <div className="app-row">
            <AppShortcut className="app-icon" onClick={() => { void screenActions.openCharApp("music") }}>
              <div className="icon-bg">
                <img id="cphone-icon-img-music" alt={""} />
              </div>
              <span className="label">Music</span>
            </AppShortcut>
            <AppShortcut className="app-icon" onClick={() => { void screenActions.switchToMyPhone() }}>
              <div className="icon-bg">
                <img id="cphone-icon-img-ephone" alt={""} />
              </div>
              <span className="label">Ephone</span>
            </AppShortcut>
          </div>
        </div>
      </div>
      <div id="char-amap-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton onClick={() => { void screenActions.switchToCharHomeScreen() }} />
          {" "}
          <span>Location History</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="regenerate-char-amap-btn" title="Regenerate location history">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
              </svg>
              {" "}
            </span>
            {" "}
          </div>
        </ScreenHeader>
        <div id="char-amap-list" className="list-container">{" "}</div>
      </div>
      <div id="char-qq-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton onClick={() => { void screenActions.switchToCharHomeScreen() }} />
          {" "}
          <span>QQ</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="regenerate-char-qq-btn" title="Regenerate">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
              </svg>
              {" "}
            </span>
            {" "}
          </div>
        </ScreenHeader>
        <div id="char-chat-list" className="list-container" />
      </div>
      <div id="char-qq-conversation-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton id="back-to-char-qq-list-btn" />
          {" "}
          <span id="char-conversation-partner-name" />
          {" "}
          <span style={{ width: "30px" }} />
          {" "}
        </ScreenHeader>
        <div id="char-conversation-messages" className="list-container">{" "}</div>
        <div id="char-conversation-input-area" style={{ padding: "8px", borderTop: "1px solid var(--border-color)", display: "flex", gap: "8px", backgroundColor: "#f7f7f7" }}>
          {" "}
          <input type="text" id="char-simulated-input" placeholder={"Simulated conversation · read only"} disabled style={{ flexGrow: "1", padding: "10px", borderRadius: "6px", border: "1px solid #ddd", background: "#eee" }} />
          {" "}
          <button id="char-simulated-send-btn" style={{ padding: "0 20px", border: "none", backgroundColor: "var(--accent-color)", color: "white", borderRadius: "6px", fontWeight: "500" }} type="button">Send</button>
          {" "}
        </div>
      </div>
      <div id="char-album-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton onClick={() => { void screenActions.switchToCharHomeScreen() }} />
          {" "}
          <span>Character Album</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="regenerate-char-album-btn" title="Regenerate album">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
              </svg>
              {" "}
            </span>
            {" "}
          </div>
        </ScreenHeader>
        <div className="list-container">
          <div id="char-album-grid" />
        </div>
      </div>
      <div id="char-browser-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton onClick={() => { void screenActions.switchToCharHomeScreen() }} />
          {" "}
          <span>Browser History</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="regenerate-char-browser-btn" title="Regenerate browser history">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
              </svg>
              {" "}
            </span>
            {" "}
          </div>
        </ScreenHeader>
        <div id="char-browser-history" className="list-container">{" "}</div>
      </div>
      <div id="char-browser-article-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton onClick={() => { void screenActions.switchToCharScreen("char-browser-screen") }} />
          {" "}
          <span id="char-article-title" style={{ maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Article</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="favorite-article-btn" title="Save to Favorites">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {" "}
            </span>
            {" "}
          </div>
        </ScreenHeader>
        <div id="char-article-content" className="list-container" style={{ padding: "20px", fontSize: "16px", lineHeight: "1.8", overflowY: "auto" }} />
      </div>
      <div id="char-taobao-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton onClick={() => { void screenActions.switchToCharHomeScreen() }} />
          {" "}
          <span>Shopping Orders</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="char-wallet-btn" title="View Wallet" onClick={() => { void screenActions.openCharWallet() }} onKeyDown={activateOnKey} role="button" tabIndex={0}>
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12V8H4v4" />
                <path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
                <path d="M18 12v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6" />
              </svg>
              {" "}
            </span>
            {" "}
            <span className="action-btn" id="regenerate-char-taobao-btn" title="Regenerate shopping history">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
              </svg>
              {" "}
            </span>
            {" "}
          </div>
        </ScreenHeader>
        <div id="char-product-grid" className="list-container" />
      </div>
      <div id="char-wallet-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton id="char-wallet-back-btn" />
          {" "}
          <span>Wallet</span>
          {" "}
          <span style={{ width: "30px" }} />
          {" "}
        </ScreenHeader>
        <div id="char-wallet-content" className="list-container" style={{ padding: "15px", display: "flex", flexDirection: "column", gap: "15px" }}>{" "}</div>
      </div>
      <div id="char-memo-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton onClick={() => { void screenActions.switchToCharHomeScreen() }} />
          {" "}
          <span>Notes</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="regenerate-char-memo-btn" title="Regenerate notes">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
              </svg>
              {" "}
            </span>
            {" "}
            <span className="action-btn" id="add-char-memo-btn">+</span>
            {" "}
          </div>
        </ScreenHeader>
        <div id="char-memo-list" className="list-container" style={{ padding: "10px" }} />
      </div>
      <div id="char-memo-detail-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton id="char-memo-detail-back-btn" />
          {" "}
          <span id="char-memo-detail-title" />
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="favorite-memo-btn" title="Save to Favorites">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {" "}
            </span>
            {" "}
          </div>
        </ScreenHeader>
        <div className="form-container" style={{ padding: "0" }}>
          {" "}
          <textarea id="char-memo-detail-content" readOnly />
          {" "}
        </div>
      </div>
      <div id="char-diary-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton onClick={() => { void screenActions.switchToCharHomeScreen() }} />
          {" "}
          <span>Diary</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="regenerate-char-diary-btn" title="Regenerate diary">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
              </svg>
              {" "}
            </span>
            {" "}
            <span className="action-btn" id="add-char-diary-btn">+</span>
            {" "}
          </div>
        </ScreenHeader>
        <div id="char-diary-list" className="list-container" />
      </div>
      <div id="char-diary-detail-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <span className="back-btn" id="char-diary-detail-back-btn">{"‹ "}</span>
          {" "}
          <span id="char-diary-detail-title" />
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="favorite-diary-btn" title="Save to Favorites">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {" "}
            </span>
            {" "}
          </div>
        </ScreenHeader>
        <div id="char-diary-detail-content-wrapper" className="list-container">
          <div id="char-diary-detail-content">{" "}</div>
        </div>
      </div>
      <div id="char-usage-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton onClick={() => { void screenActions.switchToCharHomeScreen() }} />
          {" "}
          <span>App Usage</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="regenerate-char-usage-btn" title="Regenerate activity">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
              </svg>
              {" "}
            </span>
            {" "}
          </div>
        </ScreenHeader>
        <div id="char-usage-list" className="list-container">{" "}</div>
      </div>
      <Dialog id="char-qq-transcript-modal">
        <div className="modal-content" style={{ height: "80%" }}>
          <div className="modal-header">
            {" "}
            <span id="transcript-modal-char-name" />
            {" "}
          </div>
          <div className="modal-body" id="transcript-modal-body" style={{ backgroundColor: "#f0f2f5", padding: "15px", display: "flex", flexDirection: "column", gap: "15px" }}>{" "}</div>
          <div className="modal-footer">
            {" "}
            <button className="save" id="close-transcript-modal-btn" style={{ width: "100%" }} type="button">Close</button>
            {" "}
          </div>
        </div>
      </Dialog>
      <div id="char-music-screen" className="char-screen">
        <ScreenHeader>
          {" "}
          <BackButton onClick={() => { void screenActions.switchToCharHomeScreen() }} />
          {" "}
          <span>Character Playlist</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="regenerate-char-music-btn" title="Regenerate playlist">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
              </svg>
              {" "}
            </span>
            {" "}
          </div>
        </ScreenHeader>
        <div id="char-music-list" className="list-container">{" "}</div>
      </div>
      <Dialog id="char-music-player-modal">
        <div className="modal-content">
          <div className="char-player-body">
            <div className="char-player-song-info">
              <p id="char-music-player-title">Track Title</p>
              <p id="char-music-artist">Artist</p>
            </div>
            <div id="char-vinyl-container">
              {" "}
              <img id="char-music-cover" alt={""} />
              {" "}
            </div>
            <div id="char-music-lyrics">{" "}</div>
            <div className="char-player-footer">
              <div className="char-player-progress-bar-container">
                {" "}
                <span id="char-music-current-time" className="time-display">0:00</span>
                <div id="char-music-progress-bar" className="char-player-progress-bar">
                  <div id="char-music-progress-fill" />
                </div>
                {" "}
                <span id="char-music-total-time" className="time-display">0:00</span>
              </div>
              <div className="char-player-controls">
                {" "}
                <button id="char-music-prev-btn" className="control-btn" type="button">
                  {" "}
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                  </svg>
                  {" "}
                </button>
                {" "}
                <button id="char-music-play-pause-btn" className="control-btn play" type="button">
                  {" "}
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {" "}
                </button>
                {" "}
                <button id="char-music-next-btn" className="control-btn" type="button">
                  {" "}
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M16 6h2v12h-2zm-3.5 6l-8.5 6V6z" />
                  </svg>
                  {" "}
                </button>
                {" "}
                <button id="char-music-mode-btn" className="control-btn mode" type="button">In order</button>
                {" "}
              </div>
            </div>
          </div>
          {" "}
          <button id="close-char-music-player-btn" className="char-player-close-btn" type="button" aria-label="Close">{"×"}</button>
        </div>
      </Dialog>
    </Screen>
  )
}
