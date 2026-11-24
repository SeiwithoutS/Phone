import { addMusicActionSystemMessage } from '../appearance/theme.js'
import { closeMusicPlayerWithAnimation, parseLRC } from '../chat/sharing.js'
import { showChoiceModal, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { uploadImageLocally } from '../home/widgets.js'
import { getLrcContent, renderLyrics, updateMusicProgressBar } from './lyrics.js'
import { checkAudioAvailability } from './search.js'
import { runtime } from '../runtime/state.js'

export function applyLyricsBarPosition(chat) {
            const lyricsBar = document.getElementById('global-lyrics-bar');
            
            const settings = chat.settings.lyricsPosition || { vertical: 'top', horizontal: 'center', offset: 10 };
            
            
            lyricsBar.style.top = 'auto';
            lyricsBar.style.bottom = 'auto';
            lyricsBar.style.left = 'auto';
            lyricsBar.style.right = 'auto';
            lyricsBar.style.transform = 'none';
        
            
            if (settings.vertical === 'top') {
                lyricsBar.style.top = `${settings.offset}px`;
            } else { 
                lyricsBar.style.bottom = `${settings.offset}px`;
            }
            
            
            switch (settings.horizontal) {
                case 'left':
                    lyricsBar.style.left = '15px'; 
                    break;
                case 'right':
                    lyricsBar.style.right = '15px'; 
                    break;
                case 'center':
                default:
                    lyricsBar.style.left = '50%';
                    lyricsBar.style.transform = 'translateX(-50%)';
                    break;
            }
        }

export async function saveGlobalPlaylist() { await runtime.db.musicLibrary.put({ id: 'main', playlist: runtime.musicState.playlist }); }

export async function handleListenTogetherClick() { const targetChatId = runtime.state.activeChatId; if (!targetChatId) return; if (!runtime.musicState.isActive) { startListenTogetherSession(targetChatId); return; } if (runtime.musicState.activeChatId === targetChatId) { document.getElementById('music-player-overlay').classList.add('visible'); } else { const oldChatName = runtime.state.chats[runtime.musicState.activeChatId]?.name || '未知'; const newChatName = runtime.state.chats[targetChatId]?.name || '当前'; const confirmed = await showCustomConfirm("Switch Listening Partner", `You’re listening with “${oldChatName}”. Start a new session with “${newChatName}”?`, { confirmButtonClass: 'btn-danger' }); if (confirmed) { await endListenTogetherSession(true); await new Promise(resolve => setTimeout(resolve, 50)); startListenTogetherSession(targetChatId); } } }

export async function startListenTogetherSession(chatId) { const chat = runtime.state.chats[chatId]; if (!chat) return; runtime.musicState.totalElapsedTime = chat.musicData.totalTime || 0; runtime.musicState.isActive = true; runtime.musicState.activeChatId = chatId; if (runtime.musicState.playlist.length > 0) { runtime.musicState.currentIndex = 0; } else { runtime.musicState.currentIndex = -1; } if(runtime.musicState.timerId) clearInterval(runtime.musicState.timerId); runtime.musicState.timerId = setInterval(() => { if (runtime.musicState.isPlaying) { runtime.musicState.totalElapsedTime++; updateElapsedTimeDisplay(); } }, 1000); updatePlayerUI(); updatePlaylistUI(); document.getElementById('music-player-overlay').classList.add('visible'); }

export async function endListenTogetherSession(saveState = true) {
    if (!runtime.musicState.isActive) return;
    const oldChatId = runtime.musicState.activeChatId;
    document.getElementById('global-lyrics-bar').classList.remove('visible');
    const cleanupLogic = async () => {
        if (runtime.musicState.timerId) clearInterval(runtime.musicState.timerId);
        if (runtime.musicState.isPlaying) runtime.audioPlayer.pause();
        if (saveState && oldChatId && runtime.state.chats[oldChatId]) {
            const chat = runtime.state.chats[oldChatId];
            chat.musicData.totalTime = runtime.musicState.totalElapsedTime;
            await runtime.db.chats.put(chat);
        }
        runtime.musicState.isActive = false;
        runtime.musicState.activeChatId = null;
        runtime.musicState.totalElapsedTime = 0;
        runtime.musicState.timerId = null;
        updateListenTogetherIcon(oldChatId, true);
    };
    closeMusicPlayerWithAnimation(cleanupLogic);
}

export function returnToChat() {
    closeMusicPlayerWithAnimation();
}

export function updateListenTogetherIcon(chatId, forceReset = false) {
    const button = document.getElementById('listen-together-btn');
    if (!button) return;
    const active = !forceReset && runtime.musicState.isActive && runtime.musicState.activeChatId === chatId;
    button.setAttribute('aria-pressed', String(active));
    button.dataset.playing = String(active && runtime.musicState.isPlaying);
}

export function updatePlayerUI() { 
    updateListenTogetherIcon(runtime.musicState.activeChatId); 
    updateElapsedTimeDisplay(); 
    const titleEl = document.getElementById('music-player-song-title'); 
    const artistEl = document.getElementById('music-player-artist'); 
    const playPauseBtn = document.getElementById('music-play-pause-btn'); 
    if (runtime.musicState.currentIndex > -1 && runtime.musicState.playlist.length > 0) { 
        const track = runtime.musicState.playlist[runtime.musicState.currentIndex]; 
        titleEl.textContent = track.name; 
        artistEl.textContent = track.artist; 
    } else { 
        titleEl.textContent = "Add a song to begin"; 
        artistEl.textContent = '...'; 
    } 
    playPauseBtn.textContent = runtime.musicState.isPlaying ? '❚❚' : '▶'; 
}

export function updateElapsedTimeDisplay() { const hours = (runtime.musicState.totalElapsedTime / 3600).toFixed(1); document.getElementById('music-time-counter').textContent = `Listened together for ${hours} hours`; }

export function updatePlaylistUI() {
    const playlistBody = document.getElementById('playlist-body');
    playlistBody.innerHTML = '';
    if (runtime.musicState.playlist.length === 0) {
        playlistBody.innerHTML = "<p style=\"text-align:center; padding: 20px; color: #888;\">The playlist is empty.</p>";
        return;
    }
    runtime.musicState.playlist.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        if(index === runtime.musicState.currentIndex) item.classList.add('playing');

        
item.innerHTML = `
    <div class="playlist-item-info">
        <div class="title">${track.name}</div>
        <div class="artist">${track.artist}</div>
    </div>
    <div class="playlist-item-actions">
        <span class="playlist-action-btn album-art-btn" data-index="${index}">Cover</span>
        <span class="playlist-action-btn lyrics-btn" data-index="${index}">Lyrics</span>
        <!-- 【核心新增】在这里添加“背景”按钮 -->
        <span class="playlist-action-btn bg-btn" data-index="${index}">Background</span>
        <span class="playlist-action-btn delete-track-btn" data-index="${index}">×</span>
    </div>
`;
          

        item.querySelector('.playlist-item-info').addEventListener('click', () => playSong(index));
        playlistBody.appendChild(item);
    });
}

