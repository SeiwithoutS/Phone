import { Dialog } from '../../components/phone'

export function CharacterProfileModal() {
  return (
    <Dialog id="character-profile-modal">
      <div className="character-profile-content">
        {" "}
        <button id="profile-history-icon-btn" title="View Inner Monologue History" type="button" aria-label="View Inner Monologue History">
          {" "}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          {" "}
        </button>
        <div id="profile-main-content">
          <div id="profile-timestamp" className="thought-header" />
          <div className="thought-content">
            <div className="voice">
              <div className="label">
                {" "}
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                {" Inner Monologue "}
              </div>
              <p id="profile-heartfelt-voice" className="text" />
            </div>
            <div className="jottings">
              <div className="label">
                {" "}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                  <path d="M2 2l7.586 7.586" />
                </svg>
                {" Notes "}
              </div>
              <p id="profile-random-jottings" className="text" />
            </div>
          </div>
        </div>
        <div id="profile-thoughts-history-view">
          <div className="profile-header">
            {" "}
            <span>Inner Monologue History</span>
            {" "}
            <button id="history-back-btn" title="Back" type="button" aria-label="Back">
              {" "}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {" "}
            </button>
            {" "}
          </div>
          <div id="thoughts-history-list" />
        </div>
      </div>
    </Dialog>
  )
}
