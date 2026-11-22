import { parseLRC } from '../chat/sharing.js'
import { formatMusicTime } from '../music/lyrics.js'
import { runtime } from '../runtime/state.js'

export function renderCharMusicScreen() {
    const listEl = document.getElementById('char-music-list');
    listEl.innerHTML = '';
    if (!runtime.activeCharacterId) return;

    const char = runtime.state.chats[runtime.activeCharacterId];
    const playlist = char.simulatedMusicPlaylist || [];

    if (playlist.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">This playlist is empty.<br>Use Regenerate to generate tracks.</p>";
        return;
    }

    playlist.forEach((track, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'char-music-item';
        itemEl.innerHTML = `
            <img src="${track.cover}" class="music-item-cover">
            <div class="music-item-info">
                <div class="music-item-name">${track.name}</div>
                <div class="music-item-artist">${track.artist}</div>
            </div>
        `;
       
        itemEl.addEventListener('click', () => playCharSong(track));
        listEl.appendChild(itemEl);
    });
}

export function playCharSong(songObject) {
    const player = document.getElementById('char-audio-player');
    const modal = document.getElementById('char-music-player-modal');
    
    if (runtime.charPlayerState.lrcUpdateInterval) clearInterval(runtime.charPlayerState.lrcUpdateInterval);
    player.pause();
    
    const songIndex = runtime.charPlayerState.currentPlaylist.findIndex(s => s.src === songObject.src);
    if (songIndex > -1) {
        runtime.charPlayerState.currentIndex = songIndex;
    } else {
        runtime.charPlayerState.currentPlaylist = [songObject];
        runtime.charPlayerState.currentIndex = 0;
    }

    // 更新UI
    document.getElementById('char-music-player-title').textContent = songObject.name;
    document.getElementById('char-music-artist').textContent = songObject.artist;
    document.getElementById('char-music-cover').src = songObject.cover;
    
   
    runtime.charPlayerState.parsedLyrics = parseLRC(songObject.lrcContent || "");
    renderCharLyrics(); 


    if (songObject.isLocal) {
        const blob = new Blob([songObject.src], { type: songObject.fileType || 'audio/mpeg' });
        player.src = URL.createObjectURL(blob);
    } else {
        player.src = songObject.src;
    }
    player.play().catch(e => console.error("音频播放失败:", e));

    player.onloadedmetadata = () => {
        document.getElementById('char-music-total-time').textContent = formatMusicTime(player.duration);
        runtime.charPlayerState.lrcUpdateInterval = setInterval(updateCharMusicProgress, 500);
    };

    modal.classList.add('visible');
}

export function closeCharMusicPlayer() {
    const modal = document.getElementById('char-music-player-modal');
    const player = document.getElementById('char-audio-player');
    
    if (runtime.charPlayerState.lrcUpdateInterval) clearInterval(runtime.charPlayerState.lrcUpdateInterval);
    player.pause();
    player.src = ''; 
    modal.classList.remove('visible');
    runtime.charPlayerState.isPlaying = false;
    document.getElementById('char-vinyl-container').classList.remove('spinning');
}

export function updateCharMusicProgress() {
    const player = document.getElementById('char-audio-player');
    if (!player.duration) return;

    const currentTime = player.currentTime;
    const duration = player.duration;
    document.getElementById('char-music-progress-fill').style.width = `${(currentTime / duration) * 100}%`;
    document.getElementById('char-music-current-time').textContent = formatMusicTime(currentTime);

  
    updateCharActiveLyric(currentTime);
}

export function renderCharLyrics() {
    const lyricsContainer = document.getElementById('char-music-lyrics');
    lyricsContainer.innerHTML = '';
    runtime.charPlayerState.currentLyricIndex = -1; 
    if (!runtime.charPlayerState.parsedLyrics || runtime.charPlayerState.parsedLyrics.length === 0) {
        lyricsContainer.innerHTML = "<p>♪ No lyrics ♪</p>";
        return;
    }
    runtime.charPlayerState.parsedLyrics.forEach((line, index) => {
        const p = document.createElement('p');
        p.textContent = line.text;
        p.dataset.index = index;
        lyricsContainer.appendChild(p);
    });
}

