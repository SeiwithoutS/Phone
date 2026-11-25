import { IconButton } from '../../components/icons'
import { useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HeaderSaveButton, PhoneFeatureHeader, FilePicker, Screen, ScreenContext } from '../../components/phone'
import { Icon } from '../../components/icons'
import type { IconName } from '../../components/icons'
import { showScreen } from '../../app/routes'
import { useNavigate } from 'react-router-dom'
import { runtime } from '../../legacy/runtime/state.js'
import { DiaryPanel } from './DiaryPanel'
import { LocationFields } from './LocationFields'

const chatThemes = [
  ['default', 'Default', '#b7e6a7', '#ffffff'],
  ['pink_blue', 'Pink / Blue', '#fff0f6', '#eff7ff'],
  ['blue_white', 'Blue / White', '#eff7ff', '#f8f9fa'],
  ['purple_yellow', 'Purple / Yellow', '#faf7ff', '#fffde4'],
  ['black_white', 'Black / White', '#343a40', '#f8f9fa'],
  ['yellow_white', 'Yellow / White', '#ffeb3b', '#f8f9fa'],
  ['red_black', 'Red / Black', '#c62828', '#212121'],
  ['blue_yellow', 'Blue / Yellow', '#a0d2eb', '#fef9e7'],
  ['pink_yellow', 'Pink / Yellow', '#fff0f6', '#fef9e7'],
  ['pink_purple', 'Pink / Purple', '#fff0f6', '#faf7ff'],
  ['gray_white', 'Gray / White', '#e9ecef', '#f8f9fa'],
  ['blue_green', 'Blue / Green', '#eff7ff', '#e4f6e0'],
  ['pink_white', 'Pink / White', '#fff0f6', '#f8f9fa'],
  ['pink_black', 'Pink / Black', '#fff0f6', '#212121'],
  ['pink_green', 'Pink / Green', '#fff0f6', '#e4f6e0'],
  ['green_black', 'Green / Black', '#e4f6e0', '#212121'],
] as const

const settingsTabs = ['Setup', 'Features', 'Appearance', 'Diary'] as const

function PromptLinkPicker({ kind, title, icon, description }: {
  kind: 'world-info' | 'mini-prompts'; title: string; icon: IconName; description: string
}) {
  return <details id={`chat-${kind}-picker`} className="chat-setting-card chat-prompt-picker">
    <summary>
      <span className="chat-setting-icon"><Icon name={icon} /></span>
      <span className="chat-prompt-picker-heading"><strong>{title}</strong><small data-link-summary>No links</small></span>
      <Icon name="next" />
    </summary>
    <p>{description}</p>
    <div className="chat-prompt-options" data-link-options role="group" aria-label={title} />
  </details>
}

