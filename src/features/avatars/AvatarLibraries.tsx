import { IconButton } from '../../components/icons'
import { Dialog, FilePicker } from '../../components/phone'

const libraries = {
  ai: 'Character Avatar Library',
  my: 'My Avatar Library',
  group: 'Group Avatar Library',
} as const

function AvatarLibrary({ kind }: { kind: keyof typeof libraries }) {
  const prefix = `${kind}-avatar`
  const titleId = `${prefix}-library-title`
  return (
    <>
      <Dialog id={`${prefix}-library-modal`} aria-labelledby={titleId}>
        <div className="modal-content h-[70%]">
          <div className="modal-header">
            <span id={titleId}>{libraries[kind]}</span>
            <div className="header-actions">
              <IconButton id={`add-${prefix}-batch-btn`} icon="upload" label="Import images" />
              <button type="button" id={`add-${prefix}-url-btn`} className="action-button">URL</button>
              <button type="button" id={`add-${prefix}-upload-btn`} className="action-button">Upload</button>
            </div>
          </div>
          <div className="modal-body p-[15px]">
            <div id={`${prefix}-library-grid`} className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-[15px]" />
          </div>
          <div className="modal-footer">
            <button type="button" id={`close-${prefix}-library-btn`} className="save w-full">Close</button>
          </div>
        </div>
      </Dialog>
      <FilePicker id={`${prefix}-upload-input`} accept="image/*" />
    </>
  )
}

export function AvatarLibraries() {
  return <>
    <AvatarLibrary kind="ai" />
    <AvatarLibrary kind="my" />
    <AvatarLibrary kind="group" />
  </>
}