export async function togglePlayPause() {
    if (runtime.audioPlayer.paused) {
        if (runtime.musicState.currentIndex === -1 && runtime.musicState.playlist.length > 0) {
            playSong(0);
        } 
        else if (runtime.musicState.currentIndex > -1) {
            playSong(runtime.musicState.currentIndex);
        }
    } else {
        runtime.audioPlayer.pause();
        await addMusicActionSystemMessage('paused the music.');
    }
}

export function playNext() { if (runtime.musicState.playlist.length === 0) return; let nextIndex; switch(runtime.musicState.playMode) { case 'random': nextIndex = Math.floor(Math.random() * runtime.musicState.playlist.length); break; case 'single': playSong(runtime.musicState.currentIndex); return; case 'order': default: nextIndex = (runtime.musicState.currentIndex + 1) % runtime.musicState.playlist.length; break; } playSong(nextIndex); }

export function playPrev() { if (runtime.musicState.playlist.length === 0) return; const newIndex = (runtime.musicState.currentIndex - 1 + runtime.musicState.playlist.length) % runtime.musicState.playlist.length; playSong(newIndex); }

export function changePlayMode() { const modes = ['order', 'random', 'single']; const currentModeIndex = modes.indexOf(runtime.musicState.playMode); runtime.musicState.playMode = modes[(currentModeIndex + 1) % modes.length]; document.getElementById('music-mode-btn').textContent = {'order': 'In order', 'random': 'Shuffle', 'single': 'Repeat one'}[runtime.musicState.playMode]; }

