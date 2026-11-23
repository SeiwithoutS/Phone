import { ChatSessions } from './ChatSessions'
import { useNavigate } from 'react-router-dom'
import { screenPaths } from '../../app/routes'
import { runtime } from '../../legacy/runtime/state.js'
import { BackButton, FilePicker, Screen, ScreenHeader } from '../../components/phone'

export function ChatInterfaceScreen() {
  const navigate = useNavigate()
  return (
    <Screen id="chat-interface-screen">
      <div id="gomoku-overlay">
        <div id="gomoku-content-wrapper">
          {" "}
          <canvas id="gomoku-board" />
          <div id="gomoku-controls">
            {" "}
            <button id="close-gomoku-btn" type="button">Hide Board</button>
            {" "}
          </div>
        </div>
      </div>
      <div id="reading-overlay">
        <div id="reading-restore-btn" style={{ display: "none" }}>{"📖"}</div>
        <div id="reading-window">
          <div className="reading-header">
            {" "}
            <span id="reading-title">No book selected</span>
            <div className="reading-controls">
              {" "}
              <button id="minimize-reading-btn" title="Minimize" style={{ fontSize: "20px", lineHeight: "1" }} type="button" aria-label="Minimize">
                {" "}
                <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {" "}
              </button>
              {" "}
              <button id="open-reading-library-btn" title="Open Library" style={{ fontSize: "22px", lineHeight: "1" }} type="button" aria-label="Open Library">
                {" "}
                <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              {" "}
              <button id="close-reading-btn" title="Close" type="button" aria-label="Close">
                {" "}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                {" "}
              </button>
            </div>
          </div>
          <div id="reading-content">
            <p>
              {"Select Import"}
              <br />
              {"to load a book from a local .txt file or a URL."}
            </p>
          </div>
          <div className="reading-footer">
            {" "}
            <button id="prev-page-btn" type="button">Previous Page</button>
            {" "}
            <span id="page-indicator">0 / 0</span>
            {" "}
            <button id="next-page-btn" type="button">Next Page</button>
            {" "}
          </div>
        </div>
      </div>
      <FilePicker id="book-upload-input" accept=".txt, text/plain" />
      <ScreenHeader>
        <div className="default-controls">
          {" "}
          <BackButton id="back-to-list-btn" />
          <div id="global-lyrics-bar" />
          <div id="chat-header-title-wrapper">
            {" "}
            <span id="chat-header-title">Character</span>
            <div id="chat-header-status">
              {" "}
              <span className="status-dot" />
              {" "}
              <span className="status-text">Online</span>
              {" "}
            </div>
          </div>
          <div className="header-actions">
            {" "}
            <span className="action-btn" id="open-memory-screen-btn" title="Long-Term Memory">
              {" "}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 6L9 9L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 5V19C21 20.1046 20.1046 21 19 21H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {" "}
            </span>
            {" "}
            <span className="action-btn" id="listen-together-btn" title="Listen Together">
              <img src="https://i.postimg.cc/dV8sdNcx/210-20250618115221.png" alt="Listen Together" />
            </span>
            {" "}
            <ChatSessions />
            <span className="action-btn" id="chat-settings-btn" title="Chat Settings">
              <img src="https://i.postimg.cc/bvPq64cv/CCA834-BA-5-A90-408-D-94-FA-7-EE156-B6-A765.png" alt="Settings" />
            </span>
            {" "}
          </div>
        </div>
        <div className="selection-controls">
          {" "}
          <span id="selection-cancel-btn">Cancel</span>
          {" "}
          <span id="selection-count" />
          <div className="header-actions">
            {" "}
            <span id="selection-screenshot-btn" className="action-btn">Long Screenshot</span>
            {" "}
            <span id="selection-favorite-btn" className="action-btn">Save to Favorites</span>
            {" "}
            <span id="selection-share-btn" className="action-btn">Share</span>
            {" "}
            <span id="selection-soft-delete-btn" className="action-btn">Delete and Notify AI</span>
            <span id="selection-erase-btn" className="action-btn" style={{ color: "#ff3b30" }}>Delete Permanently</span>
            {" "}
          </div>
        </div>
      </ScreenHeader>
      <div id="chat-messages" onClick={event => {
        const target = event.target
        if (!(target instanceof Element)) return
        const card = target.closest<HTMLElement>('[data-kind="share_link"]')
        const chatId = runtime.state.activeChatId
        if (!card?.dataset.timestamp || !chatId) return
        void navigate(screenPaths['browser-screen'], {
          state: { prepared: true, chatId, timestamp: Number(card.dataset.timestamp) },
        })
      }}>
        <div id="typing-indicator">{"Typing…"}</div>
      </div>
      <div id="chat-input-area">
        <div id="chat-at-mention-popup" className="at-mention-popup" />
        <div id="reply-preview-bar">
          <div className="reply-preview-content">
            <div className="sender">Replying to xxx</div>
            <div className="text">{"Quoted message…"}</div>
          </div>
          {" "}
          <span id="cancel-reply-btn">{"×"}</span>
        </div>
        <div id="chat-input-actions-top">
          {" "}
          <button id="open-sticker-panel-btn" className="chat-action-icon-btn action-button" title="Stickers" type="button" aria-label="Stickers">+</button>
          {" "}
          <button id="send-photo-btn" className="chat-action-icon-btn action-button" title="Send Photo" type="button" aria-label="Send Photo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          {" "}
          <button id="upload-image-btn" className="chat-action-icon-btn action-button" title="Upload Image" type="button" aria-label="Upload Image">
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 3.5H3C2.44772 3.5 2 3.94772 2 4.5V19.5C2 20.0523 2.44772 20.5 3 20.5H21C21.5523 20.5 22 20.0523 22 19.5V4.5C22 3.94772 21.5523 3.5 21 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16.5 13.5C17.6046 13.5 18.5 12.6046 18.5 11.5C18.5 10.3954 17.6046 9.5 16.5 9.5C15.3954 9.5 14.5 10.3954 14.5 11.5C14.5 12.6046 15.3954 13.5 16.5 13.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 14.5L18 10.5L10.3333 18.5M12.5 16L9 12.5L2 19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {" "}
          </button>
          {" "}
          <button id="transfer-btn" className="chat-action-icon-btn action-button" title="Transfer" type="button" aria-label="Transfer">{"￥"}</button>
          {" "}
          <button id="voice-message-btn" className="chat-action-icon-btn action-button" title="Send Voice Message" type="button" aria-label="Send Voice Message">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <path d="M12 19v4" />
              <path d="M8 23h8" />
            </svg>
          </button>
          {" "}
          <button id="send-waimai-request-btn" className="chat-action-icon-btn action-button" title="Request Food Delivery" type="button" aria-label="Request Food Delivery">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </button>
          {" "}
          <button id="video-call-btn" className="chat-action-icon-btn action-button" title="Video Call" type="button" aria-label="Video Call">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
          {" "}
          <button id="group-video-call-btn" className="chat-action-icon-btn action-button" title="Group Video Call" type="button" aria-label="Group Video Call">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
          {" "}
          <button id="send-poll-btn" className="chat-action-icon-btn action-button" title="Create Poll" type="button" aria-label="Create Poll">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6h10" />
              <path d="M6 6h.01" />
              <path d="M8 12h10" />
              <path d="M6 12h.01" />
              <path d="M8 18h10" />
              <path d="M6 18h.01" />
            </svg>
          </button>
          {" "}
          <button id="share-link-btn" className="chat-action-icon-btn action-button" title="Share Link" type="button" aria-label="Share Link">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" />
            </svg>
          </button>
          {" "}
          <button id="share-location-btn" className="chat-action-icon-btn action-button" title="Share Location" type="button" aria-label="Share Location">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </button>
          {" "}
          <button id="gomoku-btn" className="chat-action-icon-btn action-button" title="Gomoku" type="button" aria-label="Gomoku">
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="12" cy="12" r="7" />
            </svg>
            {" "}
          </button>
          {" "}
          <button id="open-shopping-btn" className="chat-action-icon-btn action-button" title="Shopping" type="button" aria-label="Shopping">
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {" "}
          </button>
          {" "}
          <button id="pat-btn" className="chat-action-icon-btn action-button" title="Nudge" style={{ display: "none" }} type="button" aria-label="Nudge">
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 5.02c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14.5 11.02c0 .83-.67 1.5-1.5 1.5v0c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5v0c.83 0 1.5.67 1.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 14.52l-1.92-1.92c-.34-.34-.34-.89 0-1.23l3.58-3.58c.34-.34.89-.34 1.23 0l1.92 1.92c.34.34.34.89 0 1.23l-3.58 3.58c-.34.34-.89.34-1.23 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {" "}
          </button>
          {" "}
          <button id="edit-last-response-btn" className="chat-action-icon-btn action-button" title={"Director Mode · Edit the last AI response"} type="button" aria-label={"Director Mode · Edit the last AI response"}>
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            {" "}
          </button>
          {" "}
          <button id="regenerate-btn" className="chat-action-icon-btn action-button" title="Regenerate Reply" style={{ display: "flex" }} type="button" aria-label="Regenerate Reply">
            {" "}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
            </svg>
            {" "}
          </button>
          {" "}
          <button id="propel-btn" className="chat-action-icon-btn action-button" title="Advance the Story" style={{ display: "flex" }} type="button" aria-label="Advance the Story">
            {" "}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 19 22 12 13 5 13 19" />
              <polygon points="2 19 11 12 2 5 2 19" />
            </svg>
            {" "}
          </button>
          {" "}
          <button id="show-announcement-board-btn" className="chat-action-icon-btn action-button" title="Group Announcements" style={{ display: "none" }} type="button" aria-label="Group Announcements">
            {" "}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.782 6.132a1 1 0 0 0-1.053-.08l-4.729 2.489a1 1 0 0 0-.5.88v4.158a1 1 0 0 0 .5.88l4.729 2.489a1 1 0 0 0 1.053-.08a1 1 0 0 0 .499-.921V7.052a1 1 0 0 0-.499-.92zm-6 3.207L11 7.05v9.9l4.782-2.281V9.339zM10 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6V6z" />
            </svg>
            {" "}
          </button>
          <button id="read-together-btn" className="chat-action-icon-btn action-button" title="Read Together" type="button" aria-label="Read Together">
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </button>
          {" "}
        </div>
        <div id="chat-input-main-row">
          {" "}
          <textarea id="chat-input" rows={1} placeholder={"Type a message…"} />
          <div id="input-actions-wrapper">
            {" "}
            <button id="wait-reply-btn" title="Generate Reply" type="button" aria-label="Generate Reply">
              <img src="https://i.postimg.cc/q72zq80N/ECE92-BBC-BE57-48-E9-BB2-C-345-B6019-C4-B2.png" alt="Generate Reply" />
            </button>
            {" "}
            <button id="send-btn" className="action-button" type="button">Send</button>
            {" "}
          </div>
        </div>
      </div>
      <div id="chat-lock-overlay">
        <div id="chat-lock-content" />
      </div>
      <div id="sticker-panel">
        <div id="sticker-panel-header">
          {" "}
          <span className="panel-btn" id="close-sticker-panel-btn">Cancel</span>
          {" "}
          <span className="title">My Stickers</span>
          <div style={{ display: "flex", gap: "10px" }}>
            {" "}
            <span className="panel-btn" id="manage-sticker-categories-btn">Category</span>
            {" "}
            <span className="panel-btn" id="manage-stickers-btn">Manage</span>
            {" "}
            <span className="panel-btn" id="add-sticker-batch-btn">Batch Import</span>
            {" "}
            <span className="panel-btn" id="upload-sticker-btn">Upload</span>
            {" "}
          </div>
        </div>
        <div id="sticker-category-tabs" />
        <div id="sticker-search-container">
          {" "}
          <input type="search" id="sticker-search-input" placeholder={"Search stickers…"} />
        </div>
        <div id="sticker-grid" />
        <div id="sticker-action-bar">
          {" "}
          <label className="select-all-label" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {" "}
            <input type="checkbox" id="select-all-stickers-checkbox" />
            {" Select All "}
          </label>
          {" "}
          <button id="delete-selected-stickers-btn" type="button">Delete (0)</button>
          {" "}
        </div>
      </div>
      {" "}
      <FilePicker id="sticker-upload-input" accept="image/*" />
      {" "}
      <FilePicker id="image-upload-input" accept="image/*" />
      <div id="music-player-overlay">
        <div className="music-player-window">
          <div className="music-player-top-actions">
            <div className="top-left-cluster">
              {" "}
              <button id="music-return-btn" type="button" aria-label="Back">{"‹"}</button>
              {" "}
              <button id="music-exit-btn" type="button" aria-label="Close">{"×"}</button>
              {" "}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              {" "}
              <button id="toggle-fullscreen-btn" title="Toggle Fullscreen" type="button" aria-label="Toggle Fullscreen">
                {" "}
                <svg className="icon-maximize" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                {" "}
                <svg className="icon-minimize" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
                {" "}
              </button>
              {" "}
              <span id="music-playlist-btn">{"☰"}</span>
              {" "}
            </div>
          </div>
          <div id="music-player-avatar-display">{" "}</div>
          <div id="music-info-top">
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
              <div id="music-time-counter">Listened together for 0.0 hours</div>
              {" "}
              <button id="show-avatars-btn" title="Show or Hide Avatars" type="button" aria-label="Show or Hide Avatars">
                {" "}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {" "}
              </button>
            </div>
            <div id="music-player-song-title">Add a song to begin</div>
            <div id="music-player-artist">...</div>
          </div>
          <div id="music-visual-container">
            <div id="vinyl-view">
              {" "}
              <img id="music-player-cover" src="https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1757748720126_qdqqd_1jt5sv.jpeg" alt="Album Art" />
              {" "}
            </div>
            <div id="inline-lyrics-view">
              <div id="music-lyrics-container">
                <div id="music-lyrics-list">{" "}</div>
              </div>
            </div>
          </div>
          <div id="single-lyric-display">{"♪ ♪ ♪"}</div>
          <div className="music-player-controls-wrapper">
            <div className="music-progress-bar-container">
              <div id="music-current-time" className="time-display">0:00</div>
              <div className="progress-bar">
                <div id="music-progress-fill" className="progress-bar-fill" />
              </div>
              <div id="music-total-time" className="time-display">0:00</div>
            </div>
            <div className="music-controls">
              {" "}
              <button id="music-prev-btn" type="button">{"◀"}</button>
              {" "}
              <button id="music-play-pause-btn" className="play-pause-btn" type="button">{"▶"}</button>
              {" "}
              <button id="music-next-btn" type="button">{"▶"}</button>
              {" "}
              <button id="music-mode-btn" type="button">In order</button>
              {" "}
              <button id="toggle-blur-btn" title="Toggle Background Blur" type="button" aria-label="Toggle Background Blur">Clear</button>
            </div>
          </div>
        </div>
      </div>
      <div id="music-playlist-panel">
        <div className="playlist-header">
          {" "}
          <span className="panel-btn" id="close-playlist-btn">Back</span>
          {" "}
          <span>Playlist</span>
          <div>
            {" "}
            <span className="panel-btn" id="cleanup-songs-btn">Clean Up</span>
            {" "}
            <span className="panel-btn" id="add-song-local-btn">Local</span>
            {" "}
            <span className="panel-btn" id="add-song-url-btn">URL</span>
            {" "}
            <span className="panel-btn" id="add-song-search-btn">Search</span>
            {" "}
          </div>
        </div>
        <div className="playlist-body" id="playlist-body" />
      </div>
      {" "}
      <FilePicker id="local-song-upload-input" accept="audio/*" multiple />
      {" "}
      <FilePicker id="lrc-upload-input" accept=".lrc" />
    </Screen>
  )
}
