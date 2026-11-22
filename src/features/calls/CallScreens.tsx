import { BackButton, Screen, ScreenHeader } from '../../components/phone'

export function CallHistoryScreen() {
  return (
    <Screen id="call-history-screen">
      <ScreenHeader>
        {" "}
        <BackButton id="call-history-back-btn" />
        {" "}
        <span id="call-history-title">Call History</span>
        {" "}
        <span style={{ width: "30px" }} />
        {" "}
      </ScreenHeader>
      <div id="call-history-list" className="list-container" style={{ padding: "15px", display: "flex", flexDirection: "column", gap: "15px" }}>{" "}</div>
    </Screen>
  )
}

export function OutgoingCallScreen() {
  return (
    <Screen id="outgoing-call-screen">
      <div className="outgoing-call-content">
        {" "}
        <img id="outgoing-call-avatar" className="caller-avatar" alt={""} />
        <div id="outgoing-call-name" className="caller-name" />
        <div className="caller-text">{"Calling…"}</div>
        <div className="outgoing-call-actions">
          {" "}
          <button id="cancel-call-btn" className="call-action-btn decline" type="button" />
          {" "}
          <span>Cancel</span>
          {" "}
        </div>
      </div>
    </Screen>
  )
}

export function VideoCallScreen() {
  return (
    <Screen id="video-call-screen">
      <div className="video-call-top-bar">
        {" "}
        <span id="call-timer">00:00</span>
        {" "}
      </div>
      <div className="video-call-avatar-area">
        <div id="participant-avatars-grid">{" "}</div>
      </div>
      <div id="video-call-main" className="video-call-main">{" "}</div>
      <div className="video-call-controls">
        {" "}
        <button id="user-speak-btn" className="control-btn speak-btn" type="button" />
        {" "}
        <button id="hang-up-btn" className="control-btn hangup-btn" type="button" />
        {" "}
        <button id="regenerate-call-btn" className="control-btn regenerate-btn" type="button" />
        {" "}
        <button id="join-call-btn" className="control-btn join-btn" style={{ display: "none" }} type="button" />
        {" "}
      </div>
    </Screen>
  )
}
