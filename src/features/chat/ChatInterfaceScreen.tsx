import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { enterSelectionMode } from '../../legacy/chat/messages.js'
import { closeStickerPicker } from '../../legacy/stickers/stickers.js'
import { ChatTodoDialog } from './ChatTodoDialog'
import { ChatSessions } from './ChatSessions'
import { useNavigate } from 'react-router-dom'
import { screenPaths, showScreen } from '../../app/routes'
import { runtime } from '../../legacy/runtime/state.js'
import { BackButton, FilePicker, Screen, ScreenHeader } from '../../components/phone'
import { Icon, IconButton } from '../../components/icons'
import type { IconName } from '../../components/icons'

const chatTools = [
  ['transfer-btn', 'bank', 'Transfer'],
  ['open-shopping-btn', 'gift', 'Gift'],
  ['propel-btn', 'spark', 'Plot'],
  ['send-poll-btn', 'checklist', 'Vote'],
  ['share-location-btn', 'pin', 'Location'],
  ['send-photo-btn', 'camera', 'Photo description'],
  ['upload-image-btn', 'image', 'Upload image'],
  ['voice-message-btn', 'mic', 'Voice message'],
  ['send-waimai-request-btn', 'bag', 'Request payment'],
  ['video-call-btn', 'video', 'Video call'],
  ['group-video-call-btn', 'users', 'Group call'],
  ['share-link-btn', 'link', 'Share link'],
  ['gomoku-btn', 'game', 'Gomoku'],
  ['pat-btn', 'heart', 'Nudge'],
  ['show-announcement-board-btn', 'bell', 'Announcements'],
  ['read-together-btn', 'book', 'Read together'],
] as const satisfies readonly (readonly [string, IconName, string])[]

export function ChatInterfaceScreen() {
  const navigate = useNavigate()
  const { key } = useLocation()
  const [toolsOpen, setToolsOpen] = useState(false)
  const [todoOpen, setTodoOpen] = useState(false)
  useEffect(() => { setToolsOpen(false); setTodoOpen(false); closeStickerPicker() }, [key])
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
            <span id="qq-branch-status" hidden>Branch</span>
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
            <IconButton icon="music" id="listen-together-btn" label="Listen Together" />
            {" "}
            <IconButton icon="settings" id="chat-settings-btn" label="Chat Settings" />
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
        const order = target.closest<HTMLButtonElement>('[data-market-order]')?.dataset.marketOrder
        if (order && !event.currentTarget.closest('.selection-mode') && runtime.state.activeChatId) {
          void navigate({ pathname: screenPaths['market-screen'], search: new URLSearchParams({ order }).toString() },
            { state: { from: 'chat', chatId: runtime.state.activeChatId } })
          return
        }
        const card = target.closest<HTMLElement>('[data-kind="share_link"]')
        const chatId = runtime.state.activeChatId
        if (!card?.dataset.timestamp || !chatId) return
        void navigate(screenPaths['browser-screen'], {
          state: { prepared: true, chatId, timestamp: Number(card.dataset.timestamp) },
        })
      }}>
        <div id="typing-indicator">{"Typing…"}</div>
      </div>
      <p id="context-stream-preview" aria-live="polite" hidden />
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
        <div className="chat-composer-shortcuts">
          <IconButton icon="smile" id="open-sticker-panel-btn" label="Stickers"
            aria-controls="sticker-panel" aria-expanded="false" onClick={() => setToolsOpen(false)} />
        </div>
        <div id="chat-input-main-row">
          <IconButton icon="plus" id="chat-plus-btn" label="Chat tools" aria-controls="chat-input-actions-top"
            aria-expanded={toolsOpen} onClick={() => {
              document.getElementById("chat-tool-notice")!.textContent = ""
              setToolsOpen(open => !open)
            }} />
          <ChatSessions onOpen={() => setToolsOpen(false)} />
          <textarea id="chat-input" rows={1} onFocus={() => setToolsOpen(false)} placeholder={"Type a message…"} />
          <div id="input-actions-wrapper">
            {" "}
            <button id="wait-reply-btn" title="Generate Reply" type="button" aria-label="Generate Reply">
              <Icon name="spark" />
            </button>
            {" "}
            <IconButton id="send-btn" className="action-button" icon="send" label="Send message" />
            {" "}
          </div>
        </div>
        <p id="chat-tool-notice" role="status" />
        <div id="chat-input-actions-top" hidden={!toolsOpen} onClick={event => {
          if (event.target instanceof Element && event.target.closest("button")) setToolsOpen(false)
        }}>
          {chatTools.map(([id, icon, label]) => <button key={id} id={id} className="chat-action-icon-btn action-button chat-plus-tool" type="button">
            <Icon name={icon} /><span>{label}</span>
          </button>)}
          <button type="button" id="chat-market-tool" className="chat-action-icon-btn chat-plus-tool" onClick={() =>
            showScreen('market-screen', { from: 'chat', chatId: runtime.state.activeChatId ?? undefined, food: true })}>
            <Icon name="bag" /><span>Order delivery</span>
          </button>
          <button type="button" id="chat-screenshot-tool" className="chat-action-icon-btn chat-plus-tool" onClick={() => {
            const last = [...document.querySelectorAll<HTMLElement>('#chat-messages .message-bubble[data-timestamp]')].at(-1)
            if (last?.dataset.timestamp) enterSelectionMode(Number(last.dataset.timestamp))
            else document.getElementById('chat-tool-notice')!.textContent = 'Send a message before taking a screenshot.'
          }}><Icon name="camera" /><span>Screenshot</span></button>
          <button type="button" id="chat-todo-tool" className="chat-action-icon-btn chat-plus-tool" onClick={() => setTodoOpen(true)}>
            <Icon name="list" /><span>To-do list</span>
          </button>
        </div>
      </div>
      {todoOpen && <ChatTodoDialog close={() => setTodoOpen(false)} />}
      <div id="chat-lock-overlay">
        <div id="chat-lock-content" />
      </div>
      <div id="sticker-panel" role="region" aria-label="Sticker picker">
        <div id="sticker-panel-header">
          <IconButton icon="close" id="close-sticker-panel-btn" label="Close sticker picker" />
          <span className="title">Stickers</span>
          <div className="sticker-picker-tools">
            <IconButton icon="upload" id="upload-sticker-btn" label="Quick upload sticker" />
            <IconButton icon="folder" label="Manage sticker library" onClick={() => {
              closeStickerPicker()
              showScreen('sticker-library-screen', { stickerChatId: runtime.state.activeChatId ?? undefined })
            }} />
          </div>
        </div>
        <div id="sticker-category-tabs" />
        <div id="sticker-search-container">
          {" "}
          <input type="search" id="sticker-search-input" aria-label="Search stickers" placeholder="Search stickers…" />
        </div>
        <div id="sticker-grid" />
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
