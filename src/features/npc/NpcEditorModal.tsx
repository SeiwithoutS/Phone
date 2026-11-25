import { Dialog, FilePicker, FormField } from '../../components/phone'

export function NpcEditorModal() {
  return (
    <Dialog id="npc-editor-modal">
      <div className="modal-content" style={{ height: "80%" }}>
        <div className="modal-header">
          {" "}
          <span id="npc-editor-title">Add NPC</span>
          {" "}
        </div>
        <div className="modal-body">
          <div className="form-group">
            {" "}
            <label>NPC Avatar</label>
            <div className="avatar-upload">
              {" "}
              <img id="npc-avatar-preview" src="https://i.postimg.cc/VkQfgzGJ/1.jpg" alt={""} />
              {" "}
              <button onClick={() => document.getElementById("npc-avatar-input")?.click()} type="button">Upload Avatar</button>
              {" "}
              <FilePicker id="npc-avatar-input" accept="image/*" />
              {" "}
            </div>
          </div>
          <FormField id="npc-name-input" label="NPC Display Name">
            <input type="text" id="npc-name-input" placeholder={"Enter the NPC’s display name"} />
          </FormField>
          <FormField id="npc-persona-input" label="NPC Description">
            <textarea id="npc-persona-input" rows={4} placeholder={"Describe the NPC’s personality, background, and speech…"} />
          </FormField>
          <label className="api-streaming"><input id="npc-context-switch" type="checkbox" defaultChecked /> Include profile in other characters’ Context</label>
          <hr style={{ opacity: "0.2" }} />
          <div className="form-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {" "}
            <label htmlFor="npc-background-activity-switch" style={{ marginBottom: "0" }}>
              {" Enable independent background activity "}
              <p style={{ fontSize: "0.75rem", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" Allow this NPC to comment on posts in the background. Enable background activity in API Connections as well. "}</p>
              {" "}
            </label>
            {" "}
            <label className="toggle-switch">
              {" "}
              <input type="checkbox" id="npc-background-activity-switch" />
              {" "}
              <span className="slider" />
              {" "}
            </label>
            {" "}
          </div>
          <div className="form-group">
            {" "}
            <label htmlFor="npc-action-cooldown-input">
              {" Action cooldown (minutes) "}
              <p style={{ fontSize: "0.75rem", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" Minimum interval between background actions. "}</p>
              {" "}
            </label>
            {" "}
            <input type="number" id="npc-action-cooldown-input" min="1" style={{ width: "80px", textAlign: "center" }} defaultValue="15" />
            {" "}
          </div>
          <div className="form-group">
            {" "}
            <label>Associated characters whose posts this NPC may comment on</label>
            <div id="npc-association-list" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="form-button-secondary" id="npc-social-profile-btn" type="button" hidden>Social profile</button>
          {" "}
          <button className="cancel" id="cancel-npc-editor-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="save-npc-btn" type="button">Save</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
