import { addSongFromLocal, addSongFromURL, changePlayMode, deleteTrack, endListenTogetherSession, handleChangeAlbumArt, handleChangeBackground, handleListenTogetherClick, playNext, playPrev, returnToChat, togglePlayPause, updatePlaylistUI } from './player.js'
import { handleManualLrcImport } from './search.js'
import { runtime } from '../runtime/state.js'
import { addLongPressListener } from '../dialogs/dialogs.js'

export function bindMusicPlaybackEvents() {
  addLongPressListener(document.getElementById('music-visual-container'), () => {
    const index = runtime.musicState.currentIndex
    if (index > -1) handleChangeAlbumArt(index)
  })
  document.getElementById('listen-together-btn').addEventListener('click', handleListenTogetherClick);

document.getElementById('music-exit-btn').addEventListener('click', () => endListenTogetherSession(true));

document.getElementById('music-return-btn').addEventListener('click', returnToChat);

document.getElementById('music-play-pause-btn').addEventListener('click', togglePlayPause);

document.getElementById('music-next-btn').addEventListener('click', playNext);

document.getElementById('music-prev-btn').addEventListener('click', playPrev);

document.getElementById('music-mode-btn').addEventListener('click', changePlayMode);

document.getElementById('music-playlist-btn').addEventListener('click', () => { updatePlaylistUI(); document.getElementById('music-playlist-panel').classList.add('visible'); });

document.getElementById('close-playlist-btn').addEventListener('click', () => document.getElementById('music-playlist-panel').classList.remove('visible'));

document.getElementById('add-song-url-btn').addEventListener('click', addSongFromURL);

document.getElementById('add-song-local-btn').addEventListener('click', () => document.getElementById('local-song-upload-input').click());

document.getElementById('local-song-upload-input').addEventListener('change', addSongFromLocal);

document.getElementById('playlist-body').addEventListener('click', (e) => {
    const target = e.target;
    const trackIndex = parseInt(target.dataset.index);

    if (isNaN(trackIndex)) return;

    if (target.classList.contains('album-art-btn')) {
        handleChangeAlbumArt(trackIndex);
    } else if (target.classList.contains('lyrics-btn')) {
        handleManualLrcImport(trackIndex);
    } else if (target.classList.contains('bg-btn')) {
        handleChangeBackground(trackIndex);
    } else if (target.classList.contains('delete-track-btn')) {
        deleteTrack(trackIndex);
    }
});

runtime.audioPlayer.addEventListener('ended', () => {
    
    document.getElementById('vinyl-view').classList.remove('spinning');
    playNext(); 
});
}