export async function addSongFromURL() { const url = await showCustomPrompt("Add Track by URL", "Enter the track URL", "", "url"); if (!url) return; const name = await showCustomPrompt("Track Information", "Enter the track title"); if (!name) return; const artist = await showCustomPrompt("Track Information", "Enter the artist’s name"); if (!artist) return; runtime.musicState.playlist.push({ name, artist, src: url, isLocal: false }); await saveGlobalPlaylist(); updatePlaylistUI(); if(runtime.musicState.currentIndex === -1) { runtime.musicState.currentIndex = runtime.musicState.playlist.length - 1; updatePlayerUI(); } }

export async function addSongFromLocal(event) {
            const files = event.target.files;
            if (!files.length) return;
        
            for (const file of files) {
                let name = file.name.replace(/\.[^/.]+$/, "");
                name = await showCustomPrompt("Track Information", "Enter the track title", name);
                if (name === null) continue;
                
                const artist = await showCustomPrompt("Track Information", "Enter the artist’s name", "未知歌手");
                if (artist === null) continue;
        
                let lrcContent = "";
                const wantLrc = await showCustomConfirm("Import Lyrics", `Add lyrics for “${name}”?`);
                if (wantLrc) {
                    
                    lrcContent = await getLrcContent() || ""; // 如果用户取消，则lrcContent为""
                }
                
                runtime.musicState.playlist.push({ 
                    name, 
                    artist, 
                    src: file, 
                    isLocal: true,
                    lrcContent: lrcContent
                });
            }
            
            await saveGlobalPlaylist();
            updatePlaylistUI();
            if (runtime.musicState.currentIndex === -1 && runtime.musicState.playlist.length > 0) {
                runtime.musicState.currentIndex = 0;
                updatePlayerUI();
            }
            event.target.value = null;
        }

export async function playSong(index) {
    if (index < 0 || index >= runtime.musicState.playlist.length) return;

    runtime.audioPlayer.pause();

    runtime.musicState.currentIndex = index;
    const track = runtime.musicState.playlist[index];
    const chat = runtime.state.chats[runtime.musicState.activeChatId]; 

    
    const avatarDisplay = document.getElementById('music-player-avatar-display');
    if (chat && avatarDisplay) {
        
        avatarDisplay.innerHTML = '';

        
        const charAvatarUrl = chat.isGroup 
            ? (chat.members.find(m => m.originalName === track.artist)?.avatar || runtime.defaultAvatar) 
            : (chat.settings.aiAvatar || runtime.defaultAvatar);
        const userAvatarUrl = chat.settings.myAvatar || runtime.defaultAvatar;

        
        const charAvatarEl = document.createElement('img');
        charAvatarEl.src = charAvatarUrl;
        charAvatarEl.className = 'participant-display-avatar';
        charAvatarEl.alt = 'Character Avatar';
        avatarDisplay.appendChild(charAvatarEl);

        
        const userAvatarEl = document.createElement('img');
        userAvatarEl.src = userAvatarUrl;
        userAvatarEl.className = 'participant-display-avatar';
        userAvatarEl.alt = 'User Avatar';
        avatarDisplay.appendChild(userAvatarEl);
    }
    

    const playerWindow = document.querySelector('.music-player-window');
    const toggleBtn = document.getElementById('toggle-blur-btn');

    if (playerWindow) {
        playerWindow.style.setProperty('--music-bg-image', track.background ? `url(${track.background})` : 'none');
        playerWindow.classList.toggle('bg-clear', !!track.isBgClear);
    }
    if (toggleBtn) {
        toggleBtn.classList.toggle('active', !!track.isBgClear);
    }
    
    
    document.getElementById('music-visual-container').classList.remove('lyrics-active');
    const coverEl = document.getElementById('music-player-cover');
    if (coverEl) {
        coverEl.src = track.cover || 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1757748720126_qdqqd_1jt5sv.jpeg';
    }
    
    await addMusicActionSystemMessage(`switched to "${track.name}".`);
    runtime.musicState.parsedLyrics = parseLRC(track.lrcContent || "");
    
    renderLyrics(); 
    const singleLyricEl = document.getElementById('single-lyric-display');
    if (singleLyricEl) {
        if (!runtime.musicState.parsedLyrics || runtime.musicState.parsedLyrics.length === 0) {
            singleLyricEl.textContent = "Instrumental";
        } else {
            singleLyricEl.textContent = '♪ ♪ ♪'; 
        }
    }
    
    if (track.isLocal && track.src instanceof ArrayBuffer) {
        const blob = new Blob([track.src], { type: track.fileType || 'audio/mpeg' });
        runtime.audioPlayer.src = URL.createObjectURL(blob);
    } 
    else if (track.isLocal && track.src instanceof Blob) {
        runtime.audioPlayer.src = URL.createObjectURL(track.src);
    } else if (!track.isLocal) {
        runtime.audioPlayer.src = track.src;
    } else {
        console.error('本地歌曲源错误:', track);
        return;
    }
    
    const playPromise = runtime.audioPlayer.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            if (error.name === 'NotAllowedError') {
                console.warn('Autoplay was prevented by the browser.');
                runtime.audioPlayer.pause();
                showCustomAlert("Playback Paused", "The browser requires a tap to start playback. Press Play to continue.");
            } else if (error.name !== 'AbortError') {
                console.error('Playback error:', error);
            }
        });
    }
    updatePlaylistUI();
    updatePlayerUI();
    updateMusicProgressBar();
    
    const lyricBar = document.getElementById('global-lyrics-bar');
    if (runtime.musicState.parsedLyrics && runtime.musicState.parsedLyrics.length > 0) {
        lyricBar.textContent = '♪';
        lyricBar.classList.add('visible');
    } else {
        lyricBar.classList.remove('visible');
    }
}