export function ChatSettingsScreen() {
  const navigate = useNavigate()
  const { key, state } = useLocation()
  const active = useContext(ScreenContext) === 'chat-settings-screen'
  const chatId = active && runtime.state.activeChatId
  const chat = chatId ? runtime.state.chats[chatId] : undefined
  const character = chat && !chat.isGroup ? chat : undefined
  const [tab, setTab] = useState<typeof settingsTabs[number]>('Setup')
  useEffect(() => { setTab(state?.chatSettingsTab === 'Features' ? 'Features' : 'Setup') }, [key, state])
  useEffect(() => {
    const body = document.querySelector('.chat-settings-body')
    if (body) body.scrollTop = 0
  }, [tab])
  return (
    <Screen id="chat-settings-screen">
      <PhoneFeatureHeader title="Chat Settings" onBack={() => showScreen('chat-interface-screen')}
        actions={<HeaderSaveButton id="save-chat-settings-btn" label="Save chat settings" />} />
      <div className="chat-settings-identity" id="chat-settings-identity">
        <img id="ai-avatar-preview" alt="" />
        <img id="group-avatar-preview" alt="" hidden />
        <strong id="chat-settings-contact-name" />
      </div>
      <div className="chat-tabs" role="group" aria-label="Chat settings sections">
        {settingsTabs.filter(name => name !== 'Diary' || character).map(name => <button key={name} type="button"
          data-settings-tab={name} aria-pressed={name === tab} onClick={() => setTab(name)}>{name}</button>)}
      </div>
      <p id="chat-settings-error" className="chat-settings-error" role="alert" />
      <div className="form-container chat-settings-body">
        <section hidden={tab !== "Setup"} aria-label="Chat setup">
        <div className="chat-setting-card chat-identity-fields">
        <div className="form-group" id="ai-original-name-group">
          {" "}
          <label htmlFor="ai-original-name-input">Character name</label>
          {" "}
          <input type="text" id="ai-original-name-input" />
          {" "}
        </div>
        <div className="form-group" id="chat-name-group">
          <label htmlFor="chat-name-input">Display name</label>
          <input type="text" id="chat-name-input" />
        </div>
        <div className="form-group" id="ai-persona-group">
          <label htmlFor="ai-persona">Character description</label>
          <textarea id="ai-persona" rows={3} />
        </div>
        </div>
        <div className="form-group" id="assign-group-section" style={{ display: "none" }}>
          {" "}
          <label htmlFor="assign-group-select">Contact Group</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {" "}
            <select id="assign-group-select" style={{ flexGrow: "1" }} />
            {" "}
            <button id="manage-groups-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px" }} type="button">Manage Groups</button>
            {" "}
          </div>
        </div>
        {" "}
        <details className="chat-setting-card chat-sticker-groups">
          <summary>Sticker groups</summary>
          <p>Choose which sticker groups this chat can use.</p>
          <div id="chat-sticker-groups" />
        </details>
        <PromptLinkPicker kind="world-info" title="Linked World Info" icon="book"
          description="Choose lorebooks from World Info. Enabled entries activate by keyword or when set to always on." />
        <PromptLinkPicker kind="mini-prompts" title="Linked Mini Prompts" icon="spark"
          description="Choose books from Mini Prompts. Enabled entries are included in the chat context." />
        <div className="chat-setting-card chat-location-card">
          <h2>Location and time zone</h2>
          <LocationFields prefix="chat-character-location" cityLabel="Character city"
            zoneLabel={chat?.isGroup ? 'Group time zone' : 'Character time zone'} hideCity={chat?.isGroup} />
          <LocationFields prefix="chat-user-location" cityLabel="My city" zoneLabel="My time zone" />
          <p className="phone-app-muted">These settings apply to this chat. Automatic mode uses a recognized city or the device time zone.</p>
        </div>
        <div className="chat-setting-card chat-identity-fields">
          <div className="form-group" id="my-nickname-group">
            <label htmlFor="my-nickname-input">My Display Name</label>
            <input type="text" id="my-nickname-input" aria-describedby="my-display-name-hint" />
            <small id="my-display-name-hint">The name from your applied persona. You can also set it for this chat.</small>
            <label htmlFor="character-nickname-for-user">Nickname the character uses for me</label>
            <input type="text" id="character-nickname-for-user" aria-describedby="character-nickname-hint" />
            <small id="character-nickname-hint">You and the character can change this nickname. Leave it blank to use your display name.</small>
          </div>
          <div className="form-group" id="my-group-nickname-group">
            <label htmlFor="my-group-nickname-input">My Group Display Name</label>
            <input type="text" id="my-group-nickname-input" />
          </div>
          <div className="form-group" id="my-persona-group">
            <label htmlFor="my-persona">My Persona</label>
            <textarea id="my-persona" rows={3} />
          </div>
        </div>
        <div className="form-group" id="group-members-group">
          <label>Group Member Descriptions</label>
          <div id="group-members-settings" />
          {" "}
          <button id="manage-members-btn" className="form-button form-button-secondary" style={{ marginTop: "15px" }} type="button">Manage Group Members</button>
        </div>
        <details className="chat-setting-card chat-history-settings">
          <summary>Chat history and privacy</summary>
          <div className="phone-app-actions">
            <button className="phone-app-button compact" id="search-history-btn" type="button">Search history</button>
            <IconButton icon="export" id="export-single-chat-btn" label="Export chat" />
            <IconButton icon="import" id="import-single-chat-btn" label="Import chat" />
            <button className="phone-app-button compact danger" id="block-chat-btn" type="button">Block Character</button>
            <button className="phone-app-button compact danger" id="clear-chat-btn" type="button">Clear history</button>
          </div>
          <FilePicker id="import-single-chat-input" accept="application/json" />
        </details>
        </section>
        <section hidden={tab !== "Features"} aria-label="Chat features">
        <button className="chat-setting-card chat-setting-link" id="open-memory-screen-btn" type="button">
          <span className="chat-setting-icon"><Icon name="book" /></span>
          Long-Term Memory
          <Icon name="next" />
        </button>
        <div id="chat-character-features" className="chat-setting-toggles">
          <ChatSwitch icon="feed" id="chat-social-posts" label="Social interaction" hint="Allow this character to publish posts." />
          <ChatSwitch icon="bag" id="chat-store-purchases" label="Shopping" hint="Let the character buy items or order food from Market during a reply, using their own balance." />
          <ChatSwitch icon="bank" id="chat-bank-transfers" label="Banking" hint="Let the character send you simulated transfers from their Bank balance when appropriate." />
          <ChatSwitch icon="profile" id="chat-live-status" label="Character status" hint="Show their status below the chat name." />
          <ChatSwitch icon="bell" id="chat-auto-messages" label="Scheduled messages" hint="Let the character message first after a quiet period. Requires both background activity switches and an open EPhone app." />
        <div className="form-group" id="ai-cooldown-group">
          {" "}
          <label htmlFor="ai-action-cooldown-input">
            {" Cooldown (minutes) "}
            <p style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Minimum interval between this character’s background actions. "}</p>
            {" "}
          </label>
          {" "}
          <input type="number" id="ai-action-cooldown-input" min="1" style={{ width: "80px", textAlign: "center" }} defaultValue="10" />
          {" "}
        </div>
          <ChatSwitch icon="list" id="chat-holiday-awareness" label="Holidays and adjusted workdays" hint="Use calendar entries for the character's location." />
          <details className="settings-disclosure">
            <summary>Edit local calendar dates</summary>
            <label htmlFor="chat-holiday-dates">One entry per line with a date, holiday or workday, and a name.</label>
            <textarea id="chat-holiday-dates" maxLength={8000} rows={4}
              placeholder="2027-01-01, holiday, New Year" />
          </details>
        </div>
        <div className="form-group" id="single-char-background-activity-group">
          <div className="form-group" id="inject-thought-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {" "}
              <label htmlFor="inject-thought-toggle" style={{ marginBottom: "0" }}>
                {" Include Latest Inner Monologue "}
                <p style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Include the AI’s last inner monologue in its next prompt. This can improve continuity and increase token usage. "}</p>
              </label>
              {" "}
              <label className="toggle-switch">
                {" "}
                <input type="checkbox" id="inject-thought-toggle" />
                {" "}
                <span className="slider" />
                {" "}
              </label>
              {" "}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {" "}
            <label htmlFor="char-background-activity-switch" style={{ marginBottom: "0" }}>
              {" Enable independent background activity "}
              <p style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Allow scheduled messages or spontaneous background activity for this character. Also turn on Background Activity in API Connections. "}</p>
              {" "}
            </label>
            <label className="toggle-switch">
              {" "}
              <input type="checkbox" id="char-background-activity-switch" />
              {" "}
              <span className="slider" />
              {" "}
            </label>
            {" "}
          </div>
        </div>
        <div className="form-group" id="time-perception-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {" "}
            <label htmlFor="time-perception-toggle" style={{ marginBottom: "0" }}>
              {" Enable Time Awareness "}
              <p style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Turn off to omit the current time from the conversation prompt. "}</p>
              {" "}
            </label>
            <label className="toggle-switch">
              {" "}
              <input type="checkbox" id="time-perception-toggle" />
              {" "}
              <span className="slider" />
              {" "}
            </label>
          </div>
        </div>
        <div className="form-group" id="group-background-activity-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {" "}
            <label htmlFor="group-background-activity-switch" style={{ marginBottom: "0" }}>
              {" Enable Group Background Activity "}
              <p style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Allow AI members to act independently in this group. Enable background activity in API Connections as well. "}</p>
              {" "}
            </label>
            <label className="toggle-switch">
              {" "}
              <input type="checkbox" id="group-background-activity-switch" />
              {" "}
              <span className="slider" />
              {" "}
            </label>
            {" "}
          </div>
        </div>
        <div className="form-group" id="group-cooldown-group">
          {" "}
          <label htmlFor="group-action-cooldown-input">
            {" Group action cooldown (minutes) "}
            <p style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Minimum interval between background actions in this group. "}</p>
            {" "}
          </label>
          {" "}
          <input type="number" id="group-action-cooldown-input" min="1" style={{ width: "80px", textAlign: "center" }} defaultValue="10" />
          {" "}
        </div>
        <div className="form-group" id="offline-mode-group">
          <hr style={{ opacity: "0.3", margin: "20px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            {" "}
            <label htmlFor="offline-mode-toggle" style={{ marginBottom: "0" }}>
              {" Enable Offline Roleplay Mode "}
              <p style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>
                {" The AI will write a scene with dialogue and"}
                <i style={{ color: "var(--ui-muted)" }}>actions or setting descriptions</i>
                {". "}
              </p>
              {" "}
            </label>
            {" "}
            <label className="toggle-switch">
              {" "}
              <input type="checkbox" id="offline-mode-toggle" />
              {" "}
              <span className="slider" />
              {" "}
            </label>
            {" "}
          </div>
          <div id="offline-mode-options" style={{ display: "none", marginTop: "15px" }}>
            {" "}
            <label htmlFor="offline-min-length-input">Reply Length Range</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
              {" "}
              <input type="number" id="offline-min-length-input" style={{ width: "80px", textAlign: "center" }} defaultValue="100" />
              {" "}
              <span>to</span>
              {" "}
              <input type="number" id="offline-max-length-input" style={{ width: "80px", textAlign: "center" }} defaultValue="300" />
              {" "}
              <span>characters</span>
              {" "}
            </div>
            <div className="form-group" style={{ marginTop: "15px", marginBottom: "0" }}>
              {" "}
              <label htmlFor="offline-preset-select">Offline Prompt Preset</label>
              {" "}
              <select id="offline-preset-select" style={{ width: "100%", marginTop: "5px" }} />
              {" "}
            </div>
          </div>
        </div>
        <div className="form-group" id="group-nai-settings-group" style={{ display: "none" }}>
          <hr style={{ opacity: "0.2", margin: "20px 0" }} />
          <label style={{ fontWeight: "600", color: "var(--accent-color)" }}>NovelAI Image Settings</label>
          <p style={{ fontSize: "0.75rem", color: "var(--ui-muted)", marginTop: "5px" }}>{" Customize the image prompts for this character. "}</p>
          <div style={{ marginTop: "15px" }}>
            <label style={{ fontWeight: "500", color: "var(--ui-text)" }}>Prompt Source</label>
            <div style={{ display: "flex", gap: "15px", marginTop: "10px" }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input type="radio" name="group-nai-prompt-source" defaultChecked style={{ width: "auto", marginRight: "8px" }} defaultValue="system" />
                <span>Use Global Settings</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input type="radio" name="group-nai-prompt-source" style={{ width: "auto", marginRight: "8px" }} defaultValue="character" />
                <span>Use Character Settings</span>
              </label>
            </div>
          </div>
          <button id="group-character-nai-prompts-btn" className="form-button form-button-secondary" style={{ width: "100%", marginTop: "15px" }} type="button">Edit Character Prompts</button>
        </div>
        <div className="form-group" id="tts-enable-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {" "}
            <label htmlFor="enable-tts-switch" style={{ marginBottom: "0" }}>
              {" Enable Text-to-Speech (TTS) "}
              <p style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--ui-muted)", marginTop: "5px" }}>{" Turn off to ignore the [V] voice-message prefix. "}</p>
              {" "}
            </label>
            <label className="toggle-switch">
              {" "}
              <input type="checkbox" id="enable-tts-switch" />
              {" "}
              <span className="slider" />
              {" "}
            </label>
          </div>
        </div>
        <div className="form-group" id="ai-voice-id-group">
          {" "}
          <label htmlFor="ai-voice-id-input">{"Voice ID (MiniMax voice_id)"}</label>
          {" "}
          <input type="text" id="ai-voice-id-input" placeholder="Example: female-shaonv-jingpin" />
        </div>
        <div className="form-group" id="nai-character-settings-group" style={{ display: "none" }}>
          <hr style={{ opacity: "0.2", margin: "20px 0" }} />
          <label style={{ fontWeight: "600", color: "var(--accent-color)" }}>NovelAI Image Settings</label>
          <p style={{ fontSize: "0.75rem", color: "var(--ui-muted)", marginTop: "5px" }}>{" Customize the image prompts for this character. "}</p>
          <div style={{ marginTop: "15px" }}>
            <label style={{ fontWeight: "500", color: "var(--ui-text)" }}>Prompt Source</label>
            <div style={{ display: "flex", gap: "15px", marginTop: "10px" }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input type="radio" name="nai-prompt-source" defaultChecked style={{ width: "auto", marginRight: "8px" }} defaultValue="system" />
                <span>Use Global Settings</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input type="radio" name="nai-prompt-source" style={{ width: "auto", marginRight: "8px" }} defaultValue="character" />
                <span>Use Character Settings</span>
              </label>
            </div>
          </div>
          <button id="character-nai-prompts-btn" className="form-button form-button-secondary" style={{ width: "100%", marginTop: "15px" }} type="button">Edit Character Prompts</button>
        </div>
        <button type="button" className="form-button-secondary" onClick={() => showScreen('context-screen', { contextChatId: runtime.state.activeChatId ?? undefined })}>Open Context</button>
        </section>
        <section hidden={tab !== "Appearance"} aria-label="Chat appearance">
        <details id="qq-character-details" className="settings-disclosure">
          <summary>Character avatar and card</summary>
          <button type="button" className="phone-app-button compact" onClick={() => {
            const id = runtime.state.activeChatId
            if (id) void navigate('/edit/' + encodeURIComponent(id))
          }}>Open in Edit</button>
        <div className="form-group" id="ai-avatar-group">
          <label>Character Avatar</label>
          <div className="avatar-upload">
            <button onClick={() => document.getElementById("ai-avatar-input")?.click()} type="button">Upload Character Avatar</button>
            <button id="manage-ai-avatar-library-btn" type="button">Manage Avatar Library</button>
            <button className="change-frame-btn" data-type="ai" type="button">Change Avatar Frame</button>
            {" "}
            <input type="file" id="ai-avatar-input" accept="image/*" />
            {" "}
          </div>
        </div>
        </details>
        <div className="form-group" id="group-avatar-group">
          {" "}
          <label>Group Avatar</label>
          <div className="avatar-upload">
            {" "}
            {" "}
            <button onClick={() => document.getElementById("group-avatar-input")?.click()} type="button">Upload Group Avatar</button>
            {" "}
            <button id="manage-group-avatar-library-btn" type="button">Manage Avatar Library</button>
            {" "}
            <input type="file" id="group-avatar-input" accept="image/*" />
            {" "}
          </div>
        </div>
        <div className="form-group" id="my-avatar-group">
          {" "}
          <label>My Avatar</label>
          <div className="avatar-upload">
            {" "}
            <img id="my-avatar-preview" alt={""} />
            {" "}
            <button onClick={() => document.getElementById("my-avatar-input")?.click()} type="button">Upload My Avatar</button>
            {" "}
            <button id="manage-my-avatar-library-btn" type="button">Manage Avatar Library</button>
            {" "}
            <button className="change-frame-btn" data-type="my" type="button">Change Avatar Frame</button>
            {" "}
            <button id="open-persona-library-btn" type="button">Presets</button>
            {" "}
            <input type="file" id="my-avatar-input" accept="image/*" />
            {" "}
          </div>
        </div>

          <fieldset className="qq-theme-picker">
            <legend>Bubble theme</legend>
            <div className="theme-selector qq-theme-options">
              {chatThemes.map(([id, label, own, other]) => <label key={id}>
                <input type="radio" name="theme-select" id={id === 'default' ? 'theme-default' : undefined} value={id} defaultChecked={id === 'default'} />
                <span className="qq-theme-swatch" aria-hidden="true"><i style={{ backgroundColor: own }} /><i style={{ backgroundColor: other }} /></span>
                <span>{label}</span>
              </label>)}
            </div>
            <IconButton icon="reset" id="reset-theme-btn" label="Reset theme" />
          </fieldset>
        <div className="form-group">
          {" "}
          <label htmlFor="font-size-slider">
            {"Chat Font Size "}
            <span id="font-size-value">13px</span>
          </label>
          {" "}
          <input type="range" id="font-size-slider" min="12" max="20" step="1" style={{ width: "100%", marginTop: "8px" }} defaultValue="13" />
          {" "}
        </div>
        <hr style={{ opacity: "0.3", margin: "20px 0" }} />
        <div className="form-group">
          {" "}
          <label htmlFor="theme-preset-select">Theme Presets</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {" "}
            <select id="theme-preset-select" style={{ flexGrow: "1" }} />
            {" "}
            <IconButton icon="check" id="save-theme-preset-btn" label="Save theme preset" />
            {" "}
            <IconButton icon="trash" id="delete-theme-preset-btn" label="Delete theme preset" />
            {" "}
          </div>
        </div>
        <div className="form-group">
          {" "}
          <label htmlFor="custom-css-input">
            {" Custom Bubble CSS "}
            <IconButton icon="reset" id="reset-custom-css-btn" label="Reset chat CSS" />
          </label>
          {" "}
          <textarea id="custom-css-input" rows={5} style={{ width: "100%", marginTop: "8px", fontFamily: "monospace", fontSize: "1rem", resize: "vertical" }} placeholder={"/* Add styles for your chat bubbles */ .message-bubble.user .content { border-radius: 15px 4px 15px 15px; }"} />
          {" "}
        </div>
        <div className="form-group">
          {" "}
          <label>Live Preview</label>
          <div id="settings-preview-area" />
        </div>
        <div className="form-group">
          {" "}
          <label>Chat Background</label>
          <div className="bg-upload-container">
            {" "}
            <button type="button" className="form-button-secondary" style={{ width: "auto", padding: "8px 12px", marginTop: "0" }} onClick={() => document.getElementById("bg-input")?.click()}>Upload Background</button>
            {" "}
            <button type="button" id="remove-bg-btn">Remove Background</button>
            {" "}
          </div>
          {" "}
          <img id="bg-preview" className="bg-preview-img" alt={""} />
          {" "}
          <FilePicker id="bg-input" accept="image/*" />
        </div>
        <div className="form-group" id="lyrics-position-group" style={{ display: "none" }}>
          <hr style={{ opacity: "0.3", margin: "20px 0" }} />
          {" "}
          <label>Lyrics Position</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
            <div>
              {" "}
              <label htmlFor="lyrics-vertical-pos" style={{ fontSize: "0.9em", color: "var(--text-secondary)" }}>Vertical Position</label>
              {" "}
              <select id="lyrics-vertical-pos" style={{ width: "100%", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "0.875rem" }}>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
              {" "}
            </div>
            <div>
              {" "}
              <label htmlFor="lyrics-horizontal-pos" style={{ fontSize: "0.9em", color: "var(--text-secondary)" }}>Horizontal Alignment</label>
              {" "}
              <select id="lyrics-horizontal-pos" style={{ width: "100%", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "0.875rem" }}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
              {" "}
            </div>
          </div>
          <div style={{ marginTop: "10px" }}>
            {" "}
            <label htmlFor="lyrics-offset-input" style={{ fontSize: "0.9em", color: "var(--text-secondary)" }}>Vertical Offset (px)</label>
            {" "}
            <input type="number" id="lyrics-offset-input" style={{ width: "100%", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "0.875rem", boxSizing: "border-box" }} defaultValue="10" />
            {" "}
          </div>
        </div>
        </section>
        {character && <section hidden={tab !== 'Diary'} aria-label="Diary">
          <DiaryPanel key={character.id + ':' + key} chat={character} />
        </section>}
      </div>
    </Screen>
  )
}

function ChatSwitch({ id, label, hint, icon }: { id: string; label: string; hint: string; icon: IconName }) {
  return <div className="chat-setting-switch">
    <span className="chat-setting-icon"><Icon name={icon} /></span>
    <label htmlFor={id}>{label}<small>{hint}</small></label>
    <label className="toggle-switch"><input type="checkbox" role="switch" id={id} /><span className="slider" /></label>
  </div>
}
