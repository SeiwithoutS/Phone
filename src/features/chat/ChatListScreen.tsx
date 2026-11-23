import { BackButton, FilePicker, Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function ChatListScreen() {
  return (
    <Screen id="chat-list-screen">
      <ScreenHeader id="main-chat-list-header">
        {" "}
        <BackButton onClick={() => showScreen("home-screen")} />
        {" "}
        <span id="chat-list-title">Messages</span>
        <div className="header-actions">
          {" "}
          <span className="action-btn" id="add-group-chat-btn" title="Create Group Chat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.5 17.5C19.1569 17.5 20.5 16.1569 20.5 14.5C20.5 12.8431 19.1569 11.5 17.5 11.5C15.8431 11.5 14.5 12.8431 14.5 14.5C14.5 16.1569 15.8431 17.5 17.5 17.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 21L19 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8.5 11.5C10.1569 11.5 11.5 10.1569 11.5 8.5C11.5 6.84315 10.1569 5.5 8.5 5.5C6.84315 5.5 5.5 6.84315 5.5 8.5C5.5 10.1569 6.84315 11.5 8.5 11.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12.5 14.5H4.5C3.39543 14.5 2.5 15.3954 2.5 16.5V18.5H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {" "}
          <button type="button" className="phone-button action-btn" aria-label="Create or import character" onClick={() => showScreen("character-edit-screen")}>+</button>
          {" "}
        </div>
      </ScreenHeader>
      <div id="messages-view" className="chat-list-view active">
        <div id="chat-list">{" "}</div>
      </div>
      <div id="qzone-screen" className="chat-list-view">
        <div className="qzone-header">
          {" "}
          <BackButton id="qzone-back-btn" />
          {" "}
          <span>Friends Feed</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="qzone-more-actions-btn" title="More Actions">{"…"}</span>
            {" "}
          </div>
        </div>
        <div className="qzone-content">
          <div className="qzone-profile-header">
            <div id="qzone-banner-container" className="qzone-banner-container">
              {" "}
              <img id="qzone-banner-img" src="https://files.catbox.moe/r5heyt.gif" alt="Background" />
              {" "}
              <FilePicker id="qzone-banner-input" accept="image/*" />
              {" "}
            </div>
            <div className="qzone-user-info">
              <div id="qzone-avatar-container" className="qzone-avatar-container">
                {" "}
                <img id="qzone-avatar-img" src="https://files.catbox.moe/q6z5fc.jpeg" alt="Avatar" />
                {" "}
                <FilePicker id="qzone-avatar-input" accept="image/*" />
                {" "}
              </div>
              {" "}
              <span id="qzone-nickname">{"{{user}}"}</span>
            </div>
          </div>
          <div className="qzone-actions-bar">
            <div className="action-item" id="create-shuoshuo-btn">
              <span>Posts</span>
            </div>
            <div className="action-item" id="create-post-btn">
              <span>Feed</span>
            </div>
            <div className="action-item" id="open-album-btn">
              <span>Album</span>
            </div>
          </div>
          <div id="qzone-posts-list" />
        </div>
      </div>
      <div id="favorites-view" className="chat-list-view">
        <ScreenHeader>
          {" "}
          <BackButton id="favorites-back-btn" />
          {" "}
          <span>My Favorites</span>
          {" "}
          <span className="action-btn" id="favorites-edit-btn">Edit</span>
          {" "}
        </ScreenHeader>
        <div className="search-bar-container">
          {" "}
          <input type="search" id="favorites-search-input" placeholder={"Search favorites by title, content, or author…"} />
          {" "}
          <button id="favorites-search-clear-btn" className="search-clear-btn" style={{ display: "none" }} type="button" aria-label="Close">{"×"}</button>
          {" "}
        </div>
        <div id="favorites-list" className="list-container">{" "}</div>
        <div id="favorites-action-bar" style={{ display: "none" }}>
          {" "}
          <button id="favorites-delete-selected-btn" className="action-bar-btn" type="button">Delete (0)</button>
          {" "}
        </div>
      </div>
      <div id="memories-view" className="chat-list-view">
        <ScreenHeader>
          {" "}
          <BackButton id="memories-back-btn" />
          {" "}
          <span>Our Memories</span>
          {" "}
          <span className="action-btn" id="add-countdown-btn">+</span>
          {" "}
        </ScreenHeader>
        <div id="memories-list" className="list-container" style={{ padding: "15px", display: "flex", flexDirection: "column", gap: "15px" }}>{" "}</div>
      </div>
      <div id="npc-list-view" className="chat-list-view">
        <ScreenHeader>
          {" "}
          <BackButton id="npc-list-back-btn" />
          {" "}
          <span>NPC List</span>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="add-npc-btn">+</span>
            {" "}
          </div>
        </ScreenHeader>
        <div id="npc-list" className="list-container" style={{ padding: "0" }}>{" "}</div>
      </div>
      <div id="chat-list-bottom-nav">
        <div className="nav-item active" data-view="messages-view">
          {" "}
          <span>Messages</span>
          {" "}
        </div>
        <div className="nav-item" data-view="qzone-screen">
          {" "}
          <span>Feed</span>
          {" "}
        </div>
        <div className="nav-item" data-view="memories-view">
          {" "}
          <span>Memories</span>
          {" "}
        </div>
        <div className="nav-item" data-view="favorites-view">
          {" "}
          <span>Save to Favorites</span>
          {" "}
        </div>
        <div className="nav-item" data-view="npc-list-view">
          {" "}
          <span>NPC</span>
          {" "}
        </div>
      </div>
    </Screen>
  )
}
