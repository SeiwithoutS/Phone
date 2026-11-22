import { BackButton, Dialog, FormField, Screen, ScreenHeader } from '../../components/phone'

export function ContactPickerScreen() {
  return (
    <Screen id="contact-picker-screen">
      <ScreenHeader>
        {" "}
        <span className="back-btn" id="cancel-contact-picker-btn">Cancel</span>
        {" "}
        <span>Select Contacts</span>
        {" "}
        <span className="save-btn" id="confirm-contact-picker-btn">Done (0)</span>
        {" "}
      </ScreenHeader>
      <div className="list-container" id="contact-picker-list">{" "}</div>
    </Screen>
  )
}

export function GroupManagementModal() {
  return (
    <Dialog id="group-management-modal">
      <div className="modal-content" style={{ height: "60%" }}>
        <div className="modal-header">
          {" "}
          <span>Manage Contact Groups</span>
          {" "}
        </div>
        <div className="modal-body">
          <div className="form-group">
            {" "}
            <label>New Group</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {" "}
              <input type="text" id="new-group-name-input" placeholder={"Enter a group name…"} style={{ flexGrow: "1" }} />
              {" "}
              <button id="add-new-group-btn" className="form-button" style={{ width: "auto", marginTop: "0", padding: "0 15px" }} type="button">Add</button>
              {" "}
            </div>
          </div>
          <hr style={{ opacity: "0.2" }} />
          <div id="existing-groups-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{" "}</div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="save" id="close-group-manager-btn" style={{ width: "100%" }} type="button">Done</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function MemberManagementScreen() {
  return (
    <Screen id="member-management-screen">
      <ScreenHeader>
        {" "}
        <BackButton id="back-from-member-management" />
        {" "}
        <span>Group Members</span>
        {" "}
        <span style={{ width: "30px" }} />
        {" "}
      </ScreenHeader>
      <div className="list-container" id="member-management-list">{" "}</div>
      <div id="member-management-actions">
        {" "}
        <button id="add-existing-contact-btn" type="button">Add Existing Contact</button>
        {" "}
        <button id="create-new-member-btn" type="button">Create Group Member</button>
        {" "}
      </div>
    </Screen>
  )
}

export function MemberSettingsModal() {
  return (
    <Dialog id="member-settings-modal">
      <div className="modal-content">
        <div className="modal-header">
          <span>Edit Group Member</span>
        </div>
        <div className="modal-body">
          <FormField id="member-name-input" label="Name">
            <input type="text" id="member-name-input" />
          </FormField>
          <FormField id="member-persona-input" label="Description">
            <textarea id="member-persona-input" rows={4} />
          </FormField>
          <div className="form-group">
            <label>Avatar</label>
            <div className="avatar-upload">
              <img id="member-avatar-preview" alt={""} />
              <button onClick={() => document.getElementById("member-avatar-input")?.click()} type="button">Upload Avatar</button>
              <button className="change-frame-btn" data-type="member" type="button">Change Avatar Frame</button>
              <input type="file" id="member-avatar-input" accept="image/*" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel" id="cancel-member-settings-btn" type="button">Cancel</button>
          <button className="save" id="save-member-settings-btn" type="button">Save</button>
        </div>
      </div>
    </Dialog>
  )
}
