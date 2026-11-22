import { BackButton, Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function CharacterSelectionScreen() {
  return (
    <Screen id="character-selection-screen">
      <ScreenHeader>
        {" "}
        <BackButton onClick={() => showScreen("home-screen")} />
        {" "}
        <span>Select a character phone</span>
        {" "}
        <span style={{ width: "30px" }} />
        {" "}
      </ScreenHeader>
      <div id="character-grid" className="list-container">{" "}</div>
    </Screen>
  )
}
