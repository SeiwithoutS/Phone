export function StatusBar() {
  return (
    <div id="status-bar">
      {" "}
      <span id="status-bar-time">12:00</span>
      <div id="status-bar-battery" className="battery-container">
        {" "}
        <span className="battery-text">{"--%"}</span>
        <div className="battery-icon">
          <div className="battery-level" />
        </div>
      </div>
    </div>
  )
}

export function BatteryAlertModal() {
  return (
    <div id="battery-alert-modal">
      <div className="battery-alert-content">
        {" "}
        <img id="battery-alert-image" alt={""} />
        <p id="battery-alert-text" />
      </div>
    </div>
  )
}

export function NotificationBar() {
  return (
    <div id="notification-bar">
      <img id="notification-avatar" alt={""} />
      <div id="notification-content">
        <div className="name" />
        <div className="message" />
      </div>
    </div>
  )
}