export function updateCharActiveLyric(currentTime) {
    const lyrics = runtime.charPlayerState.parsedLyrics;
    if (lyrics.length === 0) return;

    let newLyricIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (currentTime >= lyrics[i].time) {
            newLyricIndex = i;
        } else {
            break;
        }
    }
    if (newLyricIndex === runtime.charPlayerState.currentLyricIndex) return;
    runtime.charPlayerState.currentLyricIndex = newLyricIndex;

    const lyricsContainer = document.getElementById('char-music-lyrics');
    const lines = lyricsContainer.querySelectorAll('p');
    lines.forEach(line => line.classList.remove('active'));
    
    if (newLyricIndex > -1) {
        const activeLine = lyricsContainer.querySelector(`p[data-index="${newLyricIndex}"]`);
        if (activeLine) {
            activeLine.classList.add('active');
       
            const offset = (lyricsContainer.clientHeight / 2) - activeLine.offsetTop - (activeLine.offsetHeight / 2);
            lines.forEach(line => {
                line.style.transform = `translateY(${offset}px)`;
            });
        }
    }
}

export function playNextCharSong() {
    if (runtime.charPlayerState.currentPlaylist.length === 0) return;
    let nextIndex;
    switch(runtime.charPlayerState.playMode) {
        case 'random':
            nextIndex = Math.floor(Math.random() * runtime.charPlayerState.currentPlaylist.length);
            break;
        case 'single':
       
            playCharSong(runtime.charPlayerState.currentPlaylist[runtime.charPlayerState.currentIndex]);
            return;
        case 'order':
        default:
            nextIndex = (runtime.charPlayerState.currentIndex + 1) % runtime.charPlayerState.currentPlaylist.length;
            break;
    }
    playCharSong(runtime.charPlayerState.currentPlaylist[nextIndex]);
}

export function playPrevCharSong() {
    if (runtime.charPlayerState.currentPlaylist.length === 0) return;
    const newIndex = (runtime.charPlayerState.currentIndex - 1 + runtime.charPlayerState.currentPlaylist.length) % runtime.charPlayerState.currentPlaylist.length;
    playCharSong(runtime.charPlayerState.currentPlaylist[newIndex]);
}

export function changeCharPlayMode() {
    const modes = ['order', 'random', 'single'];
    const currentModeIndex = modes.indexOf(runtime.charPlayerState.playMode);
    runtime.charPlayerState.playMode = modes[(currentModeIndex + 1) % modes.length];
    document.getElementById('char-music-mode-btn').textContent = {'order': 'In order', 'random': 'Shuffle', 'single': 'Repeat one'}[runtime.charPlayerState.playMode];
}

export function setupCharPlayerControls() {
    const player = document.getElementById('char-audio-player');
    const playBtn = document.getElementById('char-music-play-pause-btn');
    const vinyl = document.getElementById('char-vinyl-container');

    playBtn.addEventListener('click', () => {
        if (player.paused) {
            if(runtime.charPlayerState.currentIndex > -1) player.play();
        } else {
            player.pause();
        }
    });
    
    player.onplay = () => {
        playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>`;
        vinyl.classList.add('spinning');
        runtime.charPlayerState.isPlaying = true;
    };
    player.onpause = () => {
        playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>`;
        vinyl.classList.remove('spinning');
        runtime.charPlayerState.isPlaying = false;
    };
    player.onended = () => {
        vinyl.classList.remove('spinning');
        runtime.charPlayerState.isPlaying = false;
        playNextCharSong();
    };

    document.getElementById('char-music-prev-btn').addEventListener('click', playPrevCharSong);
    document.getElementById('char-music-next-btn').addEventListener('click', playNextCharSong);
    document.getElementById('char-music-mode-btn').addEventListener('click', changeCharPlayMode);

    document.getElementById('char-music-progress-bar').addEventListener('click', (e) => {
        if (!player.duration) return;
        const bar = e.currentTarget;
        const clickX = e.offsetX;
        player.currentTime = (clickX / bar.clientWidth) * player.duration;
    });
}
