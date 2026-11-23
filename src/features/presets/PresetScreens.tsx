import { useState } from 'react'
import { CollectionLayoutButton } from '../../components/PromptEntryList'
import { PromptCollectionEditor } from '../world-book/WorldInfoEditor'
import type { LocalDatabase } from '../../storage/database'
import { IconButton } from '../../components/icons'
import { BackButton, Dialog, Screen, ScreenHeader } from '../../components/phone'
import { showScreen } from '../../app/routes'

export function PresetActionsModal() {
  return (
    <Dialog id="preset-actions-modal">
      <div style={{ width: "250px" }} className=" custom-modal-card">
        <div className="custom-modal-footer">
          {" "}
          <button id="preset-action-edit" type="button">Edit Preset</button>
          {" "}
          <button id="preset-action-delete" className="btn-danger" type="button">Delete Preset</button>
          {" "}
          <button id="preset-action-cancel" style={{ marginTop: "8px", borderRadius: "8px", backgroundColor: "#f0f0f0" }} type="button">Cancel</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function PresetEditorScreen({ database }: { database?: LocalDatabase }) {
  return <PromptCollectionEditor kind="preset" database={database} />
}

export function PresetScreen() {
  const [grid, setGrid] = useState(false)
  return (
    <Screen id="preset-screen" className="prompt-collection-screen" data-grid={grid}>
      <ScreenHeader className="mini-prompts-header">
        {" "}
        <BackButton onClick={() => showScreen("home-screen")} />
        {" "}
        <h1>Presets</h1>
        <div className="header-actions prompt-collection-tools">
          <CollectionLayoutButton grid={grid} change={() => setGrid(!grid)} />
          {" "}
          <IconButton icon="import" id="import-preset-btn" label="Import preset" />
          {" "}
          <IconButton icon="plus" id="add-preset-btn" label="Add preset" />
          {" "}
        </div>
      </ScreenHeader>
      <div id="preset-content-container" className="prompt-collection-cards prompt-collection-scroll" data-grid={grid} />
    </Screen>
  )
}
