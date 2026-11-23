import { BackButton, Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function TutorialScreen() {
  return (
    <Screen id="tutorial-screen">
      <ScreenHeader>
        {" "}
        <BackButton onClick={() => showScreen("home-screen")} />
        {" "}
        <span>Guide</span>
        {" "}
        <span style={{ width: "30px" }} />
        {" "}
      </ScreenHeader>
      <div className="list-container" style={{ padding: "0", overflow: "hidden" }}>
        {" "}
        <article className="guide-content">
          <h2>Getting started</h2>
          <ol>
            <li>Open API Connections and enter your provider's base URL, model, and API key.</li>
            <li>Open QQ to create a character or import a SillyTavern character card.</li>
            <li>Open a chat, send a message, and choose Generate Reply.</li>
            <li>Use World Info to link keyword-triggered lore to a character. Attach Mini Prompts in QQ’s Chat Settings.</li>
          </ol>
          <p>Open Backup and use the download icon to save a ZIP.</p>
        </article>
        {" "}
      </div>
    </Screen>
  )
}
