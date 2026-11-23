import { requestContextCompletion } from '../../features/api/completion'
import { getGeminiResponseText, parseAiResponse } from '../api/client.js'
import { renderCharTaobao } from './apps.js'
import { switchToCharScreen } from './launcher.js'
import { renderCharMusicScreen } from './music.js'
import { renderCharMemoList, renderCharSimulatedQQ } from './notes.js'
import { triggerAiResponse } from '../chat/ai.js'
import { createMessageElement } from '../chat/conversation.js'
import { formatTimeAgo } from '../../features/chat/format'
import { renderChatList } from '../chat/list.js'
import { showCustomAlert } from '../dialogs/dialogs.js'
import { hideLoader, showLoader } from '../dialogs/dialogs.js'
import { showNotification } from '../home/status.js'
import { getPlayableSongDetails, searchNeteaseMusic, searchTencentMusic } from '../music/search.js'
import { getGroupStickerContextForPrompt, getStickerContextForPrompt } from '../stickers/stickers.js'
import { runtime } from '../runtime/state.js'

export async function renderCharAlbum() {
            const gridEl = document.getElementById('char-album-grid');
            gridEl.innerHTML = '';
            if (!runtime.activeCharacterId) return;
            const char = runtime.state.chats[runtime.activeCharacterId];
        
            const photos = char.simulatedAlbum || [];
        
            if (photos.length === 0) {
                gridEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">This album is empty.<br>Use Regenerate to generate photos.</p>";
                return;
            }
        
            const fallbackImageUrl = `https://i.postimg.cc/KYr2qRCK/1.jpg`;

            photos.forEach(photo => {
                const item = document.createElement('div');
                item.className = 'char-photo-item';
                item.dataset.description = photo.description;
                gridEl.appendChild(item);

                
                
                
                
                
                
                if (runtime.state.globalSettings.enableAiDrawing) {
                    
                    item.style.backgroundColor = '#e9ecef';
                    const containsNonEnglish = /[^\x00-\x7F]/.test(photo.image_prompt);
                    const isValidPrompt = photo.image_prompt && photo.image_prompt.trim() && !containsNonEnglish;
                    const finalPrompt = isValidPrompt ? photo.image_prompt : 'a beautiful scenery, anime style, cinematic lighting';
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}`;
                    
                    const img = new Image();
                    img.onload = function() { item.style.backgroundImage = `url(${this.src})`; };
                    img.onerror = function() { item.style.backgroundImage = `url(${fallbackImageUrl})`; };
                    img.src = imageUrl;

                } else {
                    
                    item.style.backgroundColor = '#f0f2f5';
                    item.style.border = '1px solid #e0e0e0';
                    
                    const descriptionEl = document.createElement('p');
                    descriptionEl.className = 'char-photo-description';
                    descriptionEl.textContent = photo.description || 'No photo description';
                    
                    item.appendChild(descriptionEl);
                }
            });
        }

export function renderCharBrowserHistory() {
    const listEl = document.getElementById('char-browser-history');
    listEl.innerHTML = '';
    if (!runtime.activeCharacterId) return;

    const char = runtime.state.chats[runtime.activeCharacterId];
    const history = char.simulatedBrowserHistory || [];

    if (history.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No browser history yet.<br>Use Regenerate to create activity.</p>";
        return;
    }

    history.forEach((item, index) => {
        const entryEl = document.createElement('div');
        entryEl.className = 'char-browser-item';
        entryEl.innerHTML = `
            <div class="title">${item.title}</div>
            <div class="url">${item.url}</div>
        `;
        
        entryEl.addEventListener('click', () => openCharArticle(index));
        listEl.appendChild(entryEl);
    });
}

export function renderCharAppUsage() {
            const listEl = document.getElementById('char-usage-list');
            listEl.innerHTML = '';
            if (!runtime.activeCharacterId) return;

            const char = runtime.state.chats[runtime.activeCharacterId];
            const usageData = (char.simulatedAppUsage || []).sort((a, b) => b.usageTimeMinutes - a.usageTimeMinutes);

            if (usageData.length === 0) {
                listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No app activity yet.<br>Use Regenerate to generate activity.</p>";
                return;
            }

            usageData.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'char-usage-item';
                
                const hours = Math.floor(item.usageTimeMinutes / 60);
                const minutes = item.usageTimeMinutes % 60;
                let timeString = '';
                if (hours > 0) timeString += `${hours}小时`;
                if (minutes > 0) timeString += `${minutes}分钟`;
                if (!timeString) timeString = '小于1分钟';

                const prompt = item.image_prompt || `modern app icon for ${item.appName}, flat design, simple`;
       
                const iconUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
                  

                itemEl.innerHTML = `
                    <img src="${iconUrl}" class="usage-item-icon">
                    <div class="usage-item-info">
                        <div class="usage-item-name">${item.appName}</div>
                        <div class="usage-item-category">${item.category}</div>
                    </div>
                    <div class="usage-item-time">${timeString}</div>
                `;
                listEl.appendChild(itemEl);
            });
        }

export async function handleGenerateSimulatedQQ() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Generating social activity based on “${chat.name}” and their memories…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure your provider in API Connections first.");
        return;
    }
    
    const userDisplayNameForAI = runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname ? '用户' : runtime.state.qzoneSettings.nickname;
    const userNicknameInThisChat = chat.settings.myNickname || userDisplayNameForAI;

    const characterOriginalName = chat.originalName || chat.name;
    const stickerContext = getGroupStickerContextForPrompt(chat);
    
    const systemPrompt = `
# 你的任务
你是一个虚拟社交生活模拟器，扮演角色“${chat.name}”。你的任务是虚构出【5到7段】TA最近的QQ聊天记录。

# 核心规则
1.  **【NPC唯一性铁律】**: 在你本次生成的所有对话中（包括私聊和群聊），每一个NPC的名字【必须是独一-无二的】。绝对禁止出现重名的NPC，禁止出现重复群聊。
2.  **【NPC来源】**: 你应该优先从“你的社交圈 (绑定的NPC)”和“世界书”中寻找角色作为聊天对象。如果不够，你也可以自由创造全新的NPC，对话内容要多样化，反映角色的生活。
3.  **关联性**: 对话内容应巧妙地反映角色的长期记忆、世界观，以及与用户互动可能带来的心情变化。
4.  **简洁性**: 每段对话的总长度应在8到15句之间。
# 格式铁律 (最高优先级)
- 你的回复【必须且只能】是一个JSON数组格式的字符串，以 \`[\` 开始，并以 \`]\` 结束。
- 【绝对禁止】在JSON数组前后添加任何多余的文字、解释、或 markdown 标记。
- 数组中的每个元素都代表一段对话，且【必须】是以下两种格式之一：



### 格式 A：与NPC的私聊
\`\`\`json
{
  "type": "private_npc",
  "participant": {
    "name": "NPC的名字",
    "avatar_prompt": "(仅当NPC是新创造时提供)一段用于生成头像的【英文】关键词, 风格为动漫/插画/二次元等, 禁止真人"
  },
"messages": [
  {"sender": "${characterOriginalName}", "content": "对话内容1"},
  {"sender": "NPC的名字", "content": "对话内容2"},
  {"sender": "${characterOriginalName}", "type": "sticker", "meaning": "表情的含义(从可用表情列表选择)"}
]
}
\`\`\`

### 格式 B：群聊
\`\`\`json
{
  "type": "group",
  "groupName": "一个虚构的群名",
  "participants": [
    {"name": "NPC成员1", "avatar_prompt": "(仅当NPC是新创造时提供) 成员1头像【英文】关键词"},
    {"name": "NPC成员2", "avatar_prompt": "(仅当NPC是新创造时提供) 成员2头像【英文】关键词"}
  ],
"messages": [
  {"sender": "${characterOriginalName}", "content": "我在群里说的话"},
  {"sender": "NPC成员1", "content": "成员1回复我"},
  {"sender": "NPC成员2", "type": "sticker", "meaning": "表情的含义(从可用表情列表选择)"}
]
}
\`\`\`

# 角色与上下文
- **你的角色设定**: ${chat.settings.aiPersona}
# 可用表情包 (必须严格遵守！)
- 当你需要发送表情时，你【必须】从下面的列表中【精确地选择一个】含义（meaning）。
- 【绝对禁止】使用任何不在列表中的表情含义！
${stickerContext}
现在，请严格按照格式铁律，生成聊天记录的JSON数组。`;
  
            
    try {
        const messagesForApi = [{ role: 'user', content: "请根据你的设定，生成模拟聊天记录。" }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error(`AI返回的内容中未找到有效的JSON数组。原始返回: ${aiResponseContent}`);
        }
        const cleanedJsonString = jsonMatch[0];
        let simulatedConversations;
        try {
            simulatedConversations = JSON.parse(cleanedJsonString);
        } catch (e) {
            throw new Error(`解析AI返回的JSON时出错: ${e.message}\n\nAI原始返回内容:\n${aiResponseContent}`);
        }
        
        chat.simulatedConversations = simulatedConversations;
        await runtime.db.chats.put(chat);
        
        await renderCharSimulatedQQ();

        
        const hiddenMessage = {
            role: 'system',
            content: `[系统指令：你刚刚在自己的手机上活动了一番（和朋友聊天、逛群等）。现在请根据你的角色设定，主动给用户发一条消息，可以聊聊你刚才看到或聊到的趣事，或者仅仅是问候一下。]`,
            timestamp: Date.now(),
            isHidden: true
        };
        chat.history.push(hiddenMessage);
        await runtime.db.chats.put(chat);
        triggerAiResponse();
        
    } catch (error) {
        console.error("生成模拟聊天失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate simulated chats. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function handleContinueRealConversationFromCPhone() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;



    try {
        const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
        if (!proxyUrl || !model) {
            throw new Error('API未配置，无法生成对话。');
        }

        const myNickname = chat.settings.myNickname || 'Me';

        
        
        

        
        const userPersona = chat.settings.myPersona || '用户';

        
    const stickerContext = getStickerContextForPrompt(chat);        
        const systemPrompt = `
# 你的核心任务
你正在扮演角色“${chat.originalName}”。用户刚刚在TA的手机（CPhone）上点击了一个按钮，希望你能继续你们之前的对话。你的任务是根据上下文，生成【3到5条】符合你人设的、简短的、连续的新回复。

# 输出格式铁律 (最高优先级)
- 你的回复【必须】是一个JSON数组，每个对象代表一条消息。
- 格式: \`[{"type": "text", "content": "第一句话"}, {"type": "text", "content": "第二句话"}, {"type": "sticker", "meaning": "表情的含义(从可用表情列表选择)"}]\`
- 你可以自由组合使用 "text", "sticker", "ai_image", "voice_message" 等多种消息类型。
请根据当前情景和你的情绪，从列表中【选择一个最合适的】表情含义来使用 "sticker" 指令。尽量让你的表情丰富多样，避免重复。
# 你的角色设定
${chat.settings.aiPersona}
# 可用表情包 (必须严格遵守！)
- 当你需要发送表情时，你【必须】从下面的列表中【精确地选择一个】含义（meaning）。
- 【绝对禁止】使用任何不在列表中的表情含义！
${stickerContext}

# 你的聊天对象（用户）的人设
${userPersona}  

# 供你参考的上下文
- **你的本名**: "${chat.originalName}"
- **用户的备注**: "${myNickname}"
- **你们最后的对话**:

现在，请继续这场对话。
`;

        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: [{ role: 'user', content: 'Continue this conversation as the character.' }], task: 'QQ reply from Cphone' });
        if (!response.ok) {
            throw new Error(`API 请求失败: ${(await response.json()).error.message}`);
        }

        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        const messagesArray = parseAiResponse(aiResponseContent);

        if (!messagesArray || messagesArray.length === 0) {
            throw new Error("AI返回了空内容。");
        }

        let newMessagesCount = 0;
        let messageTimestamp = Date.now();
        for (const msgData of messagesArray) {
            const baseMessage = { role: 'assistant', senderName: chat.originalName, timestamp: messageTimestamp++ };
            let aiMessage = null;
            switch(msgData.type) {
                case 'text':
                    aiMessage = { ...baseMessage, content: String(msgData.content || msgData.message) };
                    break;
                case 'sticker':
                    if (msgData.meaning) {
                        const sticker = runtime.state.userStickers.find(s => s.name === msgData.meaning);
                        if (sticker) {
                            aiMessage = { ...baseMessage, type: 'sticker', content: sticker.url, meaning: sticker.name };
                        } else {
                            console.warn(`AI (CPhone) 尝试使用一个不存在的表情: "${msgData.meaning}"`);
                            aiMessage = { ...baseMessage, type: 'text', content: `[表情: ${msgData.meaning}]` };
                        }
                    } else {
                        console.warn("AI (CPhone) 发送了一个没有 'meaning' 的 sticker 指令。", msgData);
                        aiMessage = { ...baseMessage, type: 'sticker', content: msgData.url, meaning: '未知表情' };
                    }
                    break;
            }
            if (aiMessage) {
                chat.history.push(aiMessage);
                newMessagesCount++;
            }
        }
        
        if (newMessagesCount > 0) {
            chat.unreadCount = (chat.unreadCount || 0) + newMessagesCount;
        }
        
        await runtime.db.chats.put(chat);
        await renderChatList();

        if (newMessagesCount > 0) {
            showNotification(chat.id, `发来了 ${newMessagesCount} 条新消息`);
        }

    } catch (error) {
        console.error("从CPhone推进真实对话失败:", error);
        await showCustomAlert("Operation Failed", `Could not generate a reply: ${error.message}`);
    }
}

export async function loadMoreMirroredMessages() {
    if (runtime.isLoadingMoreCphoneMessages || !runtime.activeCharacterId) return;
    runtime.isLoadingMoreCphoneMessages = true;

    const messagesContainer = document.getElementById('char-conversation-messages');
    const mainChar = runtime.state.chats[runtime.activeCharacterId];
    if (!mainChar) {
        runtime.isLoadingMoreCphoneMessages = false;
        return;
    }

    showLoader(messagesContainer, 'top'); 
    const oldScrollHeight = messagesContainer.scrollHeight;

    
    await new Promise(resolve => setTimeout(resolve, 500));

    const totalMessages = mainChar.history.length;
    const renderWindow = runtime.state.globalSettings.chatRenderWindow || 50;
    const nextSliceEnd = totalMessages - runtime.cphoneRenderedCount;
    const nextSliceStart = Math.max(0, nextSliceEnd - renderWindow);
    
    const messagesToPrepend = mainChar.history.slice(nextSliceStart, nextSliceEnd);

    
    hideLoader(messagesContainer);

    if (messagesToPrepend.length === 0) {
        runtime.isLoadingMoreCphoneMessages = false;
        return;
    }

    
    for (const msg of messagesToPrepend.reverse()) {
        const mirroredMsg = { ...msg, role: msg.role === 'user' ? 'assistant' : 'user' };
        
        
        const tempChatObjectForRendering = {
            id: 'temp_user_chat_mirror', isGroup: false, name: mainChar.name,
            settings: {
                ...mainChar.settings,
                myAvatar: mainChar.settings.aiAvatar,
                myAvatarFrame: mainChar.settings.aiAvatarFrame,
                aiAvatar: mainChar.settings.myAvatar,
                aiAvatarFrame: mainChar.settings.myAvatarFrame
            }
        };
        
        const messageEl = await createMessageElement(mirroredMsg, tempChatObjectForRendering);
        if (messageEl) {
            messagesContainer.prepend(messageEl);
        }
    }

    runtime.cphoneRenderedCount += messagesToPrepend.length;

    
    const newScrollHeight = messagesContainer.scrollHeight;
    messagesContainer.scrollTop = newScrollHeight - oldScrollHeight;

    runtime.isLoadingMoreCphoneMessages = false;
}

export async function openCharSimulatedConversation(conversationIndex) {
    const mainChar = runtime.state.chats[runtime.activeCharacterId];
    if (!mainChar) return; 

    runtime.cphoneActiveConversationType = (conversationIndex === -1) ? 'private_user' : mainChar.simulatedConversations[conversationIndex]?.type; 

    const bodyEl = document.getElementById('char-conversation-messages'); 
    bodyEl.innerHTML = '';
    bodyEl.dataset.theme = mainChar.settings.theme || 'default';
    const isDarkMode = document.getElementById('phone-screen').classList.contains('dark-mode');
    bodyEl.style.backgroundColor = isDarkMode ? '#000000' : '#f0f2f5';

    let tempChatObjectForRendering;
    let messagesToRender = [];
    const allNpcs = await runtime.db.npcs.toArray(); 
    const npcMap = new Map(allNpcs.map(npc => [npc.name, npc])); // 确保 npcMap 可用

    if (conversationIndex === -1) {
  
        runtime.cphoneActiveConversationType = 'private_user';
        const titleEl = document.getElementById('char-conversation-partner-name');
        // const bodyEl = document.getElementById('char-conversation-messages'); 
        const inputEl = document.getElementById('char-simulated-input');

        bodyEl.innerHTML = '';
        titleEl.textContent = mainChar.settings.myNickname || (runtime.state.qzoneSettings.nickname || "Me");
        inputEl.placeholder = `Chat with ${mainChar.settings.myNickname || 'Me'} (read-only)`;

        runtime.cphoneRenderedCount = 0;
        runtime.isLoadingMoreCphoneMessages = false;

        const history = mainChar.history;
        const renderWindow = runtime.state.globalSettings.chatRenderWindow || 50;
        const initialMessages = history.slice(-renderWindow);

        tempChatObjectForRendering = {
            id: 'temp_user_chat_mirror', isGroup: false, name: mainChar.name,
            settings: {
                ...mainChar.settings,
                myAvatar: mainChar.settings.aiAvatar,
                myAvatarFrame: mainChar.settings.aiAvatarFrame,
                aiAvatar: mainChar.settings.myAvatar,
                aiAvatarFrame: mainChar.settings.myAvatarFrame
            }
        };

        messagesToRender = initialMessages.map(msg => ({ 
             ...msg,
             role: msg.role === 'user' ? 'assistant' : 'user' 
         }));
        runtime.cphoneRenderedCount = initialMessages.length;

    } else {
   
        const conversation = mainChar.simulatedConversations[conversationIndex];
        if (!conversation) return;
        runtime.cphoneActiveConversationType = conversation.type;

        const titleEl = document.getElementById('char-conversation-partner-name');
        // const bodyEl = document.getElementById('char-conversation-messages'); 
        const inputEl = document.getElementById('char-simulated-input');

        if (conversation.type === 'group') {
            titleEl.textContent = `${conversation.groupName} (${conversation.participants.length + 1})`;
            inputEl.placeholder = `Chat in ${conversation.groupName}`;
            tempChatObjectForRendering = {
                id: 'temp_group_chat', isGroup: true,
                name: conversation.groupName,
                originalName: mainChar.originalName, 
                members: conversation.participants.map(p => {
                    const npcData = npcMap.get(p.name);
                    let avatarUrl = (npcData && npcData.avatar) ? npcData.avatar :
                        (runtime.state.globalSettings.enableAiDrawing
                            ? `https://image.pollinations.ai/prompt/${encodeURIComponent(p.avatar_prompt || 'anime person')}`
                            : runtime.defaultGroupMemberAvatar);
                    return { originalName: p.name, groupNickname: p.name, avatar: avatarUrl };
                }),
                settings: {
                    ...mainChar.settings,
                    myNickname: mainChar.name,
                    myAvatar: mainChar.settings.aiAvatar,
                    myAvatarFrame: mainChar.settings.aiAvatarFrame,
                }
            };
        } else { 
            titleEl.textContent = conversation.participant.name;
            inputEl.placeholder = `Chat with ${conversation.participant.name}`;
            const npcData = npcMap.get(conversation.participant.name);
            const npcAvatarUrl = (npcData && npcData.avatar) ? npcData.avatar :
                (runtime.state.globalSettings.enableAiDrawing
                    ? `https://image.pollinations.ai/prompt/${encodeURIComponent(conversation.participant.avatar_prompt || 'anime person')}`
                    : runtime.defaultGroupMemberAvatar);
            tempChatObjectForRendering = {
                id: 'temp_npc_chat', isGroup: false,
                name: conversation.participant.name,
                originalName: mainChar.originalName, 
                settings: {
                    ...mainChar.settings,
                    myAvatar: mainChar.settings.aiAvatar, 
                    myAvatarFrame: mainChar.settings.aiAvatarFrame,
                    aiAvatar: npcAvatarUrl,
                    aiAvatarFrame: '' 
                }
            };
        }
        messagesToRender = conversation.messages; // 准备要渲染的消息
    }

   
    // const bodyEl = document.getElementById('char-conversation-messages'); // 已在上面定义
    for (const msg of messagesToRender) {
        let role = msg.role; // 如果渲染真实历史记录，直接使用 role
        if(conversationIndex !== -1) { // 如果是模拟对话
            const isFromMainChar = msg.sender === (mainChar.originalName || mainChar.name);
            role = isFromMainChar ? 'user' : 'assistant';
        }

        const tempMessageObject = {
            role: role,
            senderName: msg.sender || (role === 'user' ? tempChatObjectForRendering.settings.myNickname : tempChatObjectForRendering.name),
            timestamp: msg.timestamp || (Date.now() + Math.random()) 
        };

    
        if (msg.type === 'sticker' && msg.meaning) {
        
            const sticker = runtime.state.userStickers.find(s => s.name === msg.meaning);
            if (sticker) {
                tempMessageObject.content = sticker.url; 
                tempMessageObject.meaning = msg.meaning; 
                tempMessageObject.type = 'sticker';
            } else {
           
                console.warn(`模拟表情含义 "${msg.meaning}" 在库中未找到。`);
                tempMessageObject.content = `[表情: ${msg.meaning}]`;
                tempMessageObject.type = 'text'; 
            }
        } else {
     
            tempMessageObject.content = msg.content;
            tempMessageObject.type = msg.type || 'text';
        }

        const bubbleElement = await createMessageElement(tempMessageObject, tempChatObjectForRendering);
        if (bubbleElement) {
            bodyEl.appendChild(bubbleElement);
        }
    }

    switchToCharScreen('char-qq-conversation-screen');
    setTimeout(() => bodyEl.scrollTop = bodyEl.scrollHeight, 0); // 渲染完成后滚动到底部
}

export function closeSimulatedTranscriptModal() {
    document.getElementById('char-qq-transcript-modal').classList.remove('visible');
}

export async function handleGenerateSimulatedAlbum() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];

    if (!chat) {
        await showCustomAlert("Operation Failed", "The character’s data could not be found.");
        return;
    }

    await showCustomAlert("Please wait…", `Asking “${chat.name}” to recall their album photos…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure your provider in API Connections first.");
        return;
    }

    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? '用户' : runtime.state.qzoneSettings.nickname;
    


    
    const systemPrompt = `
# 你的任务
你是一个虚拟生活模拟器。你的任务是扮演角色“${chat.name}”，并根据其人设、记忆和最近的互动，构思出【8到10张】TA最近可能会拍摄或珍藏在手机相册里的照片。

# 核心规则
1.  **创造性与合理性**: 照片内容必须完全符合角色的性格、爱好、职业和生活环境。
2.  **多样性**: 照片主题要丰富，可以包括自拍、风景、食物、宠物、朋友合影、工作场景等。
3.  **格式铁律 (最高优先级)**: 
    - 你的回复【必须且只能】是一个JSON数组格式的字符串。
    - 你的回复必须以 \`[\` 开始，并以 \`]\` 结束。
    - 【绝对禁止】在JSON数组前后添加任何多余的文字、解释、或 markdown 标记 (如 \`\`\`json)。
    - 数组中的每个元素都是一个对象，代表一张照片，格式【必须】如下:
    \`\`\`json
    [
      {
        "description": "这是照片背后的故事或角色的心情日记，必须使用第一人称“我”来写。",
        "image_prompt": "一段用于生成这张照片的、详细的【英文】关键词。"
      }
    ]
    \`\`\`
    - **【image_prompt 绝对禁止】**: 绝对禁止包含任何中文字符、句子、特殊符号、或任何可能涉及敏感（NSFW）、暴力、血腥、政治的内容！也禁止真人！
    - **【image_prompt 必须是】**: 必须是纯英文的、用逗号分隔的【关键词组合】 (e.g., "1boy, solo, basketball jersey, in locker room, smiling, selfie")。
    - **【画风指令】**: 在 prompt 的末尾，总是加上画风指令，例如： \`best quality, masterpiece, anime style, cinematic lighting\`

# 供你参考的上下文
- **你的角色设定**: ${chat.settings.aiPersona}
- **你最近和“${userDisplayNameForAI}”的对话摘要**:

现在，请开始生成这组照片的描述和绘画指令。`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "请根据你的设定，生成你的相册内容。" }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error(`AI返回的内容中未找到有效的JSON数组。原始返回: ${aiResponseContent}`);
        }
        const cleanedJsonString = jsonMatch[0];
        let simulatedAlbumData;
        try {
            simulatedAlbumData = JSON.parse(cleanedJsonString);
        } catch (e) {
            throw new Error(`解析AI返回的JSON时出错: ${e.message}\n\nAI原始返回内容:\n${aiResponseContent}`);
        }
          
        
        chat.simulatedAlbum = simulatedAlbumData;
        await runtime.db.chats.put(chat);
        
        await renderCharAlbum();
        
    } catch (error) {
        console.error("生成模拟相册失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate album photos. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function handleGenerateBrowserHistory() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Generating browsing activity for “${chat.name}”…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure an API connection before generating content.");
        return;
    }
    
    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? '用户' : runtime.state.qzoneSettings.nickname;



