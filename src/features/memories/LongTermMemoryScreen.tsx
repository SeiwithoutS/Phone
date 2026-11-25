import { PhoneFeatureHeader, Screen } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function LongTermMemoryScreen() {
  return (
    <Screen id="long-term-memory-screen" className="phone-feature">
      <PhoneFeatureHeader title="Long-Term Memory" onBack={() => showScreen('chat-settings-screen', { chatSettingsTab: 'Features' })} />
      <div className="phone-app-scroll phone-app-stack">
        <div className="phone-app-actions" role="group" aria-label="Memory actions">
          <button className="phone-app-button" type="button" id="refine-memory-btn-header">Refine</button>
          <button className="phone-app-button" type="button" id="summarize-recent-btn-header">Summarize</button>
          <button className="phone-app-button" type="button" id="add-manual-memory-btn-header">Add memory</button>
        </div>
        <div className="phone-app-stack" id="memory-list-container" />
      </div>
    </Screen>
  )
}