export async function handleChangeBackground(trackIndex) {
    if (trackIndex < 0 || trackIndex >= runtime.musicState.playlist.length) return;

    
    const choice = await showChoiceModal("更换歌曲背景", [
        { text: '📁 从本地上传', value: 'local' },
        { text: '🌐 使用网络URL', value: 'url' }
    ]);

    let newBackgroundUrl = null;

    
    if (choice === 'local') {
        newBackgroundUrl = await uploadImageLocally();
    } else if (choice === 'url') {
        newBackgroundUrl = await showCustomPrompt("Image URL", "Enter a background image URL", "", "url");
    }

    
    if (newBackgroundUrl && newBackgroundUrl.trim()) {
        runtime.musicState.playlist[trackIndex].background = newBackgroundUrl.trim();
        await saveGlobalPlaylist();
        
        
        if (runtime.musicState.currentIndex === trackIndex) {
            const playerWindow = document.querySelector('.music-player-window');
            playerWindow.style.setProperty('--music-bg-image', `url(${newBackgroundUrl.trim()})`);
        }

        await showCustomAlert("Success", "Track background updated.");
    }
}

export async function handleChangeAlbumArt(trackIndex) {
    if (trackIndex < 0 || trackIndex >= runtime.musicState.playlist.length) return;

    const choice = await showChoiceModal("更换专辑封面", [
        { text: '📁 从本地上传', value: 'local' },
        { text: '🌐 使用网络URL', value: 'url' }
    ]);

    let newCoverUrl = null;

    if (choice === 'local') {
        newCoverUrl = await uploadImageLocally();
    } else if (choice === 'url') {
        newCoverUrl = await showCustomPrompt("Image URL", "Enter a cover image URL", "", "url");
    }

    if (newCoverUrl && newCoverUrl.trim()) {
        runtime.musicState.playlist[trackIndex].cover = newCoverUrl.trim();
        await saveGlobalPlaylist();
        
        
        if (runtime.musicState.currentIndex === trackIndex) {
            document.getElementById('music-player-cover').src = newCoverUrl.trim();
            
            const vinylCover = document.querySelector('#vinyl-view #music-player-cover');
            if(vinylCover) vinylCover.src = newCoverUrl.trim();
        }

        await showCustomAlert("Success", "Album cover updated.");
    }
}

