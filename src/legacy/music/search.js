import { parseLRC } from '../chat/sharing.js'
import { showChoiceModal, showCustomAlert, showCustomPrompt } from '../dialogs/dialogs.js'
import { renderLyrics, updateLyricsUI } from './lyrics.js'
import { saveGlobalPlaylist, applyStatusBarVisibility, cleanupInvalidSongs, toggleBackgroundBlur, toggleMusicPlayerAvatars, togglePlayerFullscreen } from './player.js'
import { runtime } from '../runtime/state.js'
import { openClearPostsSelectorModal } from '../qzone/feed.js'

export async function Http_Get(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Music request failed (HTTP ${response.status}).`);
    return response.json();
}

export function checkAudioAvailability(url) {
    return new Promise(resolve => {
        const tester = new Audio();
        tester.addEventListener('loadedmetadata', () => resolve(true), { once: true });
        tester.addEventListener('error', () => resolve(false), { once: true });
        tester.src = url;
    });
}

export async function searchNeteaseMusic(name, singer) {
    try {
        let searchTerm = name.replace(/\s/g, "");
        if (singer) { searchTerm += ` ${singer.replace(/\s/g, "")}`; }

        const apiUrl = `https://api.vkeys.cn/v2/music/netease?word=${encodeURIComponent(searchTerm)}`;
        
        console.log("正在请求网易云音乐API:", apiUrl);
        
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`API 请求失败，状态码: ${response.status}`);
        }
        
        const result = await response.json();

        if (result.code !== 200 || !result.data || result.data.length === 0) {
            console.log("网易云音乐API未返回有效结果:", result);
            return [];
        }
        

        return result.data.map(song => ({
            name: song.song,
            artist: song.singer,
            id: song.id,
            cover: song.cover || 'https://i.postimg.cc/pT2xKzPz/album-cover-placeholder.png',
            source: 'netease'
        })).slice(0, 30); // 最多返回15条结果

    } catch (e) {
        console.error("网易云音乐搜索失败:", e);

        return [];
    }
}

export async function searchTencentMusic(name) {
    try {
        name = name.replace(/\s/g, "");
        const result = await Http_Get(`https://api.vkeys.cn/v2/music/tencent?word=${encodeURIComponent(name)}`);
        if (!result?.data?.length) return [];
        return result.data.map(song => ({
            name: song.song,
            artist: song.singer,
            id: song.id,
            cover: song.cover || 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1757748720126_qdqqd_1jt5sv.jpeg',
            source: 'tencent'
        })).slice(0, 30);
    } catch (e) {
        console.error("QQ音乐搜索API失败:", e);
        return [];
    }
}

export async function addSongFromSearch() {
    const searchTerm = await showCustomPrompt("Search Music", "Enter a title or title–artist");
    if (!searchTerm || !searchTerm.trim()) return;

    await showCustomAlert("Please wait…", "Searching for music…");

    let musicName = searchTerm.trim();
    let singerName = "";
    if (searchTerm.includes('-') || searchTerm.includes('–')) {
        const parts = searchTerm.split(/[-–]/);
        musicName = parts[0].trim();
        singerName = parts.slice(1).join(' ').trim();
    }

    const [neteaseResults, tencentResults] = await Promise.all([
        searchNeteaseMusic(musicName, singerName),
        searchTencentMusic(musicName)
    ]);

    const combinedResults = [...neteaseResults, ...tencentResults];

    if (combinedResults.length === 0) {
        await showCustomAlert("No Results", "No matching tracks found.");
        return;
    }

    const modal = document.getElementById('music-search-results-modal');
    const listEl = document.getElementById('search-results-list');
    listEl.innerHTML = '';
    // 重置全选框状态
    document.getElementById('select-all-music-search').checked = false;

    combinedResults.forEach(song => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.dataset.songJson = JSON.stringify(song);
        
        item.innerHTML = `
            <input type="checkbox" class="music-search-checkbox" style="margin-right: 15px;">
            <div class="search-result-info">
                <div class="title">${song.name}</div>
                <div class="artist">${song.artist} <span class="source">${song.source === 'netease' ? '网易云' : 'QQ音乐'}</span></div>
            </div>
        `;
        listEl.appendChild(item);
    });

    modal.classList.add('visible');
}

