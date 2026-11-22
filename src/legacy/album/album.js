import { addLongPressListener, showCustomConfirm } from '../dialogs/dialogs.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'

export async function renderAlbumList() {
                    const albumGrid = document.getElementById('album-grid-page');
                    if (!albumGrid) return;
                    const albums = await runtime.db.qzoneAlbums.orderBy('createdAt').reverse().toArray();
                    albumGrid.innerHTML = '';
                    if (albums.length === 0) {
                        albumGrid.innerHTML = "<p style=\"grid-column: 1 / -1; text-align: center; color: var(--text-secondary); margin-top: 50px;\">No albums yet.</p>";
                        return;
                    }
                    albums.forEach(album => {
                        const albumItem = document.createElement('div');
                        albumItem.className = 'album-item';
                        albumItem.innerHTML = `
                            <div class="album-cover" style="background-image: url(${album.coverUrl});"></div>
                            <div class="album-info">
                                <p class="album-name">${album.name}</p>
                                <p class="album-count">${album.photoCount || 0} photos</p>
                            </div>
                        `;
                        albumItem.addEventListener('click', () => {
                            openAlbum(album.id);
                        });
        
                        
                        addLongPressListener(albumItem, async () => {
                            const confirmed = await showCustomConfirm(
                                "Delete Album",
                                `Delete “${album.name}” and all its photos? This is permanent.`,
                                { confirmButtonClass: 'btn-danger' }
                            );
        
                            if (confirmed) {
                                // 1. 从照片表中删除该相册下的所有照片
                                await runtime.db.qzonePhotos.where('albumId').equals(album.id).delete();
                                
                                // 2. 从相册表中删除该相册本身
                                await runtime.db.qzoneAlbums.delete(album.id);
                                
                                // 3. 重新渲染相册列表
                                await renderAlbumList();
                                
                                alert("Album deleted.");
                            }
                        });
                          
        
                        albumGrid.appendChild(albumItem);
                    });
                }

export async function openAlbum(albumId) {
                    runtime.state.activeAlbumId = albumId;
                    await renderAlbumPhotosScreen();
                    showScreen('album-photos-screen');
                }

export async function renderAlbumPhotosScreen() {
                    if (!runtime.state.activeAlbumId) return;
                    const photosGrid = document.getElementById('photos-grid-page');
                    const headerTitle = document.getElementById('album-photos-title');
                    const album = await runtime.db.qzoneAlbums.get(runtime.state.activeAlbumId);
                    if (!album) {
                        console.error("找不到相册:", runtime.state.activeAlbumId);
                        showScreen('album-screen');
                        return;
                    }
                    headerTitle.textContent = album.name;
                    const photos = await runtime.db.qzonePhotos.where('albumId').equals(runtime.state.activeAlbumId).toArray();
                    photosGrid.innerHTML = '';
                    if (photos.length === 0) {
                        photosGrid.innerHTML = "<p style=\"grid-column: 1 / -1; text-align: center; color: var(--text-secondary); margin-top: 50px;\">This album is empty. Upload a photo to get started.</p>";
                    } else {
                        photos.forEach(photo => {
                            const photoItem = document.createElement('div');
                            photoItem.className = 'photo-item';
                            photoItem.innerHTML = `
                                <img src="${photo.url}" class="photo-thumb" alt="Album photo">
                                <button class="photo-delete-btn" data-photo-id="${photo.id}">×</button>
                            `;
                            photosGrid.appendChild(photoItem);
                        });
                    }
                }

export async function openPhotoViewer(clickedPhotoUrl) {
            if (!runtime.state.activeAlbumId) return;
        
            
            const photosInAlbum = await runtime.db.qzonePhotos.where('albumId').equals(runtime.state.activeAlbumId).toArray();
            runtime.photoViewerState.photos = photosInAlbum.map(p => p.url);
        
            
            runtime.photoViewerState.currentIndex = runtime.photoViewerState.photos.findIndex(url => url === clickedPhotoUrl);
            if (runtime.photoViewerState.currentIndex === -1) return; 
        
            
            document.getElementById('photo-viewer-modal').classList.add('visible');
            renderPhotoViewer();
            runtime.photoViewerState.isOpen = true;
        }

export function renderPhotoViewer() {
            if (runtime.photoViewerState.currentIndex === -1) return;
        
            const imageEl = document.getElementById('photo-viewer-image');
            const prevBtn = document.getElementById('photo-viewer-prev-btn');
            const nextBtn = document.getElementById('photo-viewer-next-btn');
            
            
            imageEl.style.opacity = 0;
        
            setTimeout(() => {
                
                imageEl.src = runtime.photoViewerState.photos[runtime.photoViewerState.currentIndex];
                
                imageEl.style.opacity = 1;
            }, 100); 
        
            
            prevBtn.disabled = runtime.photoViewerState.currentIndex === 0;
            
            nextBtn.disabled = runtime.photoViewerState.currentIndex === runtime.photoViewerState.photos.length - 1;
        }

export function showNextPhoto() {
            if (runtime.photoViewerState.currentIndex < runtime.photoViewerState.photos.length - 1) {
                runtime.photoViewerState.currentIndex++;
                renderPhotoViewer();
            }
        }

export function showPrevPhoto() {
            if (runtime.photoViewerState.currentIndex > 0) {
                runtime.photoViewerState.currentIndex--;
                renderPhotoViewer();
            }
        }

export function closePhotoViewer() {
            document.getElementById('photo-viewer-modal').classList.remove('visible');
            runtime.photoViewerState.isOpen = false;
            runtime.photoViewerState.photos = [];
            runtime.photoViewerState.currentIndex = -1;
            
            document.getElementById('photo-viewer-image').src = '';
        }

export function bindAlbumEvents() {
  document.getElementById('photo-viewer-close-btn').addEventListener('click', closePhotoViewer);

document.getElementById('photo-viewer-next-btn').addEventListener('click', showNextPhoto);

document.getElementById('photo-viewer-prev-btn').addEventListener('click', showPrevPhoto);

document.addEventListener('keydown', (e) => {
            if (!runtime.photoViewerState.isOpen) return; 
        
            if (e.key === 'ArrowRight') {
                showNextPhoto();
            } else if (e.key === 'ArrowLeft') {
                showPrevPhoto();
            } else if (e.key === 'Escape') {
                closePhotoViewer();
            }
        });
}