const userPersona = chat.settings.myPersona || '(未设置)';    
    const systemPrompt = `
# 你的任务
你是一个虚拟生活模拟器。你的任务是扮演角色“${chat.name}”，并根据其人设、记忆和最近的互动，虚构出【10到20条】TA最近的浏览器搜索/浏览记录。

# 核心规则
1.  **创造性与合理性**: 记录必须完全符合角色的性格、爱好、职业和生活环境。
2.  **多样性**: 记录类型要丰富，可以是帖子、文章、新闻、问答等。
3.  **【格式 (最高优先级)】**: 
    - 你的回复【必须且只能】是一个JSON数组格式的字符串。
    - 你的回复必须以 \`[\` 开始，并以 \`]\` 结束。
    - 【绝对禁止】在JSON数组前后添加任何多余的文字、解释、或 markdown 标记 (如 \`\`\`json)。
    - 数组中的每个元素都代表一条浏览记录，并且【必须】使用以下格式:
    \`\`\`json
    [
      {
        "type": "text",
        "title": "一个引人注目的文章或搜索标题",
        "url": "一个虚构的、看起来很真实的网址",
        "content": "一篇200-400字的、详细的文章或帖子正文，支持换行符\\n。"
      }
    ]
    \`\`\`
    
    **【绝对禁止】**: 你的回复中【绝对不能】包含 "type": "image" 的对象。所有记录都必须是文字内容。

# 供你参考的上下文
- **你的角色设定**: ${chat.settings.aiPersona}
- ** 你的聊天对象（用户）的人设**:${userPersona}
- **你的长期记忆**:
- **你最近和“${userDisplayNameForAI}”的对话摘要**:

现在，请开始生成这组【纯文本】的浏览记录。`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "请根据你的设定，生成你的浏览器记录。" }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error(`AI返回的内容中未找到有效的JSON数组。原始返回: ${aiResponseContent}`);
        }
        const cleanedJsonString = jsonMatch[0];
        let simulatedHistory;
        try {
            simulatedHistory = JSON.parse(cleanedJsonString);
        } catch (e) {
            throw new Error(`解析AI返回的JSON时出错: ${e.message}\n\nAI原始返回内容:\n${aiResponseContent}`);
        }
          
        
        chat.simulatedBrowserHistory = simulatedHistory;
        await runtime.db.chats.put(chat);
        
        await renderCharBrowserHistory();
        
    } catch (error) {
        console.error("生成模拟浏览器历史失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate browser history. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function openCharArticle(index) {
    const char = runtime.state.chats[runtime.activeCharacterId];
    const articleData = char.simulatedBrowserHistory[index];
    if (!articleData) return;
    
      
    
    runtime.activeArticleForViewing = articleData;
    
    
    renderCharArticle(articleData);
    switchToCharScreen('char-browser-article-screen');

      
    
    const favBtn = document.getElementById('favorite-article-btn');
    
    const existingFavorite = await runtime.db.favorites.where({ type: 'char_browser_article', 'content.url': articleData.url }).first();
    favBtn.classList.toggle('active', !!existingFavorite);
    
}

export async function toggleBrowserArticleFavorite() {
    if (!runtime.activeArticleForViewing || !runtime.activeCharacterId) return;

    const article = runtime.activeArticleForViewing;
    const char = runtime.state.chats[runtime.activeCharacterId];
    const favBtn = document.getElementById('favorite-article-btn');

    
    const existingFavorite = await runtime.db.favorites.where({ type: 'char_browser_article', 'content.url': article.url }).first();

    if (existingFavorite) {
        
        await runtime.db.favorites.delete(existingFavorite.id);
        favBtn.classList.remove('active');
        await showCustomAlert("Complete", "Removed from Favorites.");
    } else {
        
        const newFavorite = {
            type: 'char_browser_article',
            
            content: {
                ...article, 
                characterId: runtime.activeCharacterId,
                characterName: char.name
            },
            timestamp: Date.now() 
        };
        await runtime.db.favorites.add(newFavorite);
        favBtn.classList.add('active');
        await showCustomAlert("Complete", "Added to Favorites.");
    }
}

export function renderCharArticle(articleData) {
            const titleEl = document.getElementById('char-article-title');
            const contentEl = document.getElementById('char-article-content');
            
            titleEl.textContent = articleData.title;
            contentEl.innerHTML = ''; 


            
            
            if (articleData.type === 'image') {
                contentEl.innerHTML = `<p class="char-browser-image-description">${articleData.title || '(无标题)'}</p>`;
            } else {
                
                contentEl.innerHTML = `<p>${(articleData.content || '内容加载失败...').replace(/\n/g, '</p><p>')}</p>`;
            }
            
        }

export async function handleGenerateTaobaoHistory() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Generating shopping activity for “${chat.name}”…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure an API connection before generating content.");
        return;
    }
    
    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? '用户' : runtime.state.qzoneSettings.nickname;



    
    const systemPrompt = `
# 你的任务
你是一个虚拟生活模拟器。你的任务是扮演角色“${chat.name}”，并根据其人设、记忆和最近的互动，虚构出TA最近的淘宝购物记录和账户余额。

# 核心规则
1.  **余额铁律 (最高优先级)**: 你【必须】根据角色的【经济状况】设定一个合理的 \`totalBalance\` (总余额)。例如，富有的角色应该有更高的余额，而学生或经济拮据的角色则应该有较低的余额。
2.  **合理性**: 购买记录必须完全符合角色的性格、爱好和经济状况。
3.  **格式铁律 (最高优先级)**: 
    - 你的回复【必须且只能】是一个【单一的JSON对象】。
    - 你的回复必须以 \`{\` 开始，并以 \`}\` 结束。
    - 【绝对禁止】在JSON数组前后添加任何多余的文字、解释、或 markdown 标记。
    - 格式【必须】如下:
    \`\`\`json
    {
      "totalBalance": 12345.67, // (这是一个示例数字，你必须根据角色的经济状况生成一个全新的、合理的余额！)
      "purchases": [
        {
          "itemName": "一个具体、生动的商品名称",
          "price": 128.80,
          "status": "已签收",
          "reason": "这是角色购买这件商品的内心独白或理由，必须使用第一人称“我”来写。",
          "image_prompt": "一段用于生成这张商品图片的、详细的【英文】关键词, 风格为 realistic product photo, high quality, on a clean white background"
        }
      ]
    }
    \`\`\`
    - **purchases**: 一个包含12到15个商品对象的数组。
    - **status (订单状态)**: 只能从 "已签收", "待发货", "运输中", "待评价" 中选择。

# 供你参考的上下文
- **你的角色设定**: ${chat.settings.aiPersona}
- **你的长期记忆**:
- **你最近和“${userDisplayNameForAI}”的对话摘要**:

现在，请生成包含总余额和购买记录的JSON对象。`;

    try {
        const messagesForApi = [{ role: 'user', content: "请根据你的设定，生成你的淘宝购买记录和余额。" }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        const jsonMatch = aiResponseContent.match(/({[\s\S]*})/);
        if (!jsonMatch) throw new Error("AI返回的内容中未找到有效的JSON对象。");
        const simulatedTaobaoData = JSON.parse(jsonMatch[0]);
        

        if (!simulatedTaobaoData.purchases) {
            simulatedTaobaoData.purchases = [];
        }

        chat.simulatedTaobaoHistory = simulatedTaobaoData;
        await runtime.db.chats.put(chat);
        
        await renderCharTaobao();
        
    } catch (error) {
        console.error("生成模拟淘宝记录失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate shopping history. Check API Connections or retry. Error: ${error.message}`);
    }
}

export function openCharWallet() {
    renderCharWallet();
    switchToCharScreen('char-wallet-screen');
}

export function renderCharWallet() {
    const contentEl = document.getElementById('char-wallet-content');
    contentEl.innerHTML = '';
    const char = runtime.state.chats[runtime.activeCharacterId];
    const history = char.simulatedTaobaoHistory || {};
    const purchases = history.purchases || [];

    
    const totalBalance = history.totalBalance || 0;

    
    const summaryCard = document.createElement('div');
    summaryCard.style.cssText = `
        background-color: #fff;
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        margin-bottom: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    `;
    summaryCard.innerHTML = `
        <p style="color: #8a8a8a; margin: 0 0 10px 0;">Account Balance</p>
        <p style="font-size: 32px; font-weight: 600; color: #1f1f1f; margin: 0;">¥${totalBalance.toFixed(2)}</p>
    `;
    contentEl.appendChild(summaryCard);

    
    const detailsTitle = document.createElement('h3');
    detailsTitle.textContent = "Recent Spending";
    detailsTitle.style.cssText = `font-size: 16px; color: #555; margin-bottom: 10px;`;
    contentEl.appendChild(detailsTitle);

    if (purchases.length === 0) {
        contentEl.innerHTML += "<p style=\"text-align:center; color: var(--text-secondary);\">No recent spending.</p>";
        return;
    }

    
    purchases.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #f0f0f0;
        `;
        itemEl.innerHTML = `
            <div>
                <p style="font-weight: 500; margin: 0 0 4px 0;">${item.itemName}</p>
                <p style="font-size: 12px; color: #8a8a8a; margin: 0;">${item.status}</p>
            </div>
            <div style="font-weight: 600; font-size: 16px; color: #ff5722;">- ¥${(item.price || 0).toFixed(2)}</div>
        `;
        contentEl.appendChild(itemEl);
    });
}

export async function handleGenerateSimulatedMemos() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Asking “${chat.name}” to share their notes…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure your provider in API Connections first.");
        return;
    }

    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? '用户' : runtime.state.qzoneSettings.nickname;



const userPersona = chat.settings.myPersona || '(未设置)';    
    const systemPrompt = `
# 你的任务
你是一个虚拟生活模拟器。你的任务是扮演角色“${chat.name}”，并根据其人设、记忆和最近的互动，虚构出【12到20条】TA最近可能会写在手机备忘录里的内容。

# 核心规则
1.  **创造性与合理性**: 备忘录内容必须完全符合角色的性格、爱好、职业和生活环境。可以是购物清单、待办事项、灵感片段、一些随笔和感悟、草稿等。
2.  **格式铁律 (最高优先级)**: 
    - 你的回复【必须且只能】是一个JSON数组格式的字符串。
    - 你的回复必须以 \`[\` 开始，并以 \`]\` 结束。
    - 【绝对禁止】在JSON数组前后添加任何多余的文字、解释、或 markdown 标记 (如 \`\`\`json)。
    - 数组中的每个元素都是一个对象，代表一条备忘录，格式【必须】如下:
    \`\`\`json
    [
      {
        "title": "备忘录的标题，例如：购物清单 或 周末计划",
        "content": "备忘录的详细内容，必须支持换行符\\n。"
      }
    ]
    \`\`\`

# 供你参考的上下文
- **你的角色设定**: ${chat.settings.aiPersona}
- ** 你的聊天对象（用户）的人设**:${userPersona}
- **你的长期记忆**:
- **你最近和“${userDisplayNameForAI}”的对话摘要**:

现在，请开始生成这组备忘录。`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "请根据你的设定，生成你的备忘录内容。" }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) {
             const errorData = await response.json().catch(() => null);
             const errorMessage = errorData?.error?.message || response.statusText;
             throw new Error(`API 错误: ${response.status} - ${errorMessage}`);
        }
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
   
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error(`AI返回的内容中未找到有效的JSON数组。原始返回: ${aiResponseContent}`);
        }
        const cleanedJsonString = jsonMatch[0];
        let simulatedMemos;
        try {
            simulatedMemos = JSON.parse(cleanedJsonString);
        } catch (e) {
            throw new Error(`解析AI返回的JSON时出错: ${e.message}\n\nAI原始返回内容:\n${aiResponseContent}`);
        }
          
        
        if (!Array.isArray(simulatedMemos)) {
            throw new Error(`AI返回的数据不是一个数组。原始返回: ${JSON.stringify(simulatedMemos)}`);
        }

        chat.memos = simulatedMemos.map(memo => ({
            id: Date.now() + Math.random(),
            title: memo.title,
            content: memo.content
        }));
        
        await runtime.db.chats.put(chat);
        await renderCharMemoList();
        
    } catch (error) {
        console.error("生成模拟备忘录失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate notes. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function handleGenerateAmapHistory() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Generating location history for “${chat.name}”…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure an API connection before generating content.");
        return;
    }
    
    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? '用户' : runtime.state.qzoneSettings.nickname;


    const systemPrompt = `
# 你的任务
你是一个虚拟生活模拟器。你的任务是扮演角色“${chat.name}”，并根据其人设、记忆和最近的互动，虚构出【12到20条】TA最近的“高德地图”出行足迹。

# 核心规则
1.  **【时间 (最高优先级)】**:
    -   今天的日期是 **${new Date().toISOString()}**。
    -   你生成的【所有】足迹的 \`timestamp\` 字段，【必须】是今天或今天以前的日期。
    -   【绝对禁止】生成任何未来的日期！
    -   请生成一个看起来像是过去几周内的、时间【从新到旧】排列的足迹列表。
2.  **创造性与合理性**: 足迹必须完全符合角色的性格、爱好、职业和生活环境。
3.  **多样性**: 地点类型要丰富，可以包括餐厅、商场、公园、公司、朋友家等。
4.  **【格式铁律 (最高优先级)】**: 
    - 你的回复【必须且只能】是一个JSON数组格式的字符串。
    - 你的回复必须以 \`[\` 开始，并以 \`]\` 结束。
    - 【绝对禁止】在JSON数组前后添加任何多余的文字、解释、或 markdown 标记 (如 \`\`\`json)。
    - 数组中的每个元素都是一个对象，代表一条足迹，格式【必须】如下:
    \`\`\`json
    [
      {
        "locationName": "一个具体、生动的地点名称",
        "address": "一个虚构但看起来很真实的详细地址",
        "comment": "这是角色对这次出行或这个地点的内心独白或评论，必须使用第一人称“我”来写。",
        "image_prompt": "(可选)一段用于生成这张地点照片的、详细的【英文】关键词, 风格为 realistic photo, high quality",
        "timestamp": "符合 ISO 8601 格式的日期时间字符串 (例如: '2025-09-25T18:30:00Z')"
      }
    ]
    \`\`\`
    - **重要**: 大约有【三分之一】的足迹需要包含 \`image_prompt\` 字段来生成一张照片。
    - **图片**: image_prompt 生成的图片【绝对禁止包含真人】。如果地点是室内，可以生成空无一人的场景；如果是室外，可以只有风景或建筑。

# 供你参考的上下文
- **你的角色设定**: ${chat.settings.aiPersona}
- **你的长期记忆**:
- **你最近和“${userDisplayNameForAI}”的对话摘要**:

现在，请开始生成这组足迹记录。`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "请根据你的设定，生成你的高德地图足迹。" }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error(`AI返回的内容中未找到有效的JSON数组。原始返回: ${aiResponseContent}`);
        }
        const cleanedJsonString = jsonMatch[0];
        let simulatedAmapData;
        try {
            simulatedAmapData = JSON.parse(cleanedJsonString);
        } catch (e) {
            throw new Error(`解析AI返回的JSON时出错: ${e.message}\n\nAI原始返回内容:\n${aiResponseContent}`);
        }
          
        
        chat.simulatedAmapHistory = simulatedAmapData;
        await runtime.db.chats.put(chat);
        
        await renderCharAmap();
        
    } catch (error) {
        console.error("生成模拟足迹失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate location history. Check API Connections or retry. Error: ${error.message}`);
    }
}

