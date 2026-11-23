import { executeBatchDeleteFrames, handleSelectAllFrames, toggleFrameManagementMode } from '../avatars/frames.js'
import { switchToCharScreen } from '../character-phone/launcher.js'
import { generateNovelAIImage, loadNovelAISettings, resetNovelAISettings, saveNovelAISettings } from './images.js'
import { handleDeleteCurrentCategory } from '../shopping/store.js'
import { runtime } from '../runtime/state.js'

export function bindNovelAiEvents() {
  document.getElementById('novelai-key-toggle').addEventListener('click', function() {
    const input = document.getElementById('novelai-api-key');
    if (input.type === 'password') {
        input.type = 'text';
        this.textContent = '😌';
    } else {
        input.type = 'password';
        this.textContent = '🧐';
    }
});

document.getElementById('novelai-settings-btn').addEventListener('click', () => {
    loadNovelAISettings();
    document.getElementById('novelai-settings-modal').style.display = 'flex';
});

document.getElementById('nai-cors-proxy').addEventListener('change', (e) => {
    const customProxyGroup = document.getElementById('nai-custom-proxy-group');
    if (e.target.value === 'custom') {
        customProxyGroup.style.display = 'block';
    } else {
        customProxyGroup.style.display = 'none';
    }
});

document.getElementById('close-novelai-settings').addEventListener('click', () => {
    document.getElementById('novelai-settings-modal').style.display = 'none';
});

document.getElementById('save-nai-settings-btn').addEventListener('click', () => {
    saveNovelAISettings();
    document.getElementById('novelai-settings-modal').style.display = 'none';
    alert("NovelAI settings saved.");
});

document.getElementById('reset-nai-settings-btn').addEventListener('click', () => {
    if (confirm("Restore default settings?")) {
        resetNovelAISettings();
    }
});

document.getElementById('novelai-test-btn').addEventListener('click', () => {
    const apiKey = document.getElementById('novelai-api-key').value.trim();
    if (!apiKey) {
        alert("Enter your NovelAI API key.");
        return;
    }
    document.getElementById('novelai-test-modal').style.display = 'flex';
    document.getElementById('nai-test-result').style.display = 'none';
    document.getElementById('nai-test-error').style.display = 'none';
});

document.getElementById('close-novelai-test').addEventListener('click', () => {
    document.getElementById('novelai-test-modal').style.display = 'none';
});

document.getElementById('close-nai-test-btn').addEventListener('click', () => {
    document.getElementById('novelai-test-modal').style.display = 'none';
});

document.getElementById('nai-generate-btn').addEventListener('click', async () => {
    await generateNovelAIImage();
});

document.getElementById('nai-download-btn').addEventListener('click', () => {
    const img = document.getElementById('nai-result-image');
    const link = document.createElement('a');
    link.href = img.src;
    link.download = 'novelai-generated-' + Date.now() + '.png';
    link.click();
});

document.getElementById('character-nai-prompts-btn').addEventListener('click', () => {
    if (!runtime.state.activeChatId) return;
    const chat = runtime.state.chats[runtime.state.activeChatId];
    
    // 加载当前角色的NAI提示词配置
    const naiSettings = chat.settings.naiSettings || {
        promptSource: 'system',
        characterPositivePrompt: '',
        characterNegativePrompt: ''
    };
    
    // ★★★ 严格加载角色配置，不与系统配置混淆 ★★★
    // 填了就有，没填就为空，绝不使用系统配置填充
    document.getElementById('character-nai-positive').value = naiSettings.characterPositivePrompt || '';
    document.getElementById('character-nai-negative').value = naiSettings.characterNegativePrompt || '';
    
    document.getElementById('character-nai-prompts-modal').style.display = 'flex';
});

document.getElementById('close-character-nai-prompts').addEventListener('click', () => {
    document.getElementById('character-nai-prompts-modal').style.display = 'none';
});

document.getElementById('save-character-nai-prompts-btn').addEventListener('click', async () => {
    if (!runtime.state.activeChatId) return;
    const chat = runtime.state.chats[runtime.state.activeChatId];
    
    if (!chat.settings.naiSettings) {
        chat.settings.naiSettings = {
            promptSource: 'system'
        };
    }
    
    chat.settings.naiSettings.characterPositivePrompt = document.getElementById('character-nai-positive').value.trim();
    chat.settings.naiSettings.characterNegativePrompt = document.getElementById('character-nai-negative').value.trim();
    
    console.log('💾 [专属弹窗] 保存角色NAI提示词');
    console.log('   characterPositivePrompt:', chat.settings.naiSettings.characterPositivePrompt);
    console.log('   characterNegativePrompt:', chat.settings.naiSettings.characterNegativePrompt);
    console.log('   promptSource:', chat.settings.naiSettings.promptSource);
    
    // 保存到数据库
    await runtime.db.chats.put(chat);
    
    document.getElementById('character-nai-prompts-modal').style.display = 'none';
    alert("Character image prompts saved.");
});

document.getElementById('reset-character-nai-prompts-btn').addEventListener('click', () => {
    if (confirm("Clear this character’s NovelAI prompts?")) {
        document.getElementById('character-nai-positive').value = '';
        document.getElementById('character-nai-negative').value = '';
    }
});

document.getElementById('group-character-nai-prompts-btn').addEventListener('click', () => {
    if (!runtime.state.activeChatId) return;
    const chat = runtime.state.chats[runtime.state.activeChatId];
    
    // 加载当前角色的NAI提示词配置
    const naiSettings = chat.settings.naiSettings || {
        promptSource: 'system',
        characterPositivePrompt: '',
        characterNegativePrompt: ''
    };
    
    // ★★★ 严格加载角色配置，不与系统配置混淆 ★★★
    // 填了就有，没填就为空，绝不使用系统配置填充
    document.getElementById('character-nai-positive').value = naiSettings.characterPositivePrompt || '';
    document.getElementById('character-nai-negative').value = naiSettings.characterNegativePrompt || '';
    
    document.getElementById('character-nai-prompts-modal').style.display = 'flex';
});

document.getElementById('manage-frames-btn').addEventListener('click', toggleFrameManagementMode);

document.getElementById('select-all-frames-checkbox').addEventListener('change', handleSelectAllFrames);

document.getElementById('delete-selected-frames-btn').addEventListener('click', executeBatchDeleteFrames);

document.getElementById('delete-current-category-btn').addEventListener('click', handleDeleteCurrentCategory);

document.getElementById('char-wallet-back-btn').addEventListener('click', () => {

    switchToCharScreen('char-taobao-screen');
});

}
