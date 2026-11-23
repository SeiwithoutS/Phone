import { runtime } from '../runtime/state.js'

export async function loadAllDataFromDB() {
    const [
        chatsArr, apiConfig, loadedGlobalSettings, userStickers, worldBooks, lorebooks,
        musicLib, personaPresets, qzoneSettings, initialFavorites,
        allMemories,
        
        allPresets
    ] = await Promise.all([
        runtime.db.chats.toArray(), runtime.db.apiConfig.get('main'), runtime.db.globalSettings.get('main'),
        runtime.db.userStickers.toArray(), runtime.db.worldBooks.toArray(), runtime.db.lorebooks.toArray(), runtime.db.musicLibrary.get('main'),
        runtime.db.personaPresets.toArray(), runtime.db.qzoneSettings.get('main'), runtime.db.favorites.orderBy('timestamp').reverse().toArray(),
        runtime.db.memories.toArray(),
        
        runtime.db.presets.toArray()
    ]);

    
    runtime.state.presets = allPresets || [];

    
    const defaultGlobalSettings = {
        id: 'main',
        showStatusBar: false,
        wallpaper: 'linear-gradient(135deg, #89f7fe, #66a6ff)',
        fontUrl: '',
        enableBackgroundActivity: false,
        backgroundActivityInterval: 60,
        blockCooldownHours: 1,
        apiTemperature: 0.8,
        appIcons: { ...runtime.DEFAULT_APP_ICONS },
        cphoneWallpaper: 'linear-gradient(135deg, #f6d365, #fda085)',
        cphoneAppIcons: { ...runtime.DEFAULT_CPHONE_ICONS },
        globalCss: '',
        notificationSoundUrl: '',
        globalChatBackground: '',
        enableAiDrawing: true,
    chatActionButtonsOrder: null,
    shoppingCategoryCount: 3,
    shoppingProductCount: 8,
        chatRenderWindow: 50
    };
    runtime.state.globalSettings = { ...defaultGlobalSettings, ...(loadedGlobalSettings || {}) };
    runtime.state.globalSettings.appIcons = { ...defaultGlobalSettings.appIcons, ...(runtime.state.globalSettings.appIcons || {}) };
    runtime.state.globalSettings.cphoneAppIcons = { ...defaultGlobalSettings.cphoneAppIcons, ...(runtime.state.globalSettings.cphoneAppIcons || {}) };

    chatsArr.forEach(chat => {
        chat.settings ||= {};
        chat.history ??= [];
            if (typeof chat.settings.enableTimePerception === 'undefined') {
                chat.settings.enableTimePerception = true;
            }
        if (!chat.settings.lyricsPosition) {
            chat.settings.lyricsPosition = { vertical: 'top', horizontal: 'center', offset: 10 };
        }
        if (!chat.isGroup && !chat.settings.myAvatarLibrary) {
            chat.settings.myAvatarLibrary = [];
        }
        if (!chat.isGroup && typeof chat.originalName === 'undefined') {
            chat.originalName = chat.name;
        }
    });
    runtime.state.chats = chatsArr.reduce((acc, chat) => {
        if (typeof chat.unreadCount === 'undefined') chat.unreadCount = 0;
        if (chat.isGroup) {
            if (typeof chat.settings.enableBackgroundActivity === 'undefined') {
                chat.settings.enableBackgroundActivity = true;
            }
            if (chat.members && chat.members.length > 0 && chat.members[0].name) {
                chat.members.forEach(member => {
                    if (typeof member.originalName === 'undefined') {
                        member.originalName = member.name;
                        member.groupNickname = member.name;
                        delete member.name;
                    }
                });
            }
        }
        if (typeof chat.settings.actionCooldownMinutes === 'undefined') {
            chat.settings.actionCooldownMinutes = 10;
        }
        if (!chat.isGroup && !chat.status) chat.status = { text: '在线', lastUpdate: Date.now(), isBusy: false };
        if (!chat.isGroup && !chat.relationship) chat.relationship = { status: 'friend', blockedTimestamp: null, applicationReason: '' };
        if (!chat.isGroup && (!chat.settings || !chat.settings.aiAvatarLibrary)) { if (!chat.settings) chat.settings = {}; chat.settings.aiAvatarLibrary = []; }
        if (chat.isGroup) { (chat.members || []).forEach(member => { if (typeof member.avatarFrame === 'undefined') member.avatarFrame = ''; }); }
        if (!chat.musicData) chat.musicData = { totalTime: 0 };
        if (chat.settings && chat.settings.linkedWorldBookId && !chat.settings.linkedWorldBookIds) { chat.settings.linkedWorldBookIds = [chat.settings.linkedWorldBookId]; delete chat.settings.linkedWorldBookId; }
        if (typeof chat.isPinned === 'undefined') chat.isPinned = false;
        if (!chat.isGroup && typeof chat.settings.myNickname === 'undefined') {
            chat.settings.myNickname = '我';
        }
        if (chat.isGroup && chat.members) {
            let needsUpdate = false;
            chatsArr.forEach(c => {
                 if (c.id === chat.id && c.originalName) {
                    delete c.originalName;
                 }
            });
            chat.members.forEach(member => {
                const originalCharacter = chatsArr.find(c => c.id === member.id);
                if (originalCharacter && originalCharacter.settings) {
                    const correctFrame = originalCharacter.settings.aiAvatarFrame || '';
                    if (member.avatarFrame !== correctFrame) {
                        member.avatarFrame = correctFrame;
                        needsUpdate = true;
                    }
                } else if (typeof member.avatarFrame === 'undefined') {
                    member.avatarFrame = '';
                    needsUpdate = true;
                }
            });
            if (needsUpdate) runtime.db.chats.put(chat);
        }
        if (!chat.settings.enableAutoMemory) chat.settings.enableAutoMemory = false;
        if (!chat.settings.autoMemoryInterval) chat.settings.autoMemoryInterval = 20;
        if (!chat.longTermMemory) chat.longTermMemory = [];
        if (!chat.lastMemorySummaryTimestamp) chat.lastMemorySummaryTimestamp = 0;
        if (!chat.isGroup) {
            if (typeof chat.settings.enableBackgroundActivity === 'undefined') {
                chat.settings.enableBackgroundActivity = true;
            }
            if (typeof chat.settings.enableTts === 'undefined') { chat.settings.enableTts = false; }
            if (!chat.status) chat.status = { text: '在线', lastUpdate: Date.now(), isBusy: false };
            if (!chat.relationship) chat.relationship = { status: 'friend', blockedTimestamp: null, applicationReason: '' };
            if (!chat.settings || !chat.settings.aiAvatarLibrary) { if (!chat.settings) chat.settings = {}; chat.settings.aiAvatarLibrary = []; }
            if (typeof chat.settings.isOfflineMode === 'undefined') chat.settings.isOfflineMode = false;
            if (typeof chat.settings.offlineMinLength === 'undefined') chat.settings.offlineMinLength = 100;
            if (typeof chat.settings.offlineMaxLength === 'undefined') chat.settings.offlineMaxLength = 300;

            if (typeof chat.settings.injectLatestThought === 'undefined') {
                chat.settings.injectLatestThought = false; 
            }
              
            if (typeof chat.heartfeltVoice === 'undefined') chat.heartfeltVoice = '...';
            if (typeof chat.randomJottings === 'undefined') chat.randomJottings = '...';
            if (!Array.isArray(chat.thoughtsHistory)) {
                chat.thoughtsHistory = [];
            }
        }
if (typeof chat.settings.stickerCategoryIds === 'undefined') {
            // 如果不存在，就从旧的单个ID字段迁移
            if (chat.settings.stickerCategoryId) {
                // 将旧的ID放入新数组中
                chat.settings.stickerCategoryIds = [chat.settings.stickerCategoryId];
            } else {
                // 如果旧字段也不存在，就初始化一个空数组
                chat.settings.stickerCategoryIds = [];
            }
            // 删掉旧的字段
            delete chat.settings.stickerCategoryId;
        }
        acc[chat.id] = chat;
        return acc;
    }, {});
    const memoriesToUpdate = [];
    allMemories.forEach(memory => {
        if (memory.type === 'ai_generated' && memory.authorName && !memory.authorId) {
            const foundChat = chatsArr.find(c => !c.isGroup && c.originalName === memory.authorName);
            if (foundChat) {
                memory.authorId = foundChat.id;
                memoriesToUpdate.push(memory);
            } else {
                 const fallbackChat = chatsArr.find(c => !c.isGroup && c.name === memory.authorName);
                 if(fallbackChat) {
                    memory.authorId = fallbackChat.id;
                    memoriesToUpdate.push(memory);
                 }
            }
        }
    });
    if (memoriesToUpdate.length > 0) {
        await runtime.db.memories.bulkPut(memoriesToUpdate);
    }
    runtime.state.apiConfig = apiConfig || { id: 'main', proxyUrl: '', apiKey: '', model: '', secondaryProxyUrl: '', secondaryApiKey: '', secondaryModel: '', minimaxGroupId: '', minimaxApiKey: '', minimaxModel: 'speech-01' };
    runtime.state.userStickers = userStickers || [];
    runtime.state.worldBooks = worldBooks || [];
    runtime.state.lorebooks = lorebooks || [];
    runtime.musicState.playlist = musicLib?.playlist || [];
    runtime.state.personaPresets = personaPresets || [];
    runtime.state.qzoneSettings = qzoneSettings || { id: 'main', nickname: '{{user}}', avatar: 'https://files.catbox.moe/q6z5fc.jpeg', banner: 'https://files.catbox.moe/r5heyt.gif' };
    runtime.allFavoriteItems = initialFavorites || [];
}