export function renderCharAmap() {
            const listEl = document.getElementById('char-amap-list');
            listEl.innerHTML = '';
            if (!runtime.activeCharacterId) return;

            const char = runtime.state.chats[runtime.activeCharacterId];
            const history = char.simulatedAmapHistory || [];

            if (history.length === 0) {
                listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No location history yet.<br>Use Regenerate to create activity.</p>";
                return;
            }

            
            history.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'char-amap-item';
                
                let photoHtml = '';
                if (item.image_prompt) {
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(item.image_prompt)}`;
                    photoHtml = `<div class="amap-item-photo" style="background-image: url('${imageUrl}')" data-comment="${item.comment}"></div>`;
                }

                // 使用我们之前创建的 formatTimeAgo 函数来格式化时间
                const timeAgo = item.timestamp ? formatTimeAgo(new Date(item.timestamp).getTime()) : '某个时间';

                itemEl.innerHTML = `
                    <div class="amap-item-header">
                        <div class="amap-item-icon">📍</div>
                        <div class="amap-item-info">
                            <div class="amap-item-title">${item.locationName}</div>
                            <div class="amap-item-address">${item.address}</div>
                        </div>
                    </div>
                    <div class="amap-item-body">
                        <div class="amap-item-comment">${item.comment.replace(/\n/g, '<br>')}</div>
                        ${photoHtml}
                    </div>
                    <div class="amap-item-footer">${timeAgo}</div>
                `;
                listEl.appendChild(itemEl);
            });
      
        }

export async function handleGenerateAppUsage() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Generating app activity for “${chat.name}”…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure an API connection before generating content.");
        return;
    }
    
    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? '用户' : runtime.state.qzoneSettings.nickname;


  
    const systemPrompt = `
# 你的任务
你是一个虚拟生活模拟器。你的任务是扮演角色“${chat.name}”，并根据其人设、记忆和最近的互动，虚构出TA最近一天的【手机App屏幕使用时间】记录，总共约20条。

# 核心规则
1.  **创造性与多样性**: 生成的App列表【不必局限于】Cphone主屏幕上已有的App。你可以自由地虚构TA可能使用的其他App，例如 Instagram, 各种游戏 (如：原神, 王者荣耀), 视频App (如：抖音, YouTube), 学习或工作软件等，这能更好地体现角色的隐藏兴趣和生活习惯。
2.  **合理性**: 使用时长和App类型必须完全符合角色的性格、爱好、职业和生活环境。
3.  **格式铁律 (最高优先级)**: 
    - 你的回复【必须且只能】是一个JSON数组格式的字符串。
    - 你的回复必须以 \`[\` 开始，并以 \`]\` 结束。
    - 【绝对禁止】在JSON数组前后添加任何多余的文字、解释、或 markdown 标记 (如 \`\`\`json)。
    - 数组中的每个元素都是一个对象，代表一个App的使用记录，格式【必须】如下:
    \`\`\`json
    [
      {
        "appName": "App的名称 (例如: 微信, 微博, 原神)",
        "usageTimeMinutes": 125,
        "category": "App的分类 (例如: 社交, 游戏, 影音, 工具, 阅读, 购物)",
        "image_prompt": "一段用于生成这个App【图标】的、简洁的【英文】关键词。风格必须是 modern app icon, flat design, simple, clean background"
      }
    ]
    \`\`\`

# 供你参考的上下文
- **你的角色设定**: ${chat.settings.aiPersona}
- **你的长期记忆**:
- **你最近和“${userDisplayNameForAI}”的对话摘要**:

现在，请开始生成这组App使用记录。`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "请根据你的设定，生成你的App使用记录。" }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        const cleanedJson = aiResponseContent.replace(/^```json\s*/, '').replace(/```$/, '');
        
        const simulatedUsageData = JSON.parse(cleanedJson);
        
        chat.simulatedAppUsage = simulatedUsageData;
        await runtime.db.chats.put(chat);
        
        await renderCharAppUsage();
        
    } catch (error) {
        console.error("生成模拟App使用记录失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate app activity. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function handleGenerateSimulatedMusic() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Asking “${chat.name}” to share their playlist…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) {
        alert("Configure your provider in API Connections first.");
        return;
    }
    
    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? '用户' : runtime.state.qzoneSettings.nickname;



 
    const systemPrompt = `
# 你的任务
你是一个虚拟音乐品味模拟器。你的任务是扮演角色“${chat.name}”，并根据其人设、记忆和最近的互动，挑选出【14到18首】最能代表TA此刻心情或品味的歌曲。

# 核心规则
1.  **创造性与合理性**: 歌单必须完全符合角色的性格、爱好和生活背景。
2.  **多样性**: 歌曲风格可以多样，但必须逻辑自洽。
3.  **格式铁律 (最高优先级)**: 
    - 你的回复【必须且只能】是一个JSON数组格式的字符串。
    - 你的回复必须以 \`[\` 开始，并以 \`]\` 结束。
    - 【绝对禁止】在JSON数组前后添加任何多余的文字、解释、或 markdown 标记 (如 \`\`\`json)。
    - 数组中的每个元素都是一个对象，代表一首歌，格式【必须】如下:
    \`\`\`json
    [
      {
        "songName": "歌曲的准确名称",
        "artistName": "歌曲的准确艺术家/歌手名"
      }
    ]
    \`\`\`

# 供你参考的上下文
- **你的角色设定**: ${chat.settings.aiPersona}
- **你的长期记忆**:
- **你最近和“${userDisplayNameForAI}”的对话摘要**:

现在，请生成这份歌单。`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "请根据你的设定，生成你的歌单。" }];
        const response = await requestContextCompletion(chat, { instructions: systemPrompt,
            request: messagesForApi, task: 'Cphone generation · ' + chat.name, scope: 'cphone:' + chat.id });
          

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        const cleanedJson = aiResponseContent.replace(/^```json\s*/, '').replace(/```$/, '');
        const songPicks = JSON.parse(cleanedJson);

        await showCustomAlert("Please wait…", `Looking up details for ${songPicks.length} tracks…`);

        const songDetailPromises = songPicks.map(async (pick) => {
            let searchResults = await searchNeteaseMusic(pick.songName, pick.artistName);
            if (!searchResults || searchResults.length === 0) {
                searchResults = await searchTencentMusic(pick.songName);
            }
            if (searchResults.length > 0) {
                return getPlayableSongDetails(searchResults[0]);
            }
            console.warn(`所有音乐源都未能找到歌曲：“${pick.songName} - ${pick.artistName}”`);
            return null;
        });

        const fullSongObjects = (await Promise.all(songDetailPromises)).filter(Boolean);

        chat.simulatedMusicPlaylist = fullSongObjects;
        await runtime.db.chats.put(chat);
        
        await renderCharMusicScreen();
        
    } catch (error) {
        console.error("生成模拟歌单失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate the playlist. Check API Connections or retry. Error: ${error.message}`);
    }
}
