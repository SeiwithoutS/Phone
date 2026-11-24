import { Dialog, FormField } from '../../components/phone'
import { LocationFields } from '../chat/LocationFields'

export function PersonaEditorModal() {
  return (
    <Dialog id="persona-editor-modal">
      <div className="modal-content">
        <div className="modal-header">
          <span id="persona-editor-title">Add Persona Preset</span>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Preset Avatar</label>
            <div className="avatar-upload">
              <img id="preset-avatar-preview" alt={""} />
              <button onClick={() => document.getElementById("preset-avatar-input")?.click()} type="button">Upload Avatar</button>
              <input type="file" id="preset-avatar-input" accept="image/*" />
            </div>
          </div>
          <FormField id="preset-persona-input" label="Persona Description">
            <textarea id="preset-persona-input" rows={4} placeholder={"Describe this persona…"} />
          </FormField>
          <LocationFields prefix="preset-user-location" cityLabel="My city" zoneLabel="My time zone" />
        </div>
        <div className="modal-footer">
          <button className="cancel" id="cancel-persona-editor-btn" type="button">Cancel</button>
          <button className="save" id="save-persona-preset-btn" type="button">Save</button>
        </div>
      </div>
    </Dialog>
  )
}

export function PersonaLibraryModal() {
  return (
    <Dialog id="persona-library-modal">
      <div className="modal-content">
        <div className="modal-header">
          <span>My Personas</span>
          <button id="add-persona-preset-btn" className="action-button" type="button">Add</button>
        </div>
        <div className="modal-body">
          <div id="persona-library-grid" />
        </div>
        <div className="modal-footer">
          <button className="cancel" id="close-persona-library-btn" type="button">Close</button>
        </div>
      </div>
    </Dialog>
  )
}
