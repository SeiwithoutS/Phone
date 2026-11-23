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

document.getElementById('chat-messages').addEventListener('click', (e) => {
            

const placeholder = e.target.closest('.recalled-message-placeholder');
if (placeholder) {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    const wrapper = placeholder.closest('.message-wrapper');
    if (chat && wrapper) {
        const timestamp = parseInt(wrapper.dataset.timestamp);
        const recalledMsg = chat.history.find(m => m.timestamp === timestamp);

        if (recalledMsg && recalledMsg.recalledData) {
            let originalContentText = '';
            const recalled = recalledMsg.recalledData;

            
            switch (recalled.originalType) {
                case 'text':
                    originalContentText = `原文: "${recalled.originalContent}"`;
                    break;
                case 'user_photo':
                case 'ai_image':
                case 'text_image':
                    originalContentText = `[图片/文字图] 描述: "${recalled.originalContent}"`;
                    break;
                case 'voice_message':
                    originalContentText = `[语音] 内容: "${recalled.originalContent}"`;
                    break;
                case 'sticker':
                    
                    originalContentText = `[表情] 含义: "${recalled.originalMeaning || '(无)'}" \n URL: ${recalled.originalContent}`;
                    break;
                case 'transfer':
                    originalContentText = `一条[转账]消息已被撤回。`;
                    break;
                default:
                    
                    originalContentText = `撤回了一条[${recalled.originalType}]类型的消息。\n内容: ${JSON.stringify(recalled.originalContent)}`;
                    break;
            }
            

            showCustomAlert("Recalled message", originalContentText);
        }
    }
}
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