export async function getPlayableSongDetails(songData) {
    let playableResult = null;
    let finalSource = songData.source;


    const primaryApiUrl = songData.source === 'netease' 
        ? `https://api.vkeys.cn/v2/music/netease?id=${songData.id}`
        : `https://api.vkeys.cn/v2/music/tencent?id=${songData.id}`;
    
let primaryResult = await Http_Get(primaryApiUrl);
        if (primaryResult?.data?.url) {
        playableResult = { url: primaryResult.data.url, id: songData.id, source: songData.source };
    }


    if (!playableResult) {
        const fallbackSource = songData.source === 'netease' ? 'tencent' : 'netease';
        const fallbackResults = fallbackSource === 'tencent' 
            ? await searchTencentMusic(songData.name)
            : await searchNeteaseMusic(songData.name, songData.artist);

        if (fallbackResults.length > 0) {
            const fallbackApiUrl = fallbackSource === 'netease'
                ? `https://api.vkeys.cn/v2/music/netease?id=${fallbackResults[0].id}`
                : `https://api.vkeys.cn/v2/music/tencent?id=${fallbackResults[0].id}`;
const fallbackResult = await Http_Get(fallbackApiUrl);
            if (fallbackResult?.data?.url) {
                playableResult = { url: fallbackResult.data.url, id: fallbackResults[0].id, source: fallbackSource };
                finalSource = fallbackSource;
            }
        }
    }

    
if (playableResult) {
        
        if (playableResult.url && typeof playableResult.url === 'string') {
            playableResult.url = playableResult.url.replace(/^http:\/\//i, 'https://');
        }
          

 
        if (songData.cover && typeof songData.cover === 'string') {
            songData.cover = songData.cover.replace(/^http:\/\//i, 'https://');
        }
      

        const lrcContent = await getLyricsForSong(playableResult.id, finalSource) || "";
        return {
            name: songData.name,
            artist: songData.artist,
            src: playableResult.url, 
            cover: songData.cover,   // <--- 现在这个URL是安全的了
            isLocal: false,
            lrcContent: lrcContent
        };
    }


    return null;
}

export async function getLyricsForSong(songId, source) {
    const url = source === 'netease'
        ? `https://api.vkeys.cn/v2/music/netease/lyric?id=${songId}`
        : `https://api.vkeys.cn/v2/music/tencent/lyric?id=${songId}`;
    
    const response = await Http_Get(url);
    if (response?.data) {
        const lrc = response.data.lrc || response.data.lyric || "";
        const tlyric = response.data.trans || response.data.tlyric || "";
        return lrc + "\n" + tlyric;
    }
    return "";
}

export async function handleManualLrcImport(trackIndex) {
    if (trackIndex < 0 || trackIndex >= runtime.musicState.playlist.length) return;

    const choice = await showChoiceModal('选择歌词导入方式', [
        { text: '📁 从本地文件 (.lrc)', value: 'file' },
        { text: '📋 直接粘贴歌词文本', value: 'paste' }
    ]);

    let lrcContent = null;

    if (choice === 'file') {
        lrcContent = await new Promise(resolve => {
            const lrcInput = document.getElementById('lrc-upload-input');
            const lrcChangeHandler = e => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = readEvent => resolve(readEvent.target.result);
                    reader.onerror = () => resolve(null);
                    reader.readAsText(file);
                } else { resolve(null); }
                lrcInput.removeEventListener('change', lrcChangeHandler);
                lrcInput.value = '';
            };
            lrcInput.addEventListener('change', lrcChangeHandler, { once: true });
            lrcInput.click();
        });
    } else if (choice === 'paste') {
        const pastedText = await showCustomPrompt("Paste Lyrics", "Paste the complete LRC lyrics here…", '', 'textarea');
        if (pastedText) lrcContent = pastedText.replace(/\[/g, '\n[').trim();
    }

    if (lrcContent !== null) {
        runtime.musicState.playlist[trackIndex].lrcContent = lrcContent;


        await saveGlobalPlaylist(); // 将更新后的播放列表保存到数据库


        if (runtime.musicState.currentIndex === trackIndex) {
            runtime.musicState.parsedLyrics = parseLRC(lrcContent);
            renderLyrics();
            updateLyricsUI();
        }
        await showCustomAlert("Success", `Lyrics saved for “${runtime.musicState.playlist[trackIndex].name}”.`);
    }
}

export function bindMusicSearchEvents() {
  document.getElementById('music-visual-container').addEventListener('click', () => {
    document.getElementById('music-visual-container').classList.toggle('lyrics-active');
});

document.getElementById('add-song-search-btn').addEventListener('click', addSongFromSearch);

document.getElementById('cancel-music-search-btn').addEventListener('click', () => {
    document.getElementById('music-search-results-modal').classList.remove('visible');
});

document.getElementById('cleanup-songs-btn').addEventListener('click', cleanupInvalidSongs);

document.getElementById('toggle-blur-btn').addEventListener('click', toggleBackgroundBlur);

document.getElementById('toggle-fullscreen-btn').addEventListener('click', togglePlayerFullscreen);

document.getElementById('show-avatars-btn').addEventListener('click', toggleMusicPlayerAvatars);

document.getElementById('status-bar-toggle-switch').addEventListener('change', () => {
    
    runtime.state.globalSettings.showStatusBar = document.getElementById('status-bar-toggle-switch').checked;
    applyStatusBarVisibility();
});

document.getElementById('qzone-more-actions-btn').addEventListener('click', openClearPostsSelectorModal);

document.getElementById('cancel-clear-posts-btn').addEventListener('click', () => {
    document.getElementById('clear-posts-modal').classList.remove('visible');
});
}
