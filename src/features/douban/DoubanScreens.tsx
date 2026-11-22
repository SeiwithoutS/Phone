import { Screen, ScreenHeader, BackButton } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function DoubanPostDetailScreen() {
  return (
    <Screen id="douban-post-detail-screen">
      <ScreenHeader>
        {" "}
        <BackButton id="douban-detail-back-btn" />
        {" "}
        <span id="douban-post-detail-title">Post Details</span>
        {" "}
        <span style={{ width: "30px" }} />
        {" "}
      </ScreenHeader>
      <div id="douban-detail-content-wrapper" className="list-container">
        <div id="douban-post-detail-body">
          <div className="douban-post-header">
            {" "}
            <img id="douban-detail-avatar" className="douban-post-avatar" alt={""} />
            <div className="douban-author-info">
              <div id="douban-detail-author" className="douban-author-name" />
              <div id="douban-detail-group" className="douban-group-name" />
            </div>
          </div>
          <h2 id="douban-detail-post-title" className="douban-post-title" />
          <div id="douban-detail-content" className="douban-detail-content" />
        </div>
        <div className="douban-comments-section">
          <h4>Replies</h4>
          <div id="douban-detail-comments-list" />
        </div>
      </div>
      <div id="douban-comment-footer" className="post-footer">
        <div className="comment-section">
          {" "}
          <img id="douban-my-comment-avatar" className="comment-avatar" alt={""} />
          {" "}
          <input type="text" id="douban-comment-input" className="comment-input" placeholder={"Write a reply…"} />
          {" "}
        </div>
        {" "}
        <button id="douban-wait-reply-btn" className="douban-feather-btn" title="Continue Discussion" type="button" aria-label="Continue Discussion">
          {" "}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
            <line x1="16" y1="8" x2="2" y2="22" />
            <line x1="17.5" y1="15" x2="9" y2="15" />
          </svg>
          {" "}
        </button>
        {" "}
        <button id="douban-send-comment-btn" className="comment-send-btn" type="button">Send</button>
      </div>
    </Screen>
  )
}

export function DoubanScreen() {
  return (
    <Screen id="douban-screen">
      <ScreenHeader>
        {" "}
        <BackButton onClick={() => showScreen("home-screen")} />
        {" "}
        <span>Douban Groups</span>
        <div className="header-actions">
          {" "}
          <span className="action-btn" id="douban-settings-btn" title="Douban Settings">
            {" "}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.12,4.84c-0.59,0.24-1.12,0.56-1.62,0.94L5.11,4.82c-0.22-0.08-0.47,0-0.59,0.22l-1.92,3.32 c-0.12,0.22-0.07,0.47,0.12,0.61l2.03,1.58C4.84,11.36,4.82,11.68,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.48,2.03 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.48-0.41l0.48-2.03c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
            </svg>
            {" "}
          </span>
          {" "}
          <span className="action-btn" id="douban-cast-select-btn" title="Select Characters">
            {" "}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {" "}
          </span>
          {" "}
          <span className="action-btn" id="regenerate-douban-btn" title="Regenerate Posts">
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
      <div id="douban-posts-list" className="list-container">{" "}</div>
    </Screen>
  )
}
