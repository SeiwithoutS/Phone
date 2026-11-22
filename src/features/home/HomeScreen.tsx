import { AppShortcut, Screen, activateOnKey } from '../../components/phone'
import { showScreen } from '../../app/routes'
import { screenActions } from '../../app/actions'

export function HomeScreen() {
  return (
    <Screen id="home-screen">
      <div id="home-screen-pages-container">
        <div id="home-screen-pages">
          <div className="home-screen-page">
            <div id="main-content-area">
              <div id="profile-widget">
                {" "}
                <img id="profile-banner-img" src="https://i.imgur.com/1n3a43H.jpeg" className="editable-image" alt={""} />
                <div className="profile-avatar-container">
                  {" "}
                  <img id="profile-avatar-img" src="https://i.postimg.cc/y8xWzCqj/anime-boy.jpg" className="editable-image" alt={""} />
                  {" "}
                </div>
                <div className="profile-info">
                  <p id="profile-username" className="editable-text">{"@ insonneve 🪦"}</p>
                  <p id="profile-sub-username" className="editable-text">{"@ insonneve"}</p>
                  <p id="profile-bio" className="editable-text">You seem to be doing well, already erasing every trace of me.</p>
                  <p id="profile-location" className="editable-text">
                    {" "}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5-2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    {" "}
                    <span>Hokkaido</span>
                    {" "}
                  </p>
                </div>
              </div>
              <div id="desktop-layout">
                <div id="desktop-widget-column">
                  <div className="desktop-widget text-only">
                    <p id="widget-text-1" className="editable-text">Be fearless in pursuit of happiness</p>
                  </div>
                  <div className="desktop-widget icon-left">
                    {" "}
                    <img id="widget-avatar-1" src="https://i.imgur.com/1n3a43H.jpeg" className="editable-image" alt={""} />
                    {" "}
                    <span id="widget-text-2" className="editable-text">Dare to be different</span>
                    {" "}
                  </div>
                  <div className="desktop-widget icon-right">
                    {" "}
                    <span id="widget-text-3" className="editable-text">{"* Keep your spirit free"}</span>
                    {" "}
                    <img id="widget-avatar-2" src="https://i.imgur.com/5A0tE9a.jpeg" className="editable-image" alt={""} />
                    {" "}
                  </div>
                </div>
                <div id="desktop-app-container">
                  <AppShortcut className="desktop-app-icon" onClick={() => showScreen("chat-list-screen")}>
                    <div className="icon-bg-desktop">
                      <img id="icon-img-qq" src="https://i.postimg.cc/MTC3Tkw8/IMG-6436.jpg" alt="QQ" />
                    </div>
                    {" "}
                    <span className="label">QQ</span>
                  </AppShortcut>
                  <AppShortcut className="desktop-app-icon" onClick={() => showScreen("world-book-screen")}>
                    <div className="icon-bg-desktop">
                      <img id="icon-img-world-book" src="https://i.postimg.cc/HWf1JKzn/IMG-6435.jpg" alt="World Info" />
                    </div>
                    {" "}
                    <span className="label">World Info</span>
                  </AppShortcut>
                  <AppShortcut className="desktop-app-icon" onClick={() => showScreen("wallpaper-screen")}>
                    <div className="icon-bg-desktop">
                      <img id="icon-img-wallpaper" src="https://i.postimg.cc/T1j03pQr/IMG-6440.jpg" alt="Appearance" />
                    </div>
                    {" "}
                    <span className="label">Appearance</span>
                  </AppShortcut>
                  <AppShortcut className="desktop-app-icon" onClick={() => { void screenActions.openRenderingRulesScreen() }}>
                    <div className="icon-bg-desktop">
                      <img id="icon-img-renderer" src="https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1756312261242_qdqqd_g0eriz.jpeg" alt="Rendering Rules" />
                    </div>
                    {" "}
                    <span className="label">Rendering Rules</span>
                  </AppShortcut>
                </div>
              </div>
            </div>
          </div>
          <div className="home-screen-page">
            <div className="polaroid-widget-container">
              <div className="polaroid-photos">
                <div className="polaroid-photo" style={{ transform: "rotate(-6deg)" }} onClick={() => { void screenActions.handleWidgetImageChange("polaroid-img-1") }} onKeyDown={activateOnKey} role="button" tabIndex={0}>
                  {" "}
                  <img id="polaroid-img-1" src="https://i.imgur.com/Bv63o3h.jpg" alt="Photo 1" />
                  {" "}
                </div>
                <div className="polaroid-photo" style={{ transform: "rotate(2deg)" }} onClick={() => { void screenActions.handleWidgetImageChange("polaroid-img-2") }} onKeyDown={activateOnKey} role="button" tabIndex={0}>
                  {" "}
                  <img id="polaroid-img-2" src="https://i.imgur.com/GzPzBfF.jpg" alt="Photo 2" />
                  {" "}
                </div>
                <div className="polaroid-photo" style={{ transform: "rotate(5deg)" }} onClick={() => { void screenActions.handleWidgetImageChange("polaroid-img-3") }} onKeyDown={activateOnKey} role="button" tabIndex={0}>
                  {" "}
                  <img id="polaroid-img-3" src="https://i.imgur.com/Wp72cEM.jpg" alt="Photo 3" />
                  {" "}
                </div>
              </div>
            </div>
            <div id="page-2-app-container">
              <div className="large-widget" onClick={() => { void screenActions.handleWidgetImageChange("large-widget-img") }} onKeyDown={activateOnKey} role="button" tabIndex={0}>
                {" "}
                <img className="large-widget-img" id="large-widget-img" src="https://i.imgur.com/Bv63o3h.jpg" alt="Colorful Widget" />
                {" "}
              </div>
              <div className="app-subgrid">
                <AppShortcut className="small-widget" onClick={() => { void screenActions.openPresetScreen() }}>
                  <div className="small-widget-icon-wrapper">
                    {" "}
                    <img className="small-widget-img" id="icon-img-preset" src="https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1758510900942_qdqqd_djw0z2.jpeg" alt="Presets" />
                    {" "}
                  </div>
                  {" "}
                  <span className="small-widget-label">Presets</span>
                </AppShortcut>
                <AppShortcut className="small-widget" onClick={() => showScreen("tutorial-screen")}>
                  <div className="small-widget-icon-wrapper">
                    {" "}
                    <img className="small-widget-img" id="icon-img-tutorial" src="https://i.postimg.cc/d10GjC4g/IMG-7302.jpg" alt="Guide" />
                    {" "}
                  </div>
                  {" "}
                  <span className="small-widget-label">Guide</span>
                </AppShortcut>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="home-screen-pagination">
        <div className="pagination-dot active" />
        <div className="pagination-dot" />
      </div>
      <div id="desktop-dock">
        <AppShortcut className="desktop-app-icon" onClick={() => showScreen("api-settings-screen")}>
          <div className="icon-bg-desktop">
            <img id="icon-img-api-settings" src="https://i.postimg.cc/MK8rJ8t7/IMG-6438.jpg" alt="API Connections" />
          </div>
          {" "}
          <span className="label">API Connections</span>
        </AppShortcut>
        <AppShortcut className="desktop-app-icon" onClick={() => showScreen("font-settings-screen")}>
          <div className="icon-bg-desktop">
            <img id="icon-img-font" src="https://i.postimg.cc/pXxk1JXk/IMG-6442.jpg" alt="Fonts" />
          </div>
          {" "}
          <span className="label">Fonts</span>
        </AppShortcut>
        <AppShortcut className="desktop-app-icon" onClick={() => { void screenActions.openCharacterSelector() }}>
          <div className="icon-bg-desktop">
            <img id="icon-img-char-phone" src="https://i.postimg.cc/pXj9h20L/IMG-7275.jpg" alt="Cphone" />
          </div>
          {" "}
          <span className="label">Cphone</span>
        </AppShortcut>
        <AppShortcut className="desktop-app-icon" onClick={() => showScreen("douban-screen")}>
          <div className="icon-bg-desktop">
            <img id="icon-img-douban" src="https://i.postimg.cc/Pq2xJN1g/IMG-7301.jpg" alt="Douban" />
          </div>
          {" "}
          <span className="label">Douban</span>
        </AppShortcut>
      </div>
    </Screen>
  )
}
