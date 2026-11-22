import { showChoiceModal, showCustomPrompt } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export async function getLrcContent() {
            
            const choice = await showChoiceModal('选择歌词导入方式', [
                { text: '📁 从本地文件 (.lrc)', value: 'file' },
                { text: '📋 直接粘贴歌词文本', value: 'paste' }
            ]);
        
            
            if (choice === 'file') {
                
                return new Promise(resolve => {
                    const lrcInput = document.getElementById('lrc-upload-input');
                    const lrcChangeHandler = (e) => {
                        const lrcFile = e.target.files[0];
                        if (lrcFile) {
                            const reader = new FileReader();
                            reader.onload = (readEvent) => resolve(readEvent.target.result);
                            reader.onerror = () => resolve(""); 
                            reader.readAsText(lrcFile);
                        } else {
                            resolve(null); 
                        }
                        lrcInput.removeEventListener('change', lrcChangeHandler);
                        lrcInput.value = ''; 
                    };
                    lrcInput.addEventListener('change', lrcChangeHandler, { once: true });
                    lrcInput.click();
                });
            } else if (choice === 'paste') {
                
                const pastedText = await showCustomPrompt(
                    "Paste Lyrics",
                    "Paste the complete LRC lyrics here…",
                    '',
                    'textarea' 
                );
                
                
                if (pastedText) {
                    
                    
                    const formattedText = pastedText.replace(/\[/g, '\n[').trim();
                    return formattedText;
                }
                return pastedText; 
                
        
            } else {
                
                return null;
            }
        }

export function renderLyrics() {
    const lyricsList = document.getElementById('music-lyrics-list');
    lyricsList.innerHTML = '';
    if (!runtime.musicState.parsedLyrics || runtime.musicState.parsedLyrics.length === 0) {
        lyricsList.innerHTML = "<div class=\"lyric-line\">♪ No lyrics ♪</div>";
        return;
    }
    runtime.musicState.parsedLyrics.forEach((line, index) => {
        const lineEl = document.createElement('div');
        lineEl.className = 'lyric-line';
        lineEl.textContent = line.text;
        lineEl.dataset.index = index;
        lyricsList.appendChild(lineEl);
    });
    lyricsList.style.transform = `translateY(0px)`;
}

export function updateActiveLyric(currentTime) {
    if (runtime.musicState.parsedLyrics.length === 0) return;
    let newLyricIndex = -1;
    for (let i = 0; i < runtime.musicState.parsedLyrics.length; i++) {
        if (currentTime >= runtime.musicState.parsedLyrics[i].time) {
            newLyricIndex = i;
        } else {
            break;
        }
    }
    if (newLyricIndex === runtime.musicState.currentLyricIndex) return;
    runtime.musicState.currentLyricIndex = newLyricIndex;
    updateLyricsUI();
    
    const singleLyricEl = document.getElementById('single-lyric-display');
    if (singleLyricEl) {
        if (newLyricIndex > -1 && runtime.musicState.parsedLyrics[newLyricIndex]) {
            singleLyricEl.textContent = runtime.musicState.parsedLyrics[newLyricIndex].text;
        } else {
            singleLyricEl.textContent = '♪ ♪ ♪';
        }
    }

    const lyricBar = document.getElementById('global-lyrics-bar');
    if (lyricBar.classList.contains('visible')) {
        if (newLyricIndex > -1 && runtime.musicState.parsedLyrics[newLyricIndex]) {
            lyricBar.textContent = runtime.musicState.parsedLyrics[newLyricIndex].text;
        } else {
            lyricBar.textContent = '♪';
        }
    }
}

export function updateLyricsUI(isFullscreen = false) {
    const listSelector = isFullscreen ? '#fullscreen-lyrics-container .music-lyrics-list' : '#music-lyrics-container #music-lyrics-list';
    const containerSelector = isFullscreen ? '#fullscreen-lyrics-container' : '#music-lyrics-container';
    
    const lyricsList = document.querySelector(listSelector);
    const container = document.querySelector(containerSelector);
    if (!lyricsList || !container) return;

    const lines = lyricsList.querySelectorAll('.lyric-line');
    lines.forEach(line => line.classList.remove('active'));

    if (runtime.musicState.currentLyricIndex === -1) {
        lyricsList.style.transform = `translateY(0px)`;
        return;
    }

    const activeLine = lyricsList.querySelector(`.lyric-line[data-index="${runtime.musicState.currentLyricIndex}"]`);
    if (activeLine) {
        activeLine.classList.add('active');
        const containerHeight = container.offsetHeight;
        const offset = (containerHeight / 2.2) - activeLine.offsetTop - (activeLine.offsetHeight / 2);
        lyricsList.style.transform = `translateY(${offset}px)`;
    }
}

export function formatMusicTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function updateMusicProgressBar() {
    if (runtime.animationFrameId) {
        cancelAnimationFrame(runtime.animationFrameId);
    }

    function step() {
        if (!runtime.musicState.isPlaying || !runtime.audioPlayer.duration) {
            return; 
        }
        
        const now = performance.now();
        const currentTime = runtime.audioPlayer.currentTime;
        const duration = runtime.audioPlayer.duration;

        const progressPercent = (currentTime / duration) * 100;
        document.getElementById('music-progress-fill').style.width = `${progressPercent}%`;

        if (now - runtime.lastTimeUpdate > 1000) {
            document.getElementById('music-current-time').textContent = formatMusicTime(currentTime);
            document.getElementById('music-total-time').textContent = formatMusicTime(duration);
            runtime.lastTimeUpdate = now;
        }

        updateActiveLyric(currentTime);

        runtime.animationFrameId = requestAnimationFrame(step);
    }

    runtime.animationFrameId = requestAnimationFrame(step);
}