export async function deleteTrack(index) { if (index < 0 || index >= runtime.musicState.playlist.length) return; const track = runtime.musicState.playlist[index]; const wasPlaying = runtime.musicState.isPlaying && runtime.musicState.currentIndex === index; if (track.isLocal && runtime.audioPlayer.src.startsWith('blob:') && runtime.musicState.currentIndex === index) URL.revokeObjectURL(runtime.audioPlayer.src); runtime.musicState.playlist.splice(index, 1); await saveGlobalPlaylist(); if (runtime.musicState.playlist.length === 0) { if (runtime.musicState.isPlaying) runtime.audioPlayer.pause(); runtime.audioPlayer.src = ''; runtime.musicState.currentIndex = -1; runtime.musicState.isPlaying = false; } else { if (wasPlaying) { playNext(); } else { if (runtime.musicState.currentIndex >= index) runtime.musicState.currentIndex = Math.max(0, runtime.musicState.currentIndex - 1); } } updatePlayerUI(); updatePlaylistUI(); }

export async function toggleBackgroundBlur() {
    if (runtime.musicState.currentIndex === -1) return;

    const track = runtime.musicState.playlist[runtime.musicState.currentIndex];
    if (!track) return;

 
    track.isBgClear = !track.isBgClear;

   
    await saveGlobalPlaylist();

  
    const playerWindow = document.querySelector('.music-player-window');
    const toggleBtn = document.getElementById('toggle-blur-btn');
    
    playerWindow.classList.toggle('bg-clear', track.isBgClear);
    toggleBtn.classList.toggle('active', track.isBgClear);
}

export function toggleMusicPlayerAvatars() {
    const avatarDisplay = document.getElementById('music-player-avatar-display');
    const toggleBtn = document.getElementById('show-avatars-btn');
    if (avatarDisplay && toggleBtn) {
        avatarDisplay.classList.toggle('visible');
        toggleBtn.classList.toggle('active');
    }
}

export function togglePlayerFullscreen() {
    const playerWindow = document.querySelector('.music-player-window');
    const overlay = document.getElementById('music-player-overlay');
    if (playerWindow && overlay) {
        
        playerWindow.classList.toggle('fullscreen');
        overlay.classList.toggle('fullscreen-active');
    }
}

export async function cleanupInvalidSongs() {
    if (runtime.musicState.playlist.length === 0) {
        alert("The playlist is empty.");
        return;
    }

    const confirmed = await showCustomConfirm(
        "Remove Unavailable Tracks?",
        "Check online tracks and remove any that cannot be played. Local tracks are kept.",
        { confirmText: '开始清理' }
    );

    if (!confirmed) return;

    await showCustomAlert("Please wait…", `Checking ${runtime.musicState.playlist.length} tracks…`);

    const originalCount = runtime.musicState.playlist.length;
    const validPlaylist = [];
    const invalidSongs = [];

    const checkPromises = runtime.musicState.playlist.map(async (track) => {
        if (track.isLocal) {
            validPlaylist.push(track);
            return;
        }
        
        const isAvailable = await checkAudioAvailability(track.src);
        if (isAvailable) {
            validPlaylist.push(track);
        } else {
            invalidSongs.push(track.name);
            console.warn(`无效链接: ${track.name} - ${track.src}`);
        }
    });

    await Promise.all(checkPromises);

    const removedCount = originalCount - validPlaylist.length;

    if (removedCount > 0) {
        const currentPlayingTrack = runtime.musicState.playlist[runtime.musicState.currentIndex];
        const isCurrentTrackRemoved = invalidSongs.includes(currentPlayingTrack?.name);

        runtime.musicState.playlist = validPlaylist;
        await saveGlobalPlaylist();

        if (isCurrentTrackRemoved) {
            runtime.audioPlayer.pause();
            runtime.audioPlayer.src = '';
            runtime.musicState.currentIndex = runtime.musicState.playlist.length > 0 ? 0 : -1;
            runtime.musicState.isPlaying = false;
        } else if (currentPlayingTrack) {
            runtime.musicState.currentIndex = runtime.musicState.playlist.findIndex(t => t.src === currentPlayingTrack.src);
        }

        updatePlaylistUI();
        updatePlayerUI();

        await showCustomAlert("Cleanup Complete", `Removed ${removedCount} unavailable tracks: ${invalidSongs.join('\n- ')}`);
    } else {
        await showCustomAlert("Check Complete", "All track links work.");
    }
}

export function applyStatusBarVisibility() {
    const phoneScreen = document.getElementById('phone-screen');
   
    phoneScreen.classList.toggle('status-bar-visible', !!runtime.state.globalSettings.showStatusBar);
}
