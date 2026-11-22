import { handleSpectatorReroll } from '../chat/ai.js'
import { addLongPressListener } from '../dialogs/dialogs.js'
import { openDoubanSettingsModal, saveDoubanSettings } from '../douban/forum.js'
import { openAiResponseEditor } from '../chat/editor.js'
import { handleChangeAlbumArt } from '../music/player.js'
import { openNpcEditor, saveNpc } from './npcs.js'
import { runtime } from '../runtime/state.js'

export function bindNpcEvents() {
  document.getElementById('add-npc-btn').addEventListener('click', () => openNpcEditor(null));

document.getElementById('save-npc-btn').addEventListener('click', saveNpc);

document.getElementById('cancel-npc-editor-btn').addEventListener('click', () => {
    document.getElementById('npc-editor-modal').classList.remove('visible');
});

document.getElementById('npc-avatar-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('npc-avatar-preview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('chat-lock-overlay').addEventListener('click', (e) => {
    
    if (e.target.id === 'spectator-reroll-btn') {
        handleSpectatorReroll();
    }
    
    else if (e.target.id === 'spectator-edit-btn') {
        
        openAiResponseEditor();
    }
    
});

addLongPressListener(document.getElementById('music-visual-container'), () => { if (runtime.musicState.currentIndex > -1) { handleChangeAlbumArt(runtime.musicState.currentIndex); } });

document.getElementById('douban-settings-btn').addEventListener('click', openDoubanSettingsModal);

document.getElementById('save-douban-settings-btn').addEventListener('click', saveDoubanSettings);

document.getElementById('cancel-douban-settings-btn').addEventListener('click', () => {
    document.getElementById('douban-settings-modal').classList.remove('visible');
});
}
