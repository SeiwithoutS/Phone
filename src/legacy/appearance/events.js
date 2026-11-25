import { previewMessageSound } from '../home/status.js'
import { handlePropelAction, handleRegenerateCallResponse } from '../chat/ai.js'
import { showCustomAlert } from '../dialogs/dialogs.js'
import { saveGlobalPlaylist, updatePlayerUI, updatePlaylistUI } from '../music/player.js'
import { addSongFromSearch, getPlayableSongDetails } from '../music/search.js'
import { runtime } from '../runtime/state.js'

export function bindAppearanceEditor() {
  document.querySelector('.progress-bar').addEventListener('click', (e) => {
            if (!runtime.audioPlayer.duration) return;
            const progressBar = e.currentTarget;
            const barWidth = progressBar.clientWidth;
            const clickX = e.offsetX;
            runtime.audioPlayer.currentTime = (clickX / barWidth) * runtime.audioPlayer.duration;
        });

}

export function bindAppearanceAssets() {
  document.getElementById('gift-recipient-list').addEventListener('click', (e) => {
            const item = e.target.closest('.contact-picker-item');
            if (item) {
                item.classList.toggle('selected');
            }
        });

document.getElementById('select-all-recipients').addEventListener('change', function(e) {
            const isChecked = e.target.checked;
            document.querySelectorAll('#gift-recipient-list .contact-picker-item').forEach(item => {
                item.classList.toggle('selected', isChecked);
            });
        });


document.getElementById('regenerate-call-btn').addEventListener('click', handleRegenerateCallResponse);

document.getElementById('propel-btn').addEventListener('click', handlePropelAction);

for (const kind of ['sent', 'received']) {
    document.getElementById('test-sound-' + kind).addEventListener('click', () => {
        const url = document.getElementById('notification-sound-url-input').value.trim();
        void previewMessageSound(kind, url).catch(() => alert('Playback failed. Check the URL and audio format.'));
    });
}
document.getElementById('reset-sound-btn').addEventListener('click', () => {
    document.getElementById('notification-sound-url-input').value = '';
});

document.getElementById('add-song-search-btn').addEventListener('click', addSongFromSearch);

document.getElementById('cancel-music-search-btn').addEventListener('click', () => {
    document.getElementById('music-search-results-modal').classList.remove('visible');
});

document.getElementById('add-song-search-btn').addEventListener('click', addSongFromSearch);

document.getElementById('cancel-music-search-btn').addEventListener('click', () => {
    document.getElementById('music-search-results-modal').classList.remove('visible');
});

document.getElementById('select-all-music-search').addEventListener('change', function(e) {
    document.querySelectorAll('#search-results-list .music-search-checkbox').forEach(cb => {
        cb.checked = e.target.checked;
    });
});

document.getElementById('search-results-list').addEventListener('click', (e) => {
    const item = e.target.closest('.search-result-item');
    if (item) {
        const checkbox = item.querySelector('.music-search-checkbox');
        if (checkbox) {
            
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }
        }
    }
});

document.getElementById('add-selected-music-btn').addEventListener('click', async () => {
    const selectedItems = document.querySelectorAll('.music-search-checkbox:checked');
    if (selectedItems.length === 0) {
        alert("Select the songs to add.");
        return;
    }

    document.getElementById('music-search-results-modal').classList.remove('visible');
    await showCustomAlert("Please wait…", `Adding ${selectedItems.length} songs…`);

    const songDataList = Array.from(selectedItems).map(cb => JSON.parse(cb.closest('.search-result-item').dataset.songJson));
    
    let successCount = 0;
    let failedNames = [];

    
    const songDetailPromises = songDataList.map(songData => getPlayableSongDetails(songData));
    const fullSongObjects = await Promise.all(songDetailPromises);

    fullSongObjects.forEach((songObject, index) => {
        if (songObject) {
            runtime.musicState.playlist.push(songObject);
            successCount++;
        } else {
            failedNames.push(songDataList[index].name);
        }
    });

    if (successCount > 0) {
        await saveGlobalPlaylist();
        updatePlaylistUI();
        if (runtime.musicState.currentIndex === -1) {
            runtime.musicState.currentIndex = runtime.musicState.playlist.length - successCount;
            updatePlayerUI();
        }
    }

    let resultMessage = `添加完成！\n\n成功添加 ${successCount} 首歌曲。`;
    if (failedNames.length > 0) {
        resultMessage += `\n\n${failedNames.length} 首歌曲获取失败:\n- ${failedNames.join('\n- ')}`;
    }
    await showCustomAlert("Results", resultMessage);
});
}
