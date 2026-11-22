import { BackButton, Dialog, Screen, ScreenHeader } from '../../components/phone'

export function AlbumPhotosScreen() {
  return (
    <Screen id="album-photos-screen">
      <ScreenHeader>
        {" "}
        <BackButton id="album-photos-back-btn" />
        {" "}
        <span id="album-photos-title">Album Name</span>
        {" "}
        <span className="action-btn" id="album-upload-photo-btn">Upload</span>
        {" "}
      </ScreenHeader>
      <div className="list-container">
        <div id="photos-grid-page">{" "}</div>
        <Dialog id="photo-viewer-modal">
          {" "}
          <button id="photo-viewer-close-btn" type="button" aria-label="Close">{"×"}</button>
          {" "}
          <button id="photo-viewer-prev-btn" className="nav-arrow" type="button" aria-label="Back">{"‹"}</button>
          <div className="photo-viewer-content">
            {" "}
            <img id="photo-viewer-image" alt="Full-screen photo preview" />
            {" "}
          </div>
          {" "}
          <button id="photo-viewer-next-btn" className="nav-arrow" type="button">{"›"}</button>
        </Dialog>
      </div>
    </Screen>
  )
}

export function AlbumScreen() {
  return (
    <Screen id="album-screen">
      <ScreenHeader>
        {" "}
        <BackButton id="album-back-btn" />
        {" "}
        <span>My Albums</span>
        {" "}
        <span className="action-btn" id="create-album-btn-page">+</span>
        {" "}
      </ScreenHeader>
      <div className="list-container">
        <div id="album-grid-page">{" "}</div>
      </div>
    </Screen>
  )
}
