import { showCustomAlert } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export function playSilentAudio() {
    const silentPlayer = document.getElementById('silent-audio-player');
    if (silentPlayer) {
        
        const playPromise = silentPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                console.log("静音音频已启动，用于后台活动保活。");
            }).catch(error => {
                
                
                console.warn("无法自动播放静音音频（这在iOS首次加载时是正常现象）:", error);
            });
        }
    }
}

export function stopSilentAudio() {
    const silentPlayer = document.getElementById('silent-audio-player');
    if (silentPlayer && !silentPlayer.paused) {
        silentPlayer.pause();
        silentPlayer.currentTime = 0; 
        console.log("静音音频已停止。");
    }
}

export async function playTtsAudio(bodyElement) {
    const text = decodeURIComponent(bodyElement.dataset.text);
    const voiceId = bodyElement.dataset.voiceId;
    const button = bodyElement.querySelector('.voice-play-btn'); 
    const spinner = bodyElement.querySelector('.loading-spinner');

    const ttsPlayer = document.getElementById('tts-audio-player');
    if (!ttsPlayer.paused && ttsPlayer.dataset.currentText === text && ttsPlayer.dataset.currentVoiceId === voiceId) {
        ttsPlayer.pause();
        return;
    }

    ttsPlayer.pause();
    document.querySelectorAll('.voice-play-btn').forEach(btn => btn.textContent = '▶');

    const cacheKey = `tts_${voiceId}_${text}`;
    let cachedAudio = runtime.state.ttsCache.get(cacheKey);

    if (cachedAudio) {
        console.log("从缓存播放 TTS 音频...");
        await playAudioFromData(cachedAudio.url, cachedAudio.type, text, voiceId, bodyElement); 
        return;
    }

    console.log("无缓存，正在请求 Minimax TTS API...");
    if(button) button.style.display = 'none';
    spinner.style.display = 'block';

    const { minimaxGroupId, minimaxApiKey } = runtime.state.apiConfig;
    if (!minimaxGroupId || !minimaxApiKey) {
        await showCustomAlert("Configuration Error", "Enter your MiniMax Group ID and API key in API Connections.");
        spinner.style.display = 'none';
        if(button) button.style.display = 'flex';
        return;
    }

    try {
        const response = await fetch(`https://api.minimax.chat/v1/text_to_speech?GroupId=${minimaxGroupId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${minimaxApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                voice_id: voiceId,
                model: runtime.state.apiConfig.minimaxModel || "speech-01",
                speed: 1.0, vol: 1.0, pitch: 0,
            })
        });

        if (!response.ok) {
            let errorMsg = `API 返回错误: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.base_resp?.status_msg || JSON.stringify(errorData);
            } catch(e) {
                errorMsg = await response.text();
            }
            throw new Error(errorMsg);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        await playAudioFromData(audioUrl, audioBlob.type, text, voiceId, bodyElement); 

        const reader = new FileReader();
        reader.onloadend = function() {
            runtime.state.ttsCache.set(cacheKey, { url: reader.result, type: audioBlob.type });
            console.log("TTS 音频已保存到缓存。");
        }
        reader.readAsDataURL(audioBlob);

    } catch (error) {
        console.error("Minimax TTS API 调用失败:", error);
        await showCustomAlert("Voice Generation Failed", `Error: ${error.message}`);
    } finally {
        spinner.style.display = 'none';
        if(button) button.style.display = 'flex';
    }
}

export function playAudioFromData(audioSrc, audioType, text, voiceId, bodyElement) { 
    return new Promise((resolve, reject) => {
        const ttsPlayer = document.getElementById('tts-audio-player');

        ttsPlayer.src = audioSrc;
        ttsPlayer.type = audioType;
        ttsPlayer.dataset.currentText = text;
        ttsPlayer.dataset.currentVoiceId = voiceId;

        const playPromise = ttsPlayer.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                const button = bodyElement.querySelector('.voice-play-btn');
                if (button) button.textContent = '❚❚'; 


                resolve();
            }).catch(error => {
                console.error("音频播放失败:", error);
                reject(error);
            });
        }

        ttsPlayer.onended = () => {
            const button = bodyElement.querySelector('.voice-play-btn');
            if (button) button.textContent = '▶'; 
        };
        ttsPlayer.onpause = () => {
            const button = bodyElement.querySelector('.voice-play-btn');
            if (button) button.textContent = '▶';
        };
    });
}

export function toggleVoiceTranscript(bodyElement) {
    const bubble = bodyElement.closest('.message-bubble');
    if (!bubble) return;

    const transcriptEl = bubble.querySelector('.voice-transcript');
    const text = decodeURIComponent(bodyElement.dataset.text);

    if (transcriptEl.style.display === 'block') {
        
        transcriptEl.style.display = 'none';
    } else {
        
        transcriptEl.textContent = text;
        transcriptEl.style.display = 'block';
    }
}
