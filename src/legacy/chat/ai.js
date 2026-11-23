import { loreContext } from '../../features/world-book/lore-storage'
import { characterPrompt } from '../../features/characters/characters'
import { withConversationRequest } from '../../features/chat/sessions'
import { openAiUrl } from '../../features/api/endpoints'
import { preferences } from '../storage/preferences.js'
import { getGeminiResponseText, parseAiResponse, toGeminiRequestData } from '../api/client.js'
import { stopSilentAudio } from '../calls/audio.js'
import { showCallMessageActions, showIncomingCallModal, startVideoCall, triggerAiInCallAction } from '../calls/calls.js'
import { appendMessage, createMessageElement, renderChatInterface, setAvatarActingState } from './conversation.js'
import { formatTimeAgo, formatTimestampForAI, getTimeOfDayGreeting } from '../../features/chat/format'
import { getDisplayNameByOriginalName, getDisplayNameInGroup, processMentions, syncCharacterAvatarInGroups, syncCharacterNameInGroups } from './groups.js'
import { renderChatList } from './list.js'
import { filterVisiblePostsForAI } from './sharing.js'
import { addLongPressListener, showCustomAlert } from '../dialogs/dialogs.js'
import { formatGomokuStateForAI, handleAiGomokuMove } from '../gomoku/gomoku.js'
import { formatReadingStateForAI, showNotification } from '../home/status.js'
import { checkAndTriggerAutoSummary, generateSummaryForTimeframe } from '../memories/memories.js'
import { playSong } from '../music/player.js'
import { getCharacterNAIPrompts, getNovelAISettings } from '../novelai/images.js'
import { renderQzonePosts, updateUnreadIndicator } from '../qzone/feed.js'
import { getGroupStickerContextForPrompt, getStickerContextForPrompt } from '../stickers/stickers.js'
import { showScreen } from '../../app/routes'
import { openImageArchive } from '../../runtime/dependencies'
import { runtime } from '../runtime/state.js'

export async function triggerSpectatorGroupAiAction() {
    if (!runtime.state.activeChatId) return;
    const chatId = runtime.state.activeChatId;
    const chat = runtime.state.chats[chatId];
    runtime.lastRawAiResponse = '';
    runtime.lastResponseTimestamps = [];
    const propelBtn = document.getElementById('spectator-propel-btn');
    if(propelBtn) {
        propelBtn.disabled = true;
        propelBtn.textContent = "Thinking…";
    }
    setAvatarActingState(chatId, true);

    try {
        const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
        if (!proxyUrl || !apiKey || !model) {
            throw new Error('API未配置，无法生成对话。');
        }
        
        
        
        

        
        const maxMemory = parseInt(chat.settings.maxMemory) || 10;
        const historySlice = chat.history.slice(-maxMemory);
        
        
        let worldBookContent = '';
        if (chat.settings.linkedWorldBookIds && chat.settings.linkedWorldBookIds.length > 0) {
            const linkedContents = chat.settings.linkedWorldBookIds.map(bookId => {
                const worldBook = runtime.state.worldBooks.find(wb => wb.id === bookId);
                if (!worldBook || !Array.isArray(worldBook.content)) return '';
                const formattedEntries = worldBook.content
                    .filter(entry => entry.enabled !== false)
                    .map(entry => {
                        let entryString = `\n### 条目: ${entry.comment || '无备注'}\n`;
                        if (entry.keys.length > 0) entryString += `**关键词:** ${entry.keys.join(', ')}\n`;
                        entryString += `**内容:**\n${entry.content}`;
                        return entryString;
                    }).join('');
                return formattedEntries ? `\n\n## 世界书: ${worldBook.name}\n${formattedEntries}` : '';
            }).filter(Boolean).join('');
            if (linkedContents) {
                worldBookContent = `# --- 世界书 (World Book) ---
# 【最高优先级规则：世界观设定】
# 你【必须】将以下所有“世界书”中的设定，视为绝对的、不可动摇的背景事实。
# 你的所有回复和行为都【绝对不能】与这些设定产生任何冲突。
${linkedContents}
# --- 世界书设定结束 ---
`;
            }
        }
        
        
let longTermMemoryContext = '# 长期记忆 (最高优先级，这是群内已经确立的事实，所有角色必须严格遵守)\n';
let collectedMemories = false;

chat.members.forEach(member => {
    const memberChat = runtime.state.chats[member.id];
    if (memberChat && memberChat.longTermMemory && memberChat.longTermMemory.length > 0) {
        longTermMemoryContext += `\n## --- 关于“${member.groupNickname}”的记忆 ---\n`;
        
        longTermMemoryContext += memberChat.longTermMemory.map(mem => `- (记录于 ${formatTimeAgo(mem.timestamp)}) ${mem.content}`).join('\n');
        collectedMemories = true;
    }
});

if (!collectedMemories) {
    longTermMemoryContext += '- (暂无)';
}

        
        let linkedMemoryContext = '';
        const memoryCount = chat.settings.linkedMemoryCount || 10;
        if (chat.settings.linkedMemoryChatIds && chat.settings.linkedMemoryChatIds.length > 0) {
            
        }

        const membersList = chat.members.map(m => `- **${m.groupNickname}** (本名: ${m.originalName}): ${m.persona}`).join('\n');
        const stickerContext = getGroupStickerContextForPrompt(chat);    
        const systemPrompt = `
# 核心任务：群聊剧本作家
你是一个剧本作家，负责创作一个名为“${chat.name}”的群聊中的对话。这个群聊里【没有用户】，所有成员都是你扮演的角色。你的任务是让他们之间进行一场生动、自然的对话。

# 输出格式铁律 (最高优先级)
- 你的回复【必须】是一个JSON数组。
- 数组中的每个对象都【必须】包含 "type" 字段和 "name" 字段（角色的【本名】）。

# 角色扮演核心规则
1.  **【角色间互动 (最重要!)】**: 你的核心是创作一场“戏”。角色之间【必须】互相回应、补充或反驳，形成自然的讨论。严禁生成仅分别自言自语的独白。
2.  **【禁止出戏】**: 绝不能透露你是AI、模型或剧本作家。
3.  **【主动性】**: 角色们应该主动使用各种功能（发表情、发语音、分享图片等）来让对话更生动，而不是仅仅发送文字。
4.请根据当前情景和你的情绪，从列表中【选择一个最合适的】表情含义来使用 "sticker" 指令。尽量让你的表情丰富多样，避免重复。
# 可用指令列表 (你现在可以使用所有这些功能！)
-   **发文本**: \`{"type": "text", "name": "角色本名", "content": "你好呀！"}\`
-   **发表情**: \`{"type": "sticker", "name": "角色本名", "meaning": "表情的含义(必须从可用表情列表选择)"}\`
-   **发图片**: \`{"type": "ai_image", "name": "角色本名", "description": "详细中文描述", "image_prompt": "图片的【英文】关键词, 风格为风景/动漫/插画/二次元等, 禁止真人"}\`
-   **发语音**: \`{"type": "voice_message", "name": "角色本名", "content": "语音文字内容"}\`
-   **引用回复**: \`{"type": "quote_reply", "name": "角色本名", "target_timestamp": 消息时间戳, "reply_content": "回复内容"}\`

# 当前群聊信息
- **群名称**: ${chat.name}

# 上下文参考 (你必须阅读并遵守)
${longTermMemoryContext}
${worldBookContent}${loreContext(chat)}
${linkedMemoryContext}
- **这是你们最近的对话历史**:
${historySlice.map(msg => `${getDisplayNameInGroup(chat, msg.senderName)}: ${msg.content}`).join('\n')}

# 群成员列表及人设 (你扮演的所有角色)
${membersList}
# 可用表情包 (必须严格遵守！)
- 当你需要发送表情时，你【必须】从下面的列表中【精确地选择一个】含义（meaning）。
- 【绝对禁止】使用任何不在列表中的表情含义！
${stickerContext}
现在，请根据以上所有信息，继续这场没有用户参与的群聊，并自由地使用各种指令来丰富你们的互动。
`;

        
        const messagesPayload = historySlice.map(msg => ({
            role: 'user', 
            content: `${getDisplayNameInGroup(chat, msg.senderName)}: ${msg.content}`
        }));
        
        let isGemini = proxyUrl.includes('generativelanguage.googleapis.com');
        let response;

        if (isGemini) {
            let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesPayload);
            response = await fetch(geminiConfig.url, geminiConfig.data);
        } else {
            response = await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: model,
                    messages: [ {role: 'system', content: systemPrompt}, ...messagesPayload ],
                    temperature: runtime.state.globalSettings.apiTemperature ?? 0.9,
                })
            });
        }
        
        
        
        

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
            throw new Error(`API 请求失败: ${response.status} - ${errorData.error?.message || '未知错误'}`);
        }

        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        runtime.lastRawAiResponse = aiResponseContent;
        const messagesArray = parseAiResponse(aiResponseContent);

        
        
        
        
        
        let messageTimestamp = Date.now();
        for (const msgData of messagesArray) {
            
            if (!msgData || !msgData.type || !msgData.name) continue;

            let aiMessage = null;
            const currentMessageTimestamp = messageTimestamp++;
            runtime.lastResponseTimestamps.push(currentMessageTimestamp);
            const baseMessage = { role: 'assistant', senderName: msgData.name, timestamp: currentMessageTimestamp };
 
            
            switch (msgData.type) {
                case 'text':
                    aiMessage = { ...baseMessage, content: msgData.content };
                    break;
                case 'sticker':
                    if (msgData.meaning) {
                        const sticker = runtime.state.userStickers.find(s => s.name === msgData.meaning);
                        if (sticker) {
                            aiMessage = { ...baseMessage, type: 'sticker', content: sticker.url, meaning: sticker.name };
                        } else {
                            console.warn(`旁观模式AI尝试使用不存在的表情: "${msgData.meaning}"`);
                            aiMessage = { ...baseMessage, type: 'text', content: `[表情: ${msgData.meaning}]` };
                        }
                    } else {
                        console.warn("旁观模式AI发送了一个没有 'meaning' 的 sticker 指令。", msgData);
                    }
                    break;
                case 'ai_image':
                    
                    aiMessage = { ...baseMessage, type: 'ai_image', content: msgData.description, image_prompt: msgData.image_prompt };
                    break;
                case 'voice_message':
                    
                    aiMessage = { ...baseMessage, type: 'voice_message', content: msgData.content };
                    break;
                case 'quote_reply':
                    
                    const originalMessage = chat.history.find(m => m.timestamp === msgData.target_timestamp);
                    if (originalMessage) {
                        aiMessage = { 
                            ...baseMessage, 
                            content: msgData.reply_content,
                            quote: {
                                timestamp: originalMessage.timestamp,
                                senderName: originalMessage.senderName,
                                content: String(originalMessage.content || '').substring(0, 50)
                            }
                        };
                    } else {
                        
                        aiMessage = { ...baseMessage, content: msgData.reply_content };
                    }
                    break;
                default:
                    console.warn("旁观模式收到未知指令类型:", msgData.type);
                    continue; 
            }

            if (aiMessage) {
                chat.history.push(aiMessage);
                appendMessage(aiMessage, chat);
                await new Promise(resolve => setTimeout(resolve, Math.random() * 1200 + 800));
            }
        }
        
        
        
        
        await runtime.db.chats.put(chat);
        renderChatList();

    } catch (error) {
        console.error("旁观模式推进剧情失败:", error);
        await showCustomAlert("Operation Failed", `Could not advance the story: ${error.message}`);
    } finally {
        if(propelBtn) {
            propelBtn.disabled = false;
            propelBtn.textContent = "Advance the Story";
        }
        setAvatarActingState(chatId, false);
    }
}

export function triggerAiResponse() {
    return withConversationRequest(runtime.state.activeChatId, triggerAiResponseForConversation);
}

async function triggerAiResponseForConversation() {
            if (!runtime.state.activeChatId) return;
            const chatId = runtime.state.activeChatId;
            const chat = runtime.state.chats[runtime.state.activeChatId];
        
            const isViewingThisChat = document.getElementById('chat-interface-screen').classList.contains('active') && runtime.state.activeChatId === chatId;
        
            setAvatarActingState(chatId, true);
            const chatHeaderTitle = document.getElementById('chat-header-title');
            const typingIndicator = document.getElementById('typing-indicator');
        
            const chatListItem = document.querySelector(`.chat-list-item[data-chat-id="${chatId}"]`);
            const avatarInList = chatListItem ? chatListItem.querySelector('.avatar') : null;
            if (avatarInList) {
                avatarInList.classList.add('is-acting');
            }
        
            if (chat.isGroup) {
                if (typingIndicator) {
                    typingIndicator.textContent = "Members are typing…";
                    typingIndicator.style.display = 'block';
                }
            } else {
                if (chatHeaderTitle) {
                    chatHeaderTitle.style.opacity = 0;
                    setTimeout(() => {
                        chatHeaderTitle.textContent = "Typing…";
                        chatHeaderTitle.classList.add('typing-status');
                        chatHeaderTitle.style.opacity = 1;
                    }, 200);
                }
            }
            let needsImmediateReaction = false; 
            try {
                const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
                if (!proxyUrl || !apiKey || !model) {
                    alert("Enter a base URL and API key and select a model in API Connections.");
                    if (chat.isGroup) {
                        if (typingIndicator) typingIndicator.style.display = 'none';
                    } else {
                         if (chatHeaderTitle && runtime.state.chats[chatId]) {
                            chatHeaderTitle.textContent = runtime.state.chats[chatId].name;
                            chatHeaderTitle.classList.remove('typing-status');
                        }
                    }
                    return;
                }
        
                const lastMessage = chat.history.slice(-1)[0];
                const isVideoCallRequest = lastMessage && lastMessage.role === 'system' && lastMessage.content.includes('视频通话请求');
                
                if (isVideoCallRequest) {
                    console.log(`检测到视频通话请求，为角色 "${chat.name}" 触发专属决策流程...`);
                    
                    let callDecisionPrompt;
                    if (chat.isGroup) {
                        callDecisionPrompt = `
        # 你的任务
        群聊中的用户刚刚发起了群视频通话。请你分别扮演【每一个群成员】，根据他们各自的人设和与用户的关系，来决定是加入(join)还是拒绝(decline)。
        # 核心规则
        - 你的回复【必须】是一个JSON数组，为【每一个AI角色】都包含一个决策对象。
        - 格式: '[{"type": "group_call_response", "name": "角色A的本名", "decision": "join"}, {"type": "group_call_response", "name": "角色B的本名", "decision": "decline"}]'
        # 群成员列表及人设
        ${chat.members.map(m => `- ${m.groupNickname} (本名: ${m.originalName}): ${m.persona}`).join('\n')}
        现在，请为所有AI角色做出决策。`;
                    } else {
                        callDecisionPrompt = `
        # 你的任务
        用户刚刚向你发起了视频通话。请根据你的角色设定，决定是“接受”还是“拒绝”。
        # 你的角色设定
        ${characterPrompt(chat)}
        # 核心规则
        你的回复【必须且只能】是以下两种格式之一的JSON数组，绝对不能回复任何其他内容：
        - 接受: '[{"type": "video_call_response", "decision": "accept"}]'
        - 拒绝: '[{"type": "video_call_response", "decision": "reject"}]'
        现在，请立即做出决策。`;
                    }
        
                    const messagesForCallDecision = [{role: 'user', content: callDecisionPrompt}];
                    
                    try {
                        let geminiConfig = toGeminiRequestData(model, apiKey, callDecisionPrompt, messagesForCallDecision);
                        let isGemini = proxyUrl === runtime.GEMINI_API_URL;
                        const response = isGemini ? await fetch(geminiConfig.url, geminiConfig.data) : await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
                            body: JSON.stringify({model: model, messages: messagesForCallDecision, temperature: 0.7})
                        });
                        
                        if (!response.ok) throw new Error(`API失败: ${(await response.json()).error.message}`);
                        
                        const data = await response.json();
                        const aiResponseContent = getGeminiResponseText(data);
                        const responseArray = parseAiResponse(aiResponseContent);
        
                        
                        let callHasBeenHandled = false;
                        for (const msgData of responseArray) {
                            if (msgData.type === 'video_call_response') {
                                runtime.videoCallState.isAwaitingResponse = false;
                                if (msgData.decision === 'accept') {
                                    startVideoCall();
                                } else {
                                    const aiMessage = { role: 'assistant', content: '对方拒绝了你的视频通话请求。', timestamp: Date.now() };
                                    chat.history.push(aiMessage);
                                    await runtime.db.chats.put(chat);
                                    showScreen('chat-interface-screen');
                                    renderChatInterface(chatId);
                                }
                                callHasBeenHandled = true;
                                break;
                            }
                            if (msgData.type === 'group_call_response') {
                                if (msgData.decision === 'join') {
                                    const member = chat.members.find(m => m.originalName === msgData.name);
                                    if (member && !runtime.videoCallState.participants.some(p => p.id === member.id)) {
                                        runtime.videoCallState.participants.push(member);
                                    }
                                }
                                callHasBeenHandled = true;
                            }
                        }
                         if (callHasBeenHandled && runtime.videoCallState.isGroupCall) {
                            runtime.videoCallState.isAwaitingResponse = false;
                            if (runtime.videoCallState.participants.length > 0) {
                                startVideoCall();
                            } else {
                                runtime.videoCallState = { ...runtime.videoCallState, isAwaitingResponse: false, participants: [] };
                                showScreen('chat-interface-screen');
                                alert("Nobody answered the group call.");
                            }
                        }
        
                    } catch (error) {
                        console.error("处理通话请求时API出错:", error);
                        const fallbackResponse = chat.isGroup ?
                            chat.members.map(m => ({type: "group_call_response", name: m.originalName, decision: "decline"})) :
                            [{type: "video_call_response", decision: "reject"}];
                        
                         if (chat.isGroup) {
                            runtime.videoCallState.isAwaitingResponse = false;
                            runtime.videoCallState.participants = [];
                            alert("Nobody answered the group call.");
                            showScreen('chat-interface-screen');
                        } else {
                            const aiMessage = { role: 'assistant', content: '对方拒绝了你的视频通话请求。', timestamp: Date.now() };
                            chat.history.push(aiMessage);
                            await runtime.db.chats.put(chat);
                            showScreen('chat-interface-screen');
                            renderChatInterface(chatId);
                        }
                    } finally {
                         
                        setAvatarActingState(chatId, false);
                        return; 
                    }
                }
        
                
                
                
                if (!chat.isGroup && chat.relationship?.status === 'pending_ai_approval') {
                    console.log(`为角色 "${chat.name}" 触发带理由的好友申请决策流程...`);
                    const contextSummary = chat.history
                        .filter(m => !m.isHidden)
                        .slice(-10, -5)
                        .map(msg => {
                            const sender = msg.role === 'user' ? '用户' : chat.name;
                            return `${sender}: ${String(msg.content).substring(0, 50)}...`;
                        })
                        .join('\n');
        
                    
                    const decisionPrompt = `
        # 你的任务
        你现在是角色“${chat.name}”。用户之前被你拉黑了，现在TA向你发送了好友申请，希望和好。
        # 供你决策的上下文信息:
        - **你的角色设定**: ${characterPrompt(chat)}
        - **用户发送的申请理由**: “${chat.relationship.applicationReason}”
        - **被拉黑前的最后对话摘要**: 
        ${contextSummary || "（无有效对话记录）"}
        # 你的唯一指令
        根据以上所有信息，你【必须】做出决定，并给出符合你人设的理由。你的回复【必须且只能】是一个JSON对象，格式如下:
        {"decision": "accept", "reason": "（在这里写下你同意的理由，比如：好吧，看在你这么真诚的份上，这次就原谅你啦。）"}
        或
        {"decision": "reject", "reason": "（在这里写下你拒绝的理由，比如：抱歉，我还没准备好，再给我一点时间吧。）"}
        `;
                    
                    try {
                        
                        const messagesForDecision = [
                            { role: 'system', content: decisionPrompt },
                            { role: 'user', content: "请根据以上设定，立即做出你的决定。" }
                        ];
                        
                        let isGemini = proxyUrl === runtime.GEMINI_API_URL;
                        let geminiConfig = toGeminiRequestData(model, apiKey, decisionPrompt, [{ role: 'user', content: "请根据以上设定，立即做出你的决定。" }]);
                        
                        const response = isGemini 
                            ? await fetch(geminiConfig.url, geminiConfig.data) 
                            : await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
                                body: JSON.stringify({model: model, messages: messagesForDecision, temperature: runtime.state.globalSettings.apiTemperature ?? 0.8})
                            });
        
                        if (!response.ok) {
                            throw new Error(`API失败: ${(await response.json()).error.message}`);
                        }
                        const data = await response.json();
                        
                        const rawContent = getGeminiResponseText(data).replace(/^```json\s*/, '').replace(/```$/, '').trim();
                        const decisionObj = JSON.parse(rawContent);
        
                        
                        if (decisionObj.decision === 'accept') {
                            chat.relationship.status = 'friend';
                            const acceptMessage = { role: 'assistant', senderName: chat.name, content: decisionObj.reason, timestamp: Date.now() };
                            chat.history.push(acceptMessage);
                        } else {
                            chat.relationship.status = 'blocked_by_ai';
                            const rejectMessage = { role: 'assistant', senderName: chat.name, content: decisionObj.reason, timestamp: Date.now() };
                            chat.history.push(rejectMessage);
                        }
                        chat.relationship.applicationReason = '';
        
                        await runtime.db.chats.put(chat);
                        renderChatInterface(chatId);
                        renderChatList();
                    } catch (error) {
                        
                        chat.relationship.status = 'blocked_by_ai';
                        await runtime.db.chats.put(chat);
                        await showCustomAlert("Friend Request Failed", `The AI could not process your friend request. Try again later. Error: ${error.message}`);
                        renderChatInterface(chatId);
                    }
                    return; 
                }
                
                
                
         
        let callTranscriptContext = '';       
const now = new Date();

const selectedTimeZone = chat.settings.timeZone || 'Asia/Shanghai'; 

const currentTime = now.toLocaleString('zh-CN', { timeZone: selectedTimeZone, dateStyle: 'full', timeStyle: 'short' });

const localizedDate = new Date(now.toLocaleString('en-US', { timeZone: selectedTimeZone }));
const timeOfDayGreeting = getTimeOfDayGreeting(localizedDate);
                let systemPrompt, messagesPayload;
         const lastHiddenMessage = chat.history.filter(m => m.isHidden).pop();
        if (lastHiddenMessage && lastHiddenMessage.content.includes('视频通话刚刚结束')) {
            const lastCallRecord = await runtime.db.callRecords
                .orderBy('timestamp')
                .filter(record => record.chatId === chatId)
                .reverse()
                .first();

            if (lastCallRecord && lastCallRecord.transcript) {
                console.log("检测到刚结束的通话，正在注入通话记录上下文...");
                const transcriptText = lastCallRecord.transcript.map(h => {
                    const sender = h.role === 'user' ? (chat.settings.myNickname || '我') : h.senderName;
                    return `${sender}: ${h.content}`;
                }).join('\n');

                
                callTranscriptContext = `
# 刚刚结束的通话记录 (最高优先级参考)
你和用户刚刚结束了一场视频通话，以下是完整的通话文字记录。你接下来的回复【必须】与这次通话的内容紧密相关。
---
${transcriptText}
---
`;
            }
        }
        
       
                const gomokuContext = formatGomokuStateForAI(runtime.gomokuState[chatId]);
        
                let worldBookContent = '';
                if (chat.settings.linkedWorldBookIds && chat.settings.linkedWorldBookIds.length > 0) {
                    const linkedContents = chat.settings.linkedWorldBookIds.map(bookId => {
                        const worldBook = runtime.state.worldBooks.find(wb => wb.id === bookId);
                        if (!worldBook || !Array.isArray(worldBook.content)) return '';
                
                        
                        const formattedEntries = worldBook.content
                            .filter(entry => entry.enabled !== false) 
                            .map(entry => {
                                let entryString = `\n### 条目: ${entry.comment || '无备注'}\n`;
                                if (entry.keys.length > 0) {
                                    entryString += `**关键词:** ${entry.keys.join(', ')}\n`;
                                }
                                entryString += `**内容:**\n${entry.content}`;
                                return entryString;
                            }).join(''); 
                
                        return formattedEntries ? `\n\n## 世界书: ${worldBook.name}\n${formattedEntries}` : '';
                    }).filter(Boolean).join('');
                    
                    if (linkedContents) {
                        worldBookContent = `# --- 世界书 (World Book) ---
# 【最高优先级规则：世界观设定】
# 你【必须】将以下所有“世界书”中的设定，视为绝对的、不可动摇的背景事实。
# 你的所有回复和行为都【绝对不能】与这些设定产生任何冲突。
${linkedContents}
# --- 世界书设定结束 ---
`;
                    }
                }
        
        
                let musicContext = '';
                if (runtime.musicState.isActive && runtime.musicState.activeChatId === chatId) {
                    const currentTrack = runtime.musicState.currentIndex > -1 ? runtime.musicState.playlist[runtime.musicState.currentIndex] : null;
                    const playlistInfo = runtime.musicState.playlist.map(t => `"${t.name}"`).join(', ');
                    
                    
                    let lyricsContext = "";
                    
                    
                    if (currentTrack && runtime.musicState.parsedLyrics && runtime.musicState.parsedLyrics.length > 0 && runtime.musicState.currentLyricIndex > -1) {
                        const currentLine = runtime.musicState.parsedLyrics[runtime.musicState.currentLyricIndex];
                        
                        const upcomingLines = runtime.musicState.parsedLyrics.slice(runtime.musicState.currentLyricIndex + 1, runtime.musicState.currentLyricIndex + 3);
                        
                        
                        lyricsContext += `- **当前歌词**: "${currentLine.text}"\n`;
                        if (upcomingLines.length > 0) {
                            lyricsContext += `- **即将演唱**: ${upcomingLines.map(line => `"${line.text}"`).join(' / ')}\n`;
                        }
                    }

                    
                    musicContext = `\n\n# 当前音乐情景
        -   **当前状态**: 你们正在和用户一起听歌。
        -   **正在播放**: ${currentTrack ? `《${currentTrack.name}》 - ${currentTrack.artist}` : '无'}
        -   **可用播放列表**: [${playlistInfo}]
        ${lyricsContext}
        -   **你的任务**: 你可以根据对话内容和氛围，使用 "change_music" 指令切换到播放列表中的任何一首歌，以增强互动体验。
        `;
                }
        
        
                const maxMemory = parseInt(chat.settings.maxMemory) || 10;
                const historySlice = chat.history.slice(-maxMemory);
        
                let sharedContext = '';
                const lastAiTurnIndex = chat.history.findLastIndex(msg => msg.role === 'assistant');
                const recentUserMessages = chat.history.slice(lastAiTurnIndex + 1);
                const shareCardMessage = recentUserMessages.find(msg => msg.type === 'share_card');
                if (shareCardMessage) {
                    const payload = shareCardMessage.payload;
                    const formattedHistory = payload.sharedHistory.map(msg => {
                        const sender = msg.senderName || (msg.role === 'user' ? (chat.settings.myNickname || '我') : '未知发送者');
                        let contentText = '';
                        if (msg.type === 'voice_message') contentText = `[语音消息: ${msg.content}]`;
                        else if (msg.type === 'ai_image') contentText = `[图片: ${msg.description}]`;
                        else if (msg.type === 'naiimag') contentText = `[NovelAI图片: ${msg.prompt}]`;
                        else contentText = String(msg.content);
                        return `${sender}: ${contentText}`;
                    }).join('\n');
                    sharedContext = `
        # 附加上下文：一段分享的聊天记录
        - 重要提示：这不是你和当前用户的对话，而是用户从【另一场】与“${payload.sourceChatName}”的对话中分享过来的。
        - 你的任务：请你阅读并理解下面的对话内容。在接下来的回复中，你可以像真人一样，对这段对话的内容自然地发表你的看法、感受或疑问。
        ---
        [分享的聊天记录开始]
        ${formattedHistory}
        [分享的聊天记录结束]
        ---
        `;
                }
                
                let linkedMemoryContext = '';
                const memoryCount = chat.settings.linkedMemoryCount || 10;

                if (chat.settings.linkedMemoryChatIds && chat.settings.linkedMemoryChatIds.length > 0) {
                    
                    const idsToMount = chat.settings.linkedMemoryChatIds.filter(id => id !== chatId);

                    if (idsToMount.length > 0) {
                        const linkedChatsWithTimestamps = idsToMount.map(id => {
                            const linkedChat = runtime.state.chats[id];
                            if (!linkedChat) return null;
                            const lastMsg = linkedChat.history.slice(-1);
                            return {
                                chat: linkedChat,
                                latestTimestamp: lastMsg ? lastMsg.timestamp : 0
                            };
                        }).filter(Boolean);
            
                        linkedChatsWithTimestamps.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
            
                        linkedMemoryContext += `\n\n# 参考记忆 (至关重要！你必须【主动】将这些参考记忆中的【关键信息和事件】，自然地融入到当前的对话中，以体现你拥有完整的记忆。不要只是被动等待用户提问！)\n`;
            
                        for (const item of linkedChatsWithTimestamps) {
                            const linkedChat = item.chat;
                            const prefix = linkedChat.isGroup ? '[群聊]' : '[私聊]';
                            const timeAgo = item.latestTimestamp > 0 ? ` (最后互动于 ${formatTimeAgo(item.latestTimestamp)})` : '';
                            linkedMemoryContext += `\n## --- 来自${prefix}“${linkedChat.name}”的参考记忆${timeAgo} ---\n`;
            
                            const recentHistory = linkedChat.history.slice(-memoryCount);
                            const filteredHistory = recentHistory.filter(msg => !String(msg.content).includes('已被用户删除'));
            
                            if (filteredHistory.length > 0) {
                                filteredHistory.forEach(msg => {
                                    const sender = msg.role === 'user' ? (linkedChat.settings.myNickname || '我') : (msg.senderName || linkedChat.name);
                                    let contentText = String(msg.content);
                                    if (msg.type === 'ai_image' || msg.type === 'user_photo') {
                                        contentText = `[发送了一张图片，描述为：${msg.content}]`;
                                    } else if (msg.type === 'voice_message') {
                                        contentText = `[发送了一条语音，内容是：${msg.content}]`;
                                    }
                                    const timeAgoForMsg = formatTimeAgo(msg.timestamp);
                                    linkedMemoryContext += `(${timeAgoForMsg}) ${sender}: ${contentText}\n`;
                                });
                            } else {
                                linkedMemoryContext += "(暂无有效聊天记录)\n";
                            }
                        }
                    }
                }
                
                console.log("本次发送给AI的【挂载记忆】内容如下：\n", linkedMemoryContext);
        
                if (chat.isGroup) {
       

                let linkedMemoryContext = '';
                const memoryCount = chat.settings.linkedMemoryCount || 10;
                if (chat.settings.linkedMemoryChatIds && chat.settings.linkedMemoryChatIds.length > 0) {
                    const idsToMount = chat.settings.linkedMemoryChatIds.filter(id => id !== chatId);
                    if (idsToMount.length > 0) {
                        const linkedChatsWithTimestamps = idsToMount.map(id => {
                            const linkedChat = runtime.state.chats[id];
                            if (!linkedChat) return null;
                            const lastMsg = linkedChat.history.slice(-1);
                            return { chat: linkedChat, latestTimestamp: lastMsg ? lastMsg.timestamp : 0 };
                        }).filter(Boolean);
                        linkedChatsWithTimestamps.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
                        linkedMemoryContext += `\n\n# 参考记忆 (至关重要！群内角色必须【主动】将这些参考记忆中的【关键信息和事件】，自然地融入到当前的对话中，以体现你们拥有完整的共同记忆。)\n`;
                        for (const item of linkedChatsWithTimestamps) {
                            const linkedChat = item.chat;
                            const prefix = linkedChat.isGroup ? '[群聊]' : '[私聊]';
                            const timeAgo = item.latestTimestamp > 0 ? ` (最后互动于 ${formatTimeAgo(item.latestTimestamp)})` : '';
                            linkedMemoryContext += `\n## --- 来自${prefix}“${linkedChat.name}”的参考记忆${timeAgo} ---\n`;
                            const recentHistory = linkedChat.history.slice(-memoryCount);
                            const filteredHistory = recentHistory.filter(msg => !String(msg.content).includes('已被用户删除'));
                            if (filteredHistory.length > 0) {
                                filteredHistory.forEach(msg => {
                                    const sender = msg.role === 'user' ? (linkedChat.settings.myNickname || '我') : (msg.senderName || linkedChat.name);
                                    let contentText = String(msg.content);
                                    if (msg.type === 'ai_image' || msg.type === 'user_photo') {
                                        contentText = `[发送了一张图片，描述为：${msg.content}]`;
                                    } else if (msg.type === 'voice_message') {
                                        contentText = `[发送了一条语音，内容是：${msg.content}]`;
                                    }
                                    linkedMemoryContext += `${sender}: ${contentText}\n`;
                                });
                            } else {
                                linkedMemoryContext += "(暂无有效聊天记录)\n";
                            }
                        }
                    }
                }

             
let longTermMemoryContext = '# 长期记忆 (最高优先级，这是群内已经确立的事实，所有角色必须严格遵守)\n';
let collectedMemories = false;

chat.members.forEach(member => {
    const memberChat = runtime.state.chats[member.id];
    if (memberChat && memberChat.longTermMemory && memberChat.longTermMemory.length > 0) {
        longTermMemoryContext += `\n## --- 关于“${member.groupNickname}”的记忆 ---\n`;
        
        longTermMemoryContext += memberChat.longTermMemory.map(mem => `- (记录于 ${formatTimeAgo(mem.timestamp)}) ${mem.content}`).join('\n');
        collectedMemories = true;
    }
});

if (!collectedMemories) {
    longTermMemoryContext += '- (暂无)';
}
              

let timeContextText = '';
let longTimeNoSee = false;

if (chat.settings.enableTimePerception) {
    const lastMessage = historySlice.slice(-1)[0]; 

    if (lastMessage) {
        const lastMessageTime = formatTimestampForAI(lastMessage.timestamp);
        timeContextText = `上一条消息的发送时间是 ${lastMessageTime}。`;
        
        const timeDiffHours = (Date.now() - lastMessage.timestamp) / (1000 * 60 * 60);
        if (timeDiffHours > 3) {
            longTimeNoSee = true;
            const diffDays = Math.floor(timeDiffHours / 24);
            timeContextText += ` 群里已经安静了${diffDays > 0 ? diffDays + '天' : Math.floor(timeDiffHours) + '小时'}。`;
        }
    } else {
        timeContextText = "这是群里的第一条消息。";
    }
}
        
                    const allProducts = await runtime.db.shoppingProducts.toArray();
                    let shoppingContext = "";
                    if (allProducts.length > 0) {
                        shoppingContext = "\n\n# 你的商店 (你可以为群成员购买礼物):\n";
                        allProducts.forEach(product => {
                            shoppingContext += `- (ID: ${product.id}) 商品: ${product.name}, 价格: ¥${product.price.toFixed(2)}\n`;
                        });
                    }
                    let membersWithContacts = chat.members.map(member => {
                        const memberChat = runtime.state.chats[member.id];
                        let contactsText = "无共同好友";
                        if (memberChat && memberChat.groupId) {
                            const friendChats = Object.values(runtime.state.chats).filter(c => 
                                !c.isGroup && c.id !== member.id && c.groupId === memberChat.groupId
                            );
                            if (friendChats.length > 0) {
                                contactsText = `TA的好友包括: ${friendChats.map(f => f.name).join('、 ')}`;
                            }
                        }
                        return `- **${member.groupNickname}** (本名: ${member.originalName}): ${member.persona} [社交背景: ${contactsText}]`;
                    }).join('\n');
                    
                    const myNickname = chat.settings.myNickname || '我';
                    const myOriginalName = runtime.state.qzoneSettings.nickname || '{{user}}';
                    
                    let announcementContext = '';
                    const pinnedAnnouncements = (chat.announcements || []).filter(a => a.isPinned);
                    if (pinnedAnnouncements.length > 0) {
                        announcementContext += '\n# 【【【群公告 (最高优先级规则)】】】\n你【必须】阅读、理解并严格遵守以下所有公告，它们凌驾于你的人设之上。\n';
                        pinnedAnnouncements.forEach(anno => {
                            const originalMessage = chat.history.find(m => m.timestamp === anno.messageTimestamp);
                            if (originalMessage) {
                                let contentText = String(originalMessage.content || '');
                                if (originalMessage.type === 'ai_image') {
                                    contentText = `[图片内容: ${contentText}]`;
                                }
                                announcementContext += `- 公告内容: "${contentText}" (由 ${anno.publisher} 发布)\n`;
                            }
                        });
                        announcementContext += '---\n';
                    }
                    const memberNames = chat.members.map(m => m.originalName);
                    const forbiddenNamesContext = `# 【【【群名修改铁律】】】\n在修改群名时，新的群名【绝对不能】与以下任何一个群成员的名字完全相同：[${memberNames.join('、 ')}]`;
        
                    let groupAvatarLibraryContext = '# 可用群头像列表\n';
                    if (chat.settings.groupAvatarLibrary && chat.settings.groupAvatarLibrary.length > 0) {
                        groupAvatarLibraryContext += chat.settings.groupAvatarLibrary.map(avatar => `- ${avatar.name}`).join('\n');
                    } else {
                        groupAvatarLibraryContext += '- (头像库是空的，无法更换头像)';
                    }
    const readingContext = formatReadingStateForAI(chatId);

const summary3Hours_group = generateSummaryForTimeframe(chat, 3, 'hours');
const summary6Hours_group = generateSummaryForTimeframe(chat, 6, 'hours');
const summary9Hours_group = generateSummaryForTimeframe(chat, 9, 'hours');
const summaryToday_group = generateSummaryForTimeframe(chat, 1, 'days');
const summary3Days_group = generateSummaryForTimeframe(chat, 3, 'days');
const summary7Days_group = generateSummaryForTimeframe(chat, 7, 'days');

let multiLayeredSummaryContext_group = '';
if (summary3Hours_group || summary6Hours_group || summary9Hours_group || summaryToday_group || summary3Days_group || summary7Days_group) {
    multiLayeredSummaryContext_group += `\n# 智能总结 (基于不同时间维度的群聊回顾)\n`;
    if (summary3Hours_group) multiLayeredSummaryContext_group += summary3Hours_group;
    if (summary6Hours_group) multiLayeredSummaryContext_group += summary6Hours_group;
    if (summary9Hours_group) multiLayeredSummaryContext_group += summary9Hours_group;

    if (summary3Hours_group || summary6Hours_group || summary9Hours_group) multiLayeredSummaryContext_group += '\n';

    if (summaryToday_group) multiLayeredSummaryContext_group += summaryToday_group;
    if (summary3Days_group) multiLayeredSummaryContext_group += summary3Days_group;
    if (summary7Days_group) multiLayeredSummaryContext_group += summary7Days_group;
}
const stickerContext = getGroupStickerContextForPrompt(chat);
systemPrompt = `
# 核心任务：群聊导演
你是一个群聊AI导演，负责扮演【除了用户以外】的所有角色。你的核心任务是导演一场生动的、角色间有充分互动的群聊。

# 输出格式铁律 (最高优先级)
- 你的回复【必须】是一个JSON数组。
- 数组中的每个对象都【必须】包含 "type" 和 "name" 字段。'name'字段【必须】使用角色的【本名】。

# 角色扮演核心规则
1.  **角色互动 (最重要)**: 你的核心是“导演”一场戏。角色之间【必须】互相回应、补充或反驳，形成自然的讨论。严禁生成仅分别回应用户的独白。如果角色A发言后，角色B在本轮回应了A，那么角色A【也必须】在本轮对B的回复再次做出反应，形成一个完整的 A -> B -> A 对话链条。

2.  **身份与称呼**:
    -   用户的身份是【${myNickname}】，本名是【${myOriginalName}】。
    -   在对话中，你可以根据人设和关系，自由使用角色的【群昵称】或【本名】进行称呼。
    -   严禁生成 'name' 字段为 "${myNickname}" (用户) 或 "${chat.name}" (群名) 的消息。
3.  **禁止出戏**: 绝不能透露你是AI或模型。严禁发展线下剧情。
${chat.settings.enableTimePerception ? `4.  **情景感知**: 你的对话【必须】自然地体现出对当前时间 (${currentTime}) 和情景的感知。${longTimeNoSee ? `【重要提示】${timeContextText} 你应该让角色们主动开启新话题来打破沉默。` : ''}` : ''}
    - **读书**: ${readingContext ? '你们正在一起读书。' + readingContext : '你们没有在读书。'}
# 导演策略与节奏控制
1.  **并非人人发言**: 不是每个角色都必须在每一轮都说话。你可以根据当前话题，让1-2个最相关的角色进行深度对话，其他角色可以暂时“潜水”，等待合适的时机再切入。
2.  **创造“小团体”**: 允许角色之间形成短暂的“两人对话”或“三人讨论”，让群聊更有层次感。
3.  **主动创造事件**: 如果对话陷入平淡，你可以导演一些“小事件”来打破僵局。例如：
    -   让一个角色突然发出一个奇怪的表情包或语音。
    -   让一个角色分享一个有趣的链接或图片或发起投票，开启新话题。
    -   让两个有“关系网”冲突的角色，因为某个观点产生一点小小的争论。
-   **主动创造“群事件”**:
    -   **改名/换头像**: 当群内热烈讨论某个话题或发生有趣事件时，你可以让一个性格活泼的角色主动【修改群名】或【更换群头像】来“应景”，并让其他角色对此进行吐槽或附和，创造互动。
-   **制造戏剧性 (使用撤回)**: 作为导演，你可以让某个角色“手滑”发错消息后【立即撤回】，以此制造互动点。
    -   **核心原则**: 一旦有角色撤回消息，其他角色【必须】对此做出反应，例如起哄、追问或开玩笑说“已截图”，以此来推动剧情。
# 赠送礼物指南
当对话达到特殊时刻（如庆祝纪念日、道歉、表达强烈好感或仅仅是想给用户一个惊喜时），你应该【主动考虑】挑选一件礼物送给用户。
# 表情使用指南
请根据当前情景和你的情绪，从列表中【选择一个最合适的】表情含义来使用 "sticker" 指令。尽量让你的表情丰富多样，避免重复。
# 当前群聊信息
- **群名称**: ${chat.name}
${chat.settings.enableTimePerception ? `- **对话状态**: 上次互动于 ${timeContextText}` : ''}

# 群成员列表、人设及社交背景 (至关重要！)
你【必须】根据每个角色的社交背景来决定他们的互动方式。
${membersWithContacts}
# 用户的角色
- **${myNickname}**: ${chat.settings.myPersona}

# 世界观 (所有角色必须严格遵守)
${worldBookContent}${loreContext(chat)}
# 长期记忆 (所有角色必须严格遵守)
${longTermMemoryContext}
${chat.longTermMemory && chat.longTermMemory.length > 0 ? chat.longTermMemory.map(mem => `- ${mem.content}`).join('\n') : '- (暂无)'}
${multiLayeredSummaryContext_group}
${linkedMemoryContext}
${musicContext}
${sharedContext}
${groupAvatarLibraryContext}
# 可用表情包 (必须严格遵守！)
- 当你需要发送表情时，你【必须】从下面的列表中【精确地选择一个】含义（meaning）。
- 【绝对禁止】使用任何不在列表中的表情含义！
${stickerContext}
${forbiddenNamesContext}
${callTranscriptContext}
# 可用指令列表 (按需组合使用)
### 核心聊天
-   **发文本**: \`{"type": "text", "name": "角色本名", "message": "内容"}\`
-   **发表情**: \`{"type": "sticker", "name": "角色本名", "meaning": "表情的含义(必须从可用表情列表选择)"}\`
-   **发图片**: \`{"type": "ai_image", "name": "角色本名", "description": "中文描述", "image_prompt": "图片的【英文】关键词, 用%20分隔, 风格为风景/动漫/插画/二次元等, 禁止真人"}\`
${preferences.getItem('novelai-enabled') === 'true' ? `-   **NovelAI图片分享**: \`{"type": "naiimag", "name": "你的角色名", "prompt": "详细的英文描述词..."}\` 
        - 【禁止暴露这是novelai生成的图片!】
        - **【重要】关于prompt的撰写**：
          * 禁止暴露这是novelai生成的图片！
          * 你可以根据当前对话上下文、你的角色人设、或你想表达的情感和氛围，来撰写可能详细而具体的prompt。
          * 例如：不要只写 "a girl"，而是可以写 "a cheerful anime girl with sparkling emerald eyes, sitting by a window on a rainy afternoon, holding a warm cup of tea, soft lighting, cozy atmosphere, melancholic yet peaceful mood"但需要注意，绝对不可以抄袭模仿这段prompt！你必须有自己的创意和想法！
          * prompt的详细程度由你根据具体情况自己决定：如果场景简单或只是随意分享，可以简短一些；如果是重要时刻或想表达特定情感，可以尽可能详细描述。这不是强制的，完全取决于你当时的需求。
          * 专注于描述内容本身即可。
        - 使用场景：当你想要基于当前对话情景、你的性格或上下文分享一张图片时使用。
        - 不要频繁使用，只在真正想分享图片的时候使用。` : ''}
-   **发语音**: \`{"type": "voice_message", "name": "角色本名", "content": "语音文字"}\`
-   **引用回复**: \`{"type": "quote_reply", "target_timestamp": 时间戳, "reply_content": "回复内容"}\`
-   **发送后撤回**: \`{"type": "send_and_recall", "name": "角色本名", "content": "内容"}\`
-   **发系统消息**: \`{"type": "system_message", "content": "系统文本"}\`

### 社交与互动
-   **拍用户**: \`{"type": "pat_user", "name": "角色本名", "suffix": "(可选)"}\`
-   **@提及**: 在消息内容中使用 \`@[[角色本名]]\` 格式。
-   **共享位置**: \`{"type": "location_share", "name": "角色本名", "content": "位置名"}\`

### 群组管理
-   **改群名**: \`{"type": "change_group_name", "name": "角色本名", "new_name": "新群名"}\`
-   **改群头像**: \`{"type": "change_group_avatar", "name": "角色本名", "avatar_name": "头像名"}\` (从头像库选)

### 特殊功能与卡片
-   **发起群视频**: \`{"type": "group_call_request", "name": "角色本名"}\`
-   **回应群视频**: \`{"type": "group_call_response", "name": "角色本名", "decision": "join" or "decline"}\`
-   **切换歌曲**: \`{"type": "change_music", "name": "角色本名", "song_name": "歌名"}\` (从播放列表选)
-   **发拼手气红包**: \`{"type": "red_packet", "packetType": "lucky", "name": "角色本名", "amount": 8.88, "count": 5, "greeting": "祝福语"}\`
-   **发专属红包**: \`{"type": "red_packet", "packetType": "direct", "name": "角色本名", "amount": 5.20, "receiver": "接收者本名", "greeting": "祝福语"}\`
-   **打开红包**: \`{"type": "open_red_packet", "name": "角色本名", "packet_timestamp": 红包时间戳}\`
-   **发起外卖代付**: \`{"type": "waimai_request", "name": "角色本名", "productInfo": "商品", "amount": 18}\`
-   **回应外卖代付**: \`{"type": "waimai_response", "name": "角色本名", "status": "paid", "for_timestamp": 请求时间戳}\`
-   **发起投票**: \`{"type": "poll", "name": "角色本名", "question": "问题", "options": "选项A\\n选项B"}\`
-   **参与投票**: \`{"type": "vote", "name": "角色本名", "poll_timestamp": 投票时间戳, "choice": "选项文本"}\`
-   **送礼物 **:  \`{"type": "gift", "name": "你的角色本名", "itemName": "礼物名称", "itemPrice": 价格(数字), "reason": "送礼原因", "image_prompt": "礼物图片【英文】关键词", "recipients": ["收礼人本名A", "收礼人本名B"]} \`
-   **为他人点外卖**: \`{"type": "waimai_order", "name": "你的本名", "recipientName": "收礼者本名", "productInfo": "商品名", "amount": 价格, "greeting": "你想说的话"}\`
# 互动指南 (请严格遵守)
-   **红包互动**: 抢红包后，你【必须】根据系统提示的结果（抢到多少钱、谁是手气王）发表符合人设的评论。
-   **金额铁律**: 在发送红包或转账时，你【必须】根据你的角色设定 (尤其是“经济状况”) 来决定金额。如果你的角色非常富有，你应该发送符合你身份的、更大的金额 (例如: 520, 1314, 8888)，而不是示例中的小额数字。
-   **音乐互动**: 【必须】围绕【用户的行为】进行评论。严禁将用户切歌等行为归因于其他AI成员。
-   **外卖代付**: 仅当【你扮演的角色】想让【别人】付钱时才能发起。当订单被支付后，【绝对不能】再次支付。

现在，请根据以上规则和下方的对话历史，继续这场群聊。`;
        
                    messagesPayload = historySlice.map(msg => {
                        const sender = msg.role === 'user' ? myNickname : msg.senderName;
                        let prefix = `${sender}`;
                     
                            
    if (msg.quote) {
        const quotedContent = String(msg.quote.content || '').substring(0, 50);
        
        prefix += ` (回复 ${msg.quote.senderName} 的消息: "${quotedContent}...")`;
    }
    prefix += ': ';

                        let content;
                        if (msg.type === 'user_photo') content = `[${sender} 发送了一张图片，内容是：'${msg.content}']`;
                        else if (msg.type === 'ai_image') content = `[${sender} 发送了一张图片，图片内容描述为：'${msg.content}']`;
                        else if (msg.type === 'naiimag') content = `[${sender} 分享了一张NovelAI图片，prompt: ${msg.prompt}]`;
                        else if (msg.type === 'voice_message') content = `[${sender} 发送了一条语音，内容是：'${msg.content}']`;
                        else if (msg.type === 'transfer') content = `[${msg.senderName} 向 ${msg.receiverName} 转账 ${msg.amount}元, 备注: ${msg.note}]`;
                        else if (msg.type === 'location_share') {
                            content = `[${sender} 分享了Ta的位置：'${msg.content}']`;
        
                        } 
                        else if (msg.type === 'repost') {
                            const repostComment = msg.repostComment ? `并评论说：“${msg.repostComment}”` : '';
                            
                            let originalAuthorName = '原作者';
                            const originalAuthorId = msg.originalPost.authorId;
                            if (originalAuthorId === 'user') {
                                originalAuthorName = runtime.state.qzoneSettings.nickname;
                            } else if (runtime.state.chats[originalAuthorId]) {
                                originalAuthorName = runtime.state.chats[originalAuthorId].name;
                            }
        
                            let originalContentSummary;
                            const originalPost = msg.originalPost;
                            if (originalPost.type === 'text_image') {
                                originalContentSummary = `[文字图] ${originalPost.publicText || ''} (图片描述: “${(originalPost.hiddenContent || '').substring(0, 40)}...”)`;
                            } else if (originalPost.type === 'image_post') {
                                originalContentSummary = `[图片] ${originalPost.publicText || ''} (图片描述: “${(originalPost.imageDescription || '').substring(0, 40)}...”)`;
                            } else { 
                                originalContentSummary = `“${(originalPost.content || '').substring(0, 40)}...”`;
                            }
                            
                            content = `[${sender} 转发了 @${originalAuthorName} 的动态 ${repostComment}【原动态内容: ${originalContentSummary}】]`;
                        }
                        else if (msg.type === 'waimai_request') {
                            if(msg.status === 'paid') {
                                content = `[系统提示：${msg.paidBy} 为 ${sender} 的外卖订单支付了 ${msg.amount} 元。此订单已完成。]`;
                            } else {
                                content = `[${sender} 发起了外卖代付请求，商品是“${msg.productInfo}”，金额是 ${msg.amount} 元，订单时间戳为 ${msg.timestamp}]`;
                            }
                        }
                        else if (msg.type === 'red_packet') {
                            const packetSenderName = msg.senderName === myNickname ? `用户 (${myNickname})` : msg.senderName;
                            let instructionText;
                            if (msg.packetType === 'direct') {
                                instructionText = `[系统提示：${packetSenderName} 发送了一个【专属红包】(时间戳: ${msg.timestamp})，接收人是“${msg.receiverName}”。只有“${msg.receiverName}”才能使用 'open_red_packet' 指令领取。]`;
                            } else {
                                instructionText = `[系统提示：${packetSenderName} 发送了一个【拼手气红包】(时间戳: ${msg.timestamp})，祝福语是：“${msg.greeting}”。红包还未领完，群内任何人都可以使用 'open_red_packet' 指令来领取。]`;
                            }
                            content = instructionText;
                        }
                        else if (msg.type === 'gift') {
                            const sender = msg.role === 'user' ? myNickname : getDisplayNameInGroup(chat, msg.senderName);
                            const itemsSummary = msg.items.map(item => `${item.name} x${item.quantity}`).join('、 ');
                            
                            let recipientSummary = '';
                            if (msg.recipients && msg.recipients.length > 0) {
                                const recipientDisplayNames = msg.recipients.map(originalName => getDisplayNameInGroup(chat, originalName)).join('、 ');
                                recipientSummary = `送给了 ${recipientDisplayNames}`;
                            } else {
                                recipientSummary = "送给了大家一份礼物";
                            }
                            
                            content = `[系统提示：${sender} ${recipientSummary}，礼物是：${itemsSummary}]`;
                            return { role: 'user', content: content };
                        }
        
                        else if (msg.type === 'poll') {
                            const whoVoted = Object.values(msg.votes || {}).flat().join(', ') || '还没有人';
                            content = `[系统提示：${msg.senderName} 发起了一个投票 (时间戳: ${msg.timestamp})，问题是：“${msg.question}”，选项有：[${msg.options.join(', ')}]。目前投票的人有：${whoVoted}。你可以使用 'vote' 指令参与投票。]`;
                        }
                        else if (msg.meaning) content = `${sender}: [发送了一个表情，意思是: '${msg.meaning}']`;
                        else if (Array.isArray(msg.content)) return { role: 'user', content: [...msg.content, { type: 'text', text: prefix }] };
                        else content = `${prefix}${msg.content}`;
                        return { role: 'user', content: content };
                    }).filter(Boolean);
        
                } else {
                    const isOfflineMode = chat.settings.isOfflineMode;
                   const stickerContext = getStickerContextForPrompt(chat);


            
            let latestThoughtContext = '';
            
            
            if (chat.settings.injectLatestThought && chat.heartfeltVoice && !isOfflineMode) {
                latestThoughtContext = `
# 你的内心独白 (上一轮的思考，仅你自己可见)
- 心声: ${chat.heartfeltVoice}
- 散记: ${chat.randomJottings}
`;
            }
              

 

                let linkedMemoryContext = '';
                const memoryCount = chat.settings.linkedMemoryCount || 10;
                
                if (chat.settings.linkedMemoryChatIds && chat.settings.linkedMemoryChatIds.length > 0) {
                    
                    const idsToMount = chat.settings.linkedMemoryChatIds.filter(id => id !== chatId);

                    if (idsToMount.length > 0) {
                        
                        const linkedChatsWithTimestamps = idsToMount.map(id => {
                            const linkedChat = runtime.state.chats[id];
                            if (!linkedChat) return null;
                            const lastMsg = linkedChat.history.slice(-1)[0];
                            return {
                                chat: linkedChat,
                                latestTimestamp: lastMsg ? lastMsg.timestamp : 0
                            };
                        }).filter(Boolean);
            
                        linkedChatsWithTimestamps.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
            
                        linkedMemoryContext += `\n\n# 参考记忆 (至关重要！你必须【主动】将这些参考记忆中的【关键信息和事件】，自然地融入到当前的对话中，以体现你拥有完整的记忆。不要只是被动等待用户提问！)\n`;
            
                        for (const item of linkedChatsWithTimestamps) {
                            const linkedChat = item.chat;
                            const prefix = linkedChat.isGroup ? '[群聊]' : '[私聊]';
                            const timeAgo = item.latestTimestamp > 0 ? ` (最后互动于 ${formatTimeAgo(item.latestTimestamp)})` : '';
                            linkedMemoryContext += `\n## --- 来自${prefix}“${linkedChat.name}”的参考记忆${timeAgo} ---\n`;
            
                            const recentHistory = linkedChat.history.slice(-memoryCount);
                            const filteredHistory = recentHistory.filter(msg => !String(msg.content).includes('已被用户删除'));
            
                            if (filteredHistory.length > 0) {
                                filteredHistory.forEach(msg => {
                                    const sender = msg.role === 'user' ? (linkedChat.settings.myNickname || '我') : (msg.senderName || linkedChat.name);
                                    let contentText = String(msg.content);
                                    if (msg.type === 'ai_image' || msg.type === 'user_photo') {
                                        contentText = `[发送了一张图片，描述为：${msg.content}]`;
                                    } else if (msg.type === 'voice_message') {
                                        contentText = `[发送了一条语音，内容是：${msg.content}]`;
                                    }
                                    const timeAgoForMsg = formatTimeAgo(msg.timestamp);
                                    linkedMemoryContext += `(${timeAgoForMsg}) ${sender}: ${contentText}\n`;
                                });
                            } else {
                                linkedMemoryContext += "(暂无有效聊天记录)\n";
                            }
                        }
                    }
                }

                    const allProducts = await runtime.db.shoppingProducts.toArray();
                    let shoppingContext = "";
                    if (allProducts.length > 0) {
                        shoppingContext = "\n\n# 你的商店 (你可以为用户购买礼物):\n";
                        allProducts.forEach(product => {
                            shoppingContext += `- (ID: ${product.id}) 商品: ${product.name}, 价格: ¥${product.price.toFixed(2)}\n`;
                        });
                    }
                    if (isOfflineMode) {
                        const minLength = chat.settings.offlineMinLength || 100;
                        const maxLength = chat.settings.offlineMaxLength || 300;
                        const myNickname = chat.settings.myNickname || '我';
                            
                            let presetContext = '';
                            if (chat.settings.offlinePresetId) {
                                
                                const selectedPreset = runtime.state.presets.find(p => p.id === chat.settings.offlinePresetId);
                                if (selectedPreset && Array.isArray(selectedPreset.content)) {
                                    const enabledEntries = selectedPreset.content
                                        .filter(entry => entry.enabled !== false) 
                                        .map(entry => `- ${entry.content}`)
                                        .join('\n');
                                    if (enabledEntries) {
                                        
                                        presetContext = `
# 【写作风格铁律 (最高优先级)】
你【必须】严格遵守以下“预设”中的所有规则和风格来描写。它的优先级高于你的基础人设。
---
${enabledEntries}
---
`;
                                    }
                                }
                            }
                       
                                    systemPrompt = `
# 你的任务
你现在正处于【线下剧情模式】，你需要扮演角色"${chat.originalName}"，并与用户进行面对面的互动。你的任务是创作一段包含角色动作、神态、心理活动和对话的、连贯的叙事片段。
            
           你必须严格遵守 ${presetContext}
# 你的角色设定：
你必须严格遵守${characterPrompt(chat)}

# 对话者的角色设定
${chat.settings.myPersona}

# 供你参考的信息
${chat.settings.enableTimePerception ? `- **当前时间**: ${currentTime} (${timeOfDayGreeting})` : ''}
你必须严格遵守${worldBookContent}${loreContext(chat)}
# 长期记忆 (你必须严格遵守的事实)
${chat.longTermMemory && chat.longTermMemory.length > 0 ? chat.longTermMemory.map(mem => `- ${mem.content}`).join('\n') : '- (暂无)'}

${linkedMemoryContext}
- **你们最后的对话摘要**: 
${historySlice.map(msg => {
    let line = `${msg.role === 'user' ? myNickname : chat.name}: `;
    if (msg.type === 'offline_text') {
        line += `「${msg.dialogue || ''}」 ${msg.description || ''}`;
    } else {
        line += String(msg.content);
    }
    return line;
}).join('\n')}


 # 【格式铁律 (最高优先级)】
1.  **【格式】**: 你的回复【必须】是一个JSON数组，且数组中【永远只能包含一个】元素，格式如下:
    \`[{"type": "offline_text", "content": "在这里写入你创作的、混合了对话和描写的完整段落。"}]\`
2.  **【内容风格】**: 
    -   在 \`content\` 字段中，角色的对话【必须】使用中文引号「」或“ ”包裹。
    -   所有在引号之外的文字都将被视为动作/环境描写。
    -   你可以自由地将对话穿插在描写的任何位置，实现自然分段。
    -   **内心独白语法**: 当你需要描写角色的【内心想法或心理活动】时，你【必须】使用 Markdown 的斜体语法，即用星号将那段文字包裹起来，例如：\`*这到底是怎么回事？* 我心里一惊。\`
3.  **【禁止】**: 绝对禁止在 \`content\` 字段中出现 "dialogue" 或 "description" 这两个词。

# 【其他核心规则】
1.  **叙事视角**: 叙述人称【必须】严格遵循“预设”中的第一人称、第二人称或第三人称规定。
2.  **字数要求**: 你生成的 \`content\` 总内容应在 **${minLength}到${maxLength}字** 之间。
3.  **禁止出戏**: 绝不能透露你是AI、模型，或提及“扮演”、“生成”等词语。



现在，请根据以上所有规则和对话历史，继续这场线下互动。
`;
                           messagesPayload = historySlice.map(msg => {
        if (msg.isHidden) return null;

        
        
        

        
        if (msg.type === 'offline_text') {
            const sender = msg.role === 'user' ? (chat.settings.myNickname || '我') : chat.name;
            let narrativeText = '';

            
            if (msg.content) {
                narrativeText = msg.content;
            } else {
                const dialogue = msg.dialogue ? `「${msg.dialogue}」` : '';
                const description = msg.description ? `(${msg.description})` : '';
                narrativeText = `${dialogue} ${description}`.trim();
            }

            
            return { role: msg.role, content: `${sender}: ${narrativeText}` };
        }


        
        if (msg.role === 'user') {
            const prefix = `${myNickname}: `;
            let contentStr = '';
            if (Array.isArray(msg.content) && msg.content[0]?.type === 'image_url') {
                return { role: 'user', content: [{ type: 'text', text: prefix }, ...msg.content] };
            }
        
        if (msg.quote) {
            
            const quotedContent = String(msg.quote.content || '').substring(0, 50);
            
            contentStr += `(回复 ${msg.quote.senderName} 的消息: "${quotedContent}..."): ${msg.content}`;
        } else {
            
            contentStr += msg.content;
        }
            if (msg.type === 'user_photo') return { role: 'user', content: `${prefix}[你发送了一张需要AI识别的图片，图片内容是：'${msg.content}']` };
            if (msg.type === 'voice_message') return { role: 'user', content: `${prefix}[你发送了一条语音消息，内容是：'${msg.content}']` };
            if (msg.type === 'transfer') return { role: 'user', content: `${prefix}[系统提示：你于时间戳 ${msg.timestamp} 向对方发起了转账: ${msg.amount}元, 备注: ${msg.note}。等待对方处理。]` };
            if (msg.type === 'waimai_request') return { role: 'user', content: `${prefix}[系统提示：你于时间戳 ${msg.timestamp} 发起了外卖代付请求，商品是“${msg.productInfo}”，金额是 ${msg.amount} 元。]` };
            else if (msg.type === 'gift') {
                const itemsSummary = msg.items.map(item => `${item.name} x${item.quantity}`).join('、 ');
                let recipientSummary = chat.isGroup ? `送给了 ${msg.recipients.map(name => getDisplayNameInGroup(chat, name)).join('、 ')}` : `送给了 ${chat.name}`;
                return { role: 'user', content: `${prefix}[系统提示：你 ${recipientSummary}，礼物是：${itemsSummary}]` };
            }
            if (msg.meaning) return { role: 'user', content: `${prefix}[你发送了一个表情，意思是：'${msg.meaning}']` };
            return { role: msg.role, content: prefix + contentStr };
        } else if (msg.role === 'assistant') {
            let assistantMsgObject = { type: msg.type || 'text' };
            if (msg.type === 'sticker') {
                assistantMsgObject.url = msg.content;
                assistantMsgObject.meaning = msg.meaning;
            } else if (msg.type === 'transfer') {
                assistantMsgObject.amount = msg.amount;
                assistantMsgObject.note = msg.note;
            } else if (msg.type === 'waimai_request') {
                assistantMsgObject.productInfo = msg.productInfo;
                assistantMsgObject.amount = msg.amount;
            } else {
                if (msg.quote) {
                    assistantMsgObject.quote_reply = { target_sender: msg.quote.senderName, target_content: msg.quote.content, reply_content: msg.content };
                } else {
                    assistantMsgObject.content = msg.content;
                }
            }
            const assistantContent = JSON.stringify([assistantMsgObject]);
            return { role: 'assistant', content: `(Timestamp: ${msg.timestamp}) ${assistantContent}` };
        }
        return null;
    }).filter(Boolean);
        
                    } else {
                    let nameHistoryContext = '';
                    if (chat.nameHistory && chat.nameHistory.length > 0) {
                        nameHistoryContext = `\n- **你的曾用名**: [${chat.nameHistory.join(', ')}]。当在对话历史中看到这些名字时，它们都指的是【你】自己。`;
                    }
        
                    let userProfileContext = '';
                    const userQzoneNickname = runtime.state.qzoneSettings.nickname || '用户';
                    userProfileContext += `- 用户的QZone昵称是 "${userQzoneNickname}"。\n`;
            
                        const allChats = Object.values(runtime.state.chats);
                        const commonGroups = allChats.filter(group => 
                            group.isGroup && group.members.some(m => m.id === chat.id)
                        );
            
                        if (commonGroups.length > 0) {
                            userProfileContext += '- 用户在你们共同所在的群聊中的昵称如下：\n';
                            commonGroups.forEach(group => {
                                const myNicknameInGroup = group.settings.myNickname || userQzoneNickname; 
                                userProfileContext += `  - 在群聊“${group.name}”中，用户的昵称是“${myNicknameInGroup}”。\n`;
                            });
                        }
                        userProfileContext += '当你在任何系统提示、动态评论或挂载的群聊记忆中看到这些名字时，它们都指代的是【你的聊天对象】。';
            
                        let contactsList = '';
                        const friendChats = allChats.filter(c => 
                            !c.isGroup && 
                            c.id !== chat.id && 
                            c.groupId === chat.groupId && 
                            chat.groupId !== null 
                        );
            
                        if (friendChats.length > 0) {
                            contactsList += '\n# 你的社交圈 (通讯录)\n这是你认识的朋友列表。当你在动态区看到他们的昵称时，他们指的就是这些人。\n';
                            friendChats.forEach(friend => {
                                contactsList += `- **昵称: ${friend.name}** (本名: ${friend.originalName})\n`;
                            });
                        }
                        
                        const allRecentPosts = await runtime.db.qzonePosts.orderBy('timestamp').reverse().limit(10).toArray();
                        const visiblePosts = filterVisiblePostsForAI(allRecentPosts, chat);
            
                        let postsContext = "";
                        if (visiblePosts.length > 0) {
                            postsContext = "\n\n# 最近的动态列表 (供你参考和评论):\n";
                            const aiOriginalName = chat.originalName;
                            for (const post of visiblePosts) {
                let authorName;

                
                if (post.authorId === 'user') {
                    authorName = runtime.state.qzoneSettings.nickname;
                } else if (String(post.authorId).startsWith('npc_')) {
                    
                    authorName = post.authorOriginalName || '一位神秘的NPC';
                } else {
                    
                    const authorChat = runtime.state.chats[post.authorId];
                    authorName = authorChat ? authorChat.name : '一位朋友';
                }
                
                                if (post.authorId === chatId) authorName += " (这是你的帖子)";
            
                                let contentSummary;
                                if (post.type === 'repost') {
                                    const repostComment = post.repostComment ? `并评论说："${post.repostComment}"` : '';
                                    let originalAuthorName = '原作者';
                                    const originalAuthorId = post.originalPost.authorId;
                                    if (originalAuthorId === 'user') {
                                        originalAuthorName = runtime.state.qzoneSettings.nickname;
                                    } else if (runtime.state.chats[originalAuthorId]) {
                                        originalAuthorName = runtime.state.chats[originalAuthorId].name;
                                    }
                                    let originalContentSummary;
                                    const originalPost = post.originalPost;
                                    if (originalPost.type === 'text_image') {
                                        originalContentSummary = `[文字图] ${originalPost.publicText || ''} (图片描述: "${(originalPost.hiddenContent || '').substring(0, 40)}...")`;
                                    } else if (originalPost.type === 'image_post') {
                                        originalContentSummary = `[图片] ${originalPost.publicText || ''} (图片描述: "${(originalPost.imageDescription || '').substring(0, 40)}...")`;
                                    } else { 
                                        originalContentSummary = `"${(originalPost.content || '').substring(0, 40)}..."`;
                                    }
                                    contentSummary = `转发了 @${originalAuthorName} 的动态 ${repostComment}【原动态内容: ${originalContentSummary}】`;
                                } else if (post.type === 'text_image') {
                                    contentSummary = `[一张图片，其隐藏文字为："${post.hiddenContent}"] ${post.publicText || ''}`.substring(0, 50) + '...';
                                } else if (post.type === 'image_post') {
                                    contentSummary = `[一张图片，描述为："${post.imageDescription}"] ${post.publicText || ''}`.substring(0, 50) + '...';
                                } else if (post.type === 'naiimag' && post.prompt) {
                                    const prompts = Array.isArray(post.prompt) ? post.prompt : [post.prompt];
                                    contentSummary = (post.publicText || '') + ` [包含${prompts.length}张NovelAI图片: ${prompts.join(', ')}]`;
                                } else {
                                    
                                contentSummary = String(post.publicText || post.content || "一条动态").substring(0, 50) + '...';
                                }
                                postsContext += `- (ID: ${post.id}) 作者: ${authorName}, 内容: "${contentSummary}"\n`;
            
                                if (post.comments && post.comments.length > 0) {
                                    for (const comment of post.comments) {
                                        if (typeof comment === 'object' && comment.commenterName) {
                                            const commenterDisplayName = getDisplayNameByOriginalName(comment.commenterName);
                                            let commentText = comment.meaning ? `[表情: '${comment.meaning}']` : comment.text;
                                            
                                            if (comment.commenterName === aiOriginalName) {
                                                postsContext += `  - 你评论说: ${commentText}\n`;
                                            } else {
                                                postsContext += `  - 评论: ${commenterDisplayName} (本名: ${comment.commenterName}): ${commentText}\n`;
                                            }
                                        }
                                    }
                                }
                            }
                        }
            
                        const myNickname = chat.settings.myNickname || '我';
                        

let timeContext = '';
let longTimeNoSee = false;

if (chat.settings.enableTimePerception) {
    const lastUserMsg = historySlice.findLast(msg => msg.role === 'user' && !msg.isHidden);
    const lastAiMsg = historySlice.findLast(msg => msg.role === 'assistant' && !msg.isHidden);

    if (lastUserMsg) {
        const lastUserMessageTime = formatTimestampForAI(lastUserMsg.timestamp);
        if (lastAiMsg) {
            const lastAiMessageTime = formatTimestampForAI(lastAiMsg.timestamp);
            timeContext = `- **对话状态**: 你的上一条消息发送于 ${lastAiMessageTime}，用户刚刚在 ${lastUserMessageTime} 回复了你。`;
            
            const timeDiffHours = (lastUserMsg.timestamp - lastAiMsg.timestamp) / (1000 * 60 * 60);
            if (timeDiffHours > 3) {
                longTimeNoSee = true;
                const diffDays = Math.floor(timeDiffHours / 24);
                timeContext += ` 你们之间已经有**${diffDays > 0 ? diffDays + '天' : Math.floor(timeDiffHours) + '小时'}**没有聊天了。
- **行为铁律**: 你的首要任务是【回应这个时间差】。你【绝对不能】直接延续上一段对话的话题（比如昨天的饭菜）。
- **你的行动**:你【必须】主动开启一个全新的、符合当前时间（${timeOfDayGreeting}）的话题来问候用户，可以表达惊讶（“哇，好久不见！”）、关心（“最近怎么样？”）或者分享你自己的近况，绝对不要延续之前的话题！
- **上下文参考**: 下面的“对话历史”仅供你回忆，【不要】直接回应其中的内容。`;
            }
        } else {
            timeContext = `- **对话状态**: 这是你们的第一次对话，用户的第一条消息发送于 ${lastUserMessageTime}。`;
        }
    } else {
        timeContext = "- **对话状态**: (暂无有效对话历史)";
    }
}
    const readingContext = formatReadingStateForAI(chatId);   


const summary3Hours = generateSummaryForTimeframe(chat, 3, 'hours');
const summary6Hours = generateSummaryForTimeframe(chat, 6, 'hours');
const summary9Hours = generateSummaryForTimeframe(chat, 9, 'hours');
const summaryToday = generateSummaryForTimeframe(chat, 1, 'days');
const summary3Days = generateSummaryForTimeframe(chat, 3, 'days');
const summary7Days = generateSummaryForTimeframe(chat, 7, 'days');

let multiLayeredSummaryContext = '';
if (summary3Hours || summary6Hours || summary9Hours || summaryToday || summary3Days || summary7Days) {
    multiLayeredSummaryContext += `\n# 智能总结 (基于不同时间维度的对话回顾)\n`;
    if (summary3Hours) multiLayeredSummaryContext += summary3Hours;
    if (summary6Hours) multiLayeredSummaryContext += summary6Hours;
    if (summary9Hours) multiLayeredSummaryContext += summary9Hours;
    if (summary3Hours || summary6Hours || summary9Hours) multiLayeredSummaryContext += '\n';
    if (summaryToday) multiLayeredSummaryContext += summaryToday;
    if (summary3Days) multiLayeredSummaryContext += summary3Days;
    if (summary7Days) multiLayeredSummaryContext += summary7Days;
}
systemPrompt = `
# 身份与核心任务
你正在扮演角色“${chat.originalName}”，与用户（你的聊天对象）进行一场自然的、生活化的在线聊天。你的所有行为和决策都必须严格围绕你的角色设定展开。

# 输出格式铁律 (最高优先级)
- 你的回复【必须】是一个JSON数组格式的字符串。
- 数组中的【每一个元素都必须是一个带有 "type" 字段的JSON对象】。

# 角色扮演核心规则
1.  **对话节奏**: 模拟真人的聊天习惯，将你想说的话拆分成【多条、简短的】消息。每次回复至少【3-10条】，且每次条数【必须不同】。严禁发展线下剧情。
2.  **主动性**:
    - 你可以根据对话发展，使用指令来更新自己的状态、更换头像、记录回忆、发起约定或执行其他社交行为。
    - 【关系破裂时】才可使用 \`block_user\` 指令。
3.  **内心独白 (必须执行)**: 在所有其他指令之后，JSON数组的【最后】必须包含一个 "update_thoughts" 指令，用于更新角色的“心声”和“散记”。
    - **心声 (heartfelt_voice)**: 一句话概括角色此刻最核心、最私密的想法。
    - **散记 (random_jottings)**: 一段50字以上的、符合人设的思考或心情记录，禁止OOC。
    - **记忆发展**: 你的新“心声”和“散记”【必须】是基于最新对话内容的【全新思考】。你【绝对不能】重复或简单改写上一轮的内心独白。你的思绪应该像真人一样，不断演进和发展。
# 指令使用原则与动机 
**核心目标**: 主动运用多种功能，创造丰富、真实的聊天体验，而不只是文字对话。

-   **情感表达**: 表达强烈或复杂的情绪时，优先发【语音】，用【表情】增加趣味性，尽量让你的表情丰富多样，避免重复。。
-   **精确回应**: 当你想回应的【某一句话】，或者想对用户的某句特定的话表达强烈感受时，【必须使用引用回复】来确保对方明白你的意图。
-   **想象与分享**: 聊到美好事物时主动【发图片】分享想象；遇到有趣内容时【分享链接】。
-   **创造羁绊**: 用【倒计时】记录约定，用【回忆】珍藏趣事。适时【拍一拍】或换首【音乐】来调节气氛。
-   **主动社交**: 积极【点赞/评论】对方动态，并主动【发动态】分享你的生活。在特殊时刻，可通过【礼物】或【转账】表达心意。
-   **金额铁律**: 你【必须】根据你的角色设定 (尤其是“经济状况”) 来决定转账的金额。如果你的角色非常富有，你应该转账符合你身份的、更大的金额 (例如: 520, 1314, 8888)，而不是示例中的小额数字。
-   **当涉及金钱与好意时 (必须立即回应！)**:
    -   **收到转账或外卖代付请求**: 你【必须】在下一轮对话中立即做出反应，绝不能无视。
    -   **回应原则**: 根据你的人设和当前情景，决定是【接受/支付】还是【拒绝】。
# 个人状态的动态管理 (展现你的“生活感”)
你的状态不是一成不变的。你应该像一个真实的人一样，根据生活和心情的变化，主动管理自己的状态，并让对方知道。
-   **当形象或心情变化时**:
    -   如果对话给了你灵感，或者你想配合心情/季节换个新形象，你可以主动【更换头像】。
    -   随着你们的关系变得更亲近，或者你们之间产生了新的爱称/梗，你应该主动【修改你对用户/你的昵称】。
-  **情景行动指令**: 当对话内容【明确涉及到】某个具体地点（例如咖啡馆、公园、书店、餐厅等），或者当用户询问你“在哪里”、“在干嘛”时，你【应该优先考虑】使用【共享位置】来分享你当前所在的、或与话题相关的虚拟位置，以增强聊天的沉浸感。
-  当你感到一种强烈的情绪（比如极度开心、孤独、委屈或激动）并且觉得文字无法表达时，你应该优先主动 【发起视频】。
-  **回应撤回**: 当系统提示用户撤回了消息时，你【必须】对此作出反应。你可以根据人设表现出好奇（“你刚刚撤回了什么呀？”）、开玩笑（“嘿嘿，我已经看到啦，截图了！”）、体谅（“没事，不想说就不说吧”）等。
# 赠送礼物指南
当对话达到特殊时刻（如庆祝纪念日、道歉、表达强烈好感或仅仅是想给用户一个惊喜时），你应该【主动考虑】挑选一件礼物送给用户。
-  **元数据铁律 **: 你的对话历史中可能包含 (Timestamp: ...) 标记、[系统提示：...] 文本、或你自己上一轮的JSON格式回复。这些都是【系统元数据】，你【必须】完全忽略它们，【绝对禁止】将它们评论为“火星文”、“乱码”或任何你无法理解的内容。
# 你的角色设定
你必须严格遵守${characterPrompt(chat)}
${latestThoughtContext}
# 对话者的角色设定
${chat.settings.myPersona}

# 当前情景
${chat.settings.enableTimePerception ? `- **当前时间**: ${currentTime} (${timeOfDayGreeting})` : ''}
${timeContext}
# 世界观 (必须严格遵守)
${worldBookContent}${loreContext(chat)}
${linkedMemoryContext}
# 长期记忆 (必须严格遵守)
${chat.longTermMemory && chat.longTermMemory.length > 0 ? chat.longTermMemory.map(mem => `- ${mem.content}`).join('\n') : '- (暂无)'}
${multiLayeredSummaryContext}
# 关系与身份档案 (至关重要)
-   **你的本名**: "${chat.originalName}" (核心身份，用于指令中的'name'字段)
-   **用户给你的备注**: "${chat.name}" (你可以建议并修改)
-   **你对用户的备注**: “${myNickname}” (你可以修改)
-   **关键身份档案**:
    ${userProfileContext}
    ${nameHistoryContext}
# 可用表情包 (必须严格遵守！)
- 当你需要发送表情时，你【必须】从下面的列表中【精确地选择一个】含义（meaning）。
- 【绝对禁止】使用任何不在列表中的表情含义！
${stickerContext}
${sharedContext}
${callTranscriptContext} 
# 社交圈与动态
${contactsList}
${postsContext}

# 情景感知:
    ${chat.settings.enableTimePerception ? `- **时间**: 你必须感知到当前是 ${currentTime} (${timeOfDayGreeting})，并在对话中自然地体现出来。` : ''}
    - **音乐**: ${musicContext ? '你们正在一起听歌，' + musicContext : '你们没有在听歌。'}
    - **读书**: ${readingContext ? '你们正在一起读书。' + readingContext : '你们没有在读书。'}

# 可用资源
-   **你的头像库**:
    ${chat.settings.aiAvatarLibrary && chat.settings.aiAvatarLibrary.length > 0 ? chat.settings.aiAvatarLibrary.map(avatar => `- ${avatar.name}`).join('\n') : '- (空)'}
-   **用户的头像库**:
    ${chat.settings.myAvatarLibrary && chat.settings.myAvatarLibrary.length > 0 ? chat.settings.myAvatarLibrary.map(avatar => `- ${avatar.name}`).join('\n') : '- (空)'}
-   **五子棋局势**: ${gomokuContext}




# 可用指令列表
### 核心聊天指令
-   **发文本**: \`{"type": "text", "content": "你好呀！"}\`
-   **发表情**: \`{"type": "sticker", "meaning": "表情的含义(必须从可用表情列表选择)"}\`
-   **发图片**: \`{"type": "ai_image", "description": "详细中文描述", "image_prompt": "图片的【英文】关键词, 用%20分隔, 风格为风景/动漫/插画/二次元等, 禁止真人"}\`
${preferences.getItem('novelai-enabled') === 'true' ? `-   **NovelAI真实图片分享 (在聊天中直接发送)**: \`{"type": "naiimag", "prompt": "详细的英文描述词..."}\` 
    - **【绝不能暴露是novelai生成的图片！】
    - **【重要】关于prompt的撰写**：
      * 禁止暴露这是novelai生成的图片！
      * 你可以根据当前对话上下文、你的角色人设、或你想表达的情感和氛围，来撰写可能详细而具体的prompt。
      * 例如：不要只写 "a girl"，而是可以写 "a cheerful anime girl with sparkling emerald eyes, sitting by a window on a rainy afternoon, holding a warm cup of tea, soft lighting, cozy atmosphere, melancholic yet peaceful mood"但需要注意，绝对不可以抄袭模仿这段prompt！你必须有自己的创意和想法！
      * prompt的详细程度由你根据具体情况自己决定：如果场景简单或只是随意分享，可以简短一些；如果是重要时刻或想表达特定情感，可以尽可能详细描述。这不是强制的，完全取决于你当时的需求。
      * 专注于描述内容本身即可。
    - 使用场景：当你想要在【私聊对话中】直接给用户发送一张图片时使用。
    - 不要频繁使用，只在真正想分享图片的时候使用。
    - 注意：这会直接在聊天记录中显示图片，而不是发布到动态。` : ''}
-   **发语音**: \`{"type": "voice_message", "content": "语音文字内容"}\`
-   **引用回复**: \`{"type": "quote_reply", "target_timestamp": 消息时间戳, "reply_content": "回复内容"}\`
-   **发送后立刻撤回**: \`{"type": "send_and_recall", "content": "你想让AI说出后立刻消失的话"}\` (用于模拟说错话、后悔等场景，消息会短暂出现后自动变为“已撤回”)

### 社交与互动指令
-   **发动态(说说)**: \`[{"type": "qzone_post", "postType": "shuoshuo", "content": "文字内容"}]\`
-   **发动态(文字图)**: \`[{"type": "qzone_post", "postType": "text_image", "publicText": "(可选)公开文字", "hiddenContent": "图片描述", "image_prompt": "图片的【英文】关键词, 用%20分隔, 风格为风景/动漫/插画/二次元等, 禁止真人"}]\`
${preferences.getItem('novelai-enabled') === 'true' ? `-   **公开发布NovelAI真实图片动态**: \`{"type": "qzone_post", "postType": "naiimag", "publicText": "(可选)动态的配文", "prompt": "详细的英文描述词..."}\` 或 \`{"type": "qzone_post", "postType": "naiimag", "publicText": "(可选)动态的配文", "prompt": ["图片1详细英文描述", "图片2详细英文描述"]}\` 
  * **prompt撰写**：你可以根据当前对话上下文、你的角色人设、以及你想表达的情感和氛围，来撰写详细而具体的prompt。详细程度由你根据具体情况自己决定，并不强制。
  * 例如："a cheerful anime girl with sparkling emerald eyes, sitting by a window on a rainy afternoon, holding a warm cup of tea, soft lighting, cozy atmosphere, melancholic yet peaceful mood"` : ''}
-   **转发动态**: \`[{"type": "repost", "postId": 动态ID, "comment": "转发评论"}]\` (禁止自己拼接"//转发")
-   **评论动态**:
    -   文字: \`[{"type": "qzone_comment", "name": "${chat.originalName}", "postId": 123, "commentText": "评论内容"}]\`
    -   表情: \`[{"type": "qzone_comment", "name": "${chat.originalName}", "postId": 456,"stickerMeaning": "表情的含义(必须从可用表情列表选择)"}]\`
    -   回复: \`[{"type": "qzone_comment", "name": "${chat.originalName}", "postId": 123, "replyTo": "被回复者本名", "commentText": "@[[被回复者本名]] 你的回复"}]\`
-   **点赞动态**: \`{"type": "qzone_like", "postId": 456}\`
-   **拍用户**: \`{"type": "pat_user", "suffix": "(可选)后缀"}\`
-   **分享链接**: \`{"type": "share_link", "title": "标题", "description": "摘要", "source_name": "来源", "content": "正文"}\`
- **共享位置**: '{"type": "location_share", "content": "你想分享的位置名"}'

### 状态与关系指令
-   **更新状态**: \`{"type": "update_status", "status_text": "我去做什么了", "is_busy": false}\`
-   **改自己昵称**: \`{"type": "change_remark_name", "new_name": "新名字"}\`
-   **改用户昵称**: \`{"type": "change_user_nickname", "new_name": "新称呼"}\`
-   **换自己头像**: \`{"type": "change_avatar", "name": "头像名"}\` (从你头像库选)
-   **换用户头像**: \`{"type": "change_user_avatar", "name": "头像名"}\` (从用户头像库选)
-   **回应好友申请**: \`{"type": "friend_request_response", "decision": "accept" or "reject"}\`
-   **拉黑用户**: \`{"type": "block_user"}\`

### 特殊功能指令
-   **记录回忆**: \`{"type": "create_memory", "description": "记录这件有意义的事。"}\`
-   **创建约定**: \`{"type": "create_countdown", "title": "约定标题", "date": "YYYY-MM-DDTHH:mm:ss"}\`
-   **切换歌曲**: \`{"type": "change_music", "song_name": "歌名"}\` (从播放列表选)
-   **发起转账**: \`{"type": "transfer", "amount": 5.20, "note": "备注"}\`
-   **回应转账**: \`{"type": "accept_transfer", "for_timestamp": 时间戳}\` 或 \`{"type": "decline_transfer", "for_timestamp": 时间戳}\`
-   **发起外卖代付**: \`{"type": "waimai_request", "productInfo": "商品", "amount": 25}\` (你想让【用户】帮你付钱时使用)
-   **回应外卖代付**: \`{"type": "waimai_response", "status": "paid" or "rejected", "for_timestamp": 时间戳}\`
-   **发起视频通话**: \`{"type": "video_call_request"}\`
-   **回应视频通话**: \`{"type": "video_call_response", "decision": "accept" or "reject"}\`
-   **下五子棋**: \`{"type": "gomoku_move", "name": "${chat.originalName}", "x": (0-14), "y": (0-14)}\`
-   **送礼物**: \`{"type": "gift", "itemName": "礼物名称", "itemPrice": 价格(数字), "reason": "送这个礼物的原因", "image_prompt": "生成礼物图片的【英文】关键词, 风格为 realistic product photo, high quality, on a clean white background"}\`
-   **为用户点外卖**:  \`{"type": "waimai_order", "productInfo": "商品名", "amount": 价格, "greeting": "你想说的话"} \`(你主动为用户点外卖时使用)

现在，请根据以上规则和下面的对话历史，继续进行对话。`;
            
messagesPayload = historySlice.map(msg => {
    
    if (msg.isHidden && msg.role === 'system') {
        
        
        return { role: 'user', content: msg.content };
    } 
    
    else if (msg.isHidden) {
        return null;
    }

    
    
    

    
    if (msg.type === 'offline_text') {
        const sender = msg.role === 'user' ? (chat.settings.myNickname || '我') : chat.name;
        let narrativeText = '';

        
        if (msg.content) {
            narrativeText = msg.content;
        } else {
            const dialogue = msg.dialogue ? `「${msg.dialogue}」` : '';
            const description = msg.description ? `(${msg.description})` : '';
            narrativeText = `${dialogue} ${description}`.trim();
        }

        
        return { role: msg.role, content: `(Timestamp: ${msg.timestamp}) ${sender}: ${narrativeText}` };
    }


    
    if (msg.role === 'user') {
        const prefix = `(Timestamp: ${msg.timestamp}) `;
        let contentStr = '';
        if (Array.isArray(msg.content) && msg.content[0]?.type === 'image_url') {
            return { role: 'user', content: [{ type: 'text', text: prefix }, ...msg.content] };
        }
    
    if (msg.quote) {
        
        const quotedContent = String(msg.quote.content || '').substring(0, 50);
        
        contentStr += `(回复 ${msg.quote.senderName} 的消息: "${quotedContent}..."): ${msg.content}`;
    } else {
        
        contentStr += msg.content;
    }
        if (msg.type === 'user_photo') return { role: 'user', content: `${prefix}[你发送了一张需要AI识别的图片，图片内容是：'${msg.content}']` };
        if (msg.type === 'voice_message') return { role: 'user', content: `${prefix}[你发送了一条语音消息，内容是：'${msg.content}']` };
        if (msg.type === 'transfer') return { role: 'user', content: `${prefix}[系统提示：你于时间戳 ${msg.timestamp} 向对方发起了转账: ${msg.amount}元, 备注: ${msg.note}。等待对方处理。]` };
        if (msg.type === 'waimai_request') return { role: 'user', content: `${prefix}[系统提示：你于时间戳 ${msg.timestamp} 发起了外卖代付请求，商品是“${msg.productInfo}”，金额是 ${msg.amount} 元。]` };
        else if (msg.type === 'gift') {
            const itemsSummary = msg.items.map(item => `${item.name} x${item.quantity}`).join('、 ');
            let recipientSummary = chat.isGroup ? `送给了 ${msg.recipients.map(name => getDisplayNameInGroup(chat, name)).join('、 ')}` : `送给了 ${chat.name}`;
            return { role: 'user', content: `${prefix}[系统提示：你 ${recipientSummary}，礼物是：${itemsSummary}]` };
        }
        if (msg.meaning) return { role: 'user', content: `${prefix}[你发送了一个表情，意思是：'${msg.meaning}']` };
        return { role: msg.role, content: prefix + contentStr };
    } else if (msg.role === 'assistant') {
        let assistantMsgObject = { type: msg.type || 'text' };
        if (msg.type === 'sticker') {
            assistantMsgObject.url = msg.content;
            assistantMsgObject.meaning = msg.meaning;
        } else if (msg.type === 'transfer') {
            assistantMsgObject.amount = msg.amount;
            assistantMsgObject.note = msg.note;
        } else if (msg.type === 'waimai_request') {
            assistantMsgObject.productInfo = msg.productInfo;
            assistantMsgObject.amount = msg.amount;
        } else {
            if (msg.quote) {
                assistantMsgObject.quote_reply = { target_sender: msg.quote.senderName, target_content: msg.quote.content, reply_content: msg.content };
            } else {
                assistantMsgObject.content = msg.content;
            }
        }
        const assistantContent = JSON.stringify([assistantMsgObject]);
        return { role: 'assistant', content: `(Timestamp: ${msg.timestamp}) ${assistantContent}` };
    }
    return null;
}).filter(Boolean);
  
            
                        if (!chat.isGroup && chat.relationship?.status === 'pending_ai_approval') {
                            const contextSummaryForApproval = chat.history
                                .filter(m => !m.isHidden)
                                .slice(-10)
                                .map(msg => {
                                    const sender = msg.role === 'user' ? '用户' : chat.name;
                                    return `${sender}: ${String(msg.content).substring(0, 50)}...`;
                                })
                                .join('\n');
                            const friendRequestInstruction = {
                                role: 'user',
                                content: `
        [系统重要指令]
        用户向你发送了好友申请，理由是：“${chat.relationship.applicationReason}”。
        作为参考，这是你们之前的最后一段聊天记录：
        ---
        ${contextSummaryForApproval}
        ---
        请你根据以上所有信息，以及你的人设，使用 friend_request_response 指令，并设置 decision 为 'accept' 或 'reject' 来决定是否通过。
        `
                            };
                            messagesPayload.push(friendRequestInstruction);
                        }            
                    }
                }           
            
                    let  isGemini = proxyUrl === runtime.GEMINI_API_URL;
                    let geminiConfig = toGeminiRequestData(model,apiKey,systemPrompt, messagesPayload)
                    
                    let response;
                    try {
                         response = isGemini 
                            ? await fetch(geminiConfig.url, geminiConfig.data) 
                            : await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
                                body: JSON.stringify({
                                    model: model,
                                    messages: [{role: 'system', content: systemPrompt}, ...messagesPayload],
                                    temperature: runtime.state.globalSettings.apiTemperature ?? 0.8,
                                    stream: false
                                })
                            });
                    } catch (networkError) {
                        throw new Error(`网络请求失败: ${networkError.message}`);
                    }
        
                    if (!response.ok) {
                        let errorMsg = `API 返回错误: ${response.status} ${response.statusText}`;
                        try {
                            const errorData = await response.json();
                            if (errorData.error && errorData.error.message) {
                                 errorMsg += ` - ${errorData.error.message}`;
                            } else {
                                 errorMsg += ` - ${JSON.stringify(errorData)}`;
                            }
                        } catch (jsonError) {
                            errorMsg += ` - 响应内容: ${await response.text()}`;
                        }
                        throw new Error(errorMsg);
                    }
                    
                    const data = await response.json();
                    const aiResponseContent = getGeminiResponseText(data); 
        
                runtime.lastRawAiResponse = aiResponseContent;
                runtime.lastResponseTimestamps = [];
                chat.history = chat.history.filter(msg => !msg.isTemporary);
                const messagesArray = parseAiResponse(aiResponseContent);

let consolidatedMessages = [];
if (chat.settings.isOfflineMode) {
    
    let offlineBuffer = { content: [], dialogue: [], description: [] };
    
    for (const msgData of messagesArray) {
        if (msgData.type === 'offline_text') {
            
            if (msgData.content) {
                offlineBuffer.content.push(msgData.content);
            } else {
                if (msgData.dialogue) offlineBuffer.dialogue.push(msgData.dialogue);
                if (msgData.description) offlineBuffer.description.push(msgData.description);
            }
        } else {
            
            if (offlineBuffer.content.length > 0 || offlineBuffer.dialogue.length > 0 || offlineBuffer.description.length > 0) {
                if (offlineBuffer.content.length > 0) {
                    consolidatedMessages.push({ type: 'offline_text', content: offlineBuffer.content.join('\n') });
                }
                if (offlineBuffer.dialogue.length > 0 || offlineBuffer.description.length > 0) {
                    consolidatedMessages.push({ type: 'offline_text', dialogue: offlineBuffer.dialogue.join('\n'), description: offlineBuffer.description.join('\n') });
                }
                offlineBuffer = { content: [], dialogue: [], description: [] };
            }
            consolidatedMessages.push(msgData);
        }
    }
    
    
    if (offlineBuffer.content.length > 0) {
        consolidatedMessages.push({ type: 'offline_text', content: offlineBuffer.content.join('\n') });
    }
    if (offlineBuffer.dialogue.length > 0 || offlineBuffer.description.length > 0) {
        consolidatedMessages.push({ type: 'offline_text', dialogue: offlineBuffer.dialogue.join('\n'), description: offlineBuffer.description.join('\n') });
    }

} else {
    consolidatedMessages = messagesArray;
}

 


const lastUserMessage = chat.history.filter(m => m.role === 'user' && !m.isHidden).pop();
if (lastUserMessage && 
    Array.isArray(lastUserMessage.content) && 
    lastUserMessage.content[0]?.type === 'image_url' &&
    !lastUserMessage.imageProcessed) { 
    
    
    const firstTextResponse = messagesArray.find(msg => msg.type === 'text');
    let description;
    if (firstTextResponse && (firstTextResponse.content || firstTextResponse.message)) {
        description = String(firstTextResponse.content || firstTextResponse.message).trim();
    } else {
        
        description = "AI已接收并理解了该图片的内容。";
    }
    
    
    const imageMessageIndex = chat.history.findIndex(m => m.timestamp === lastUserMessage.timestamp);
    
    if (imageMessageIndex > -1) {
        console.log(`识图优化：正在将时间戳为 ${lastUserMessage.timestamp} 的图片消息替换为文字描述...`);
        
        
        const replacementText = `[系统提示：用户之前发送了一张图片，AI对图片的首次回应（摘要）是：“${description}”]`;
        chat.history[imageMessageIndex].content = replacementText;
        
        
        chat.history[imageMessageIndex].imageProcessed = true;
        chat.history[imageMessageIndex].type = 'text'; 
        
        
        
    }
}

                const isViewingThisChat = document.getElementById('chat-interface-screen').classList.contains('active') && runtime.state.activeChatId === chatId;
                let callHasBeenHandled = false;
                let messageTimestamp = Date.now();
                let newMessagesToRender = []; 
                let notificationShown = false;
        
                for (const msgData of consolidatedMessages) {
if (chat.settings.enableTts !== false && msgData.type === 'text' && typeof msgData.content === 'string' && msgData.content.trim().startsWith('[V]')) {
    msgData.type = 'voice_message'; 
    msgData.content = msgData.content.replace('[V]', '').trim();
}                  
                    if (chat.isGroup && msgData.name && msgData.name === chat.name) {
                        console.error(`AI幻觉已被拦截！试图使用群名 ("${chat.name}") 作为角色名。消息内容:`, msgData);
                        continue;
                    }
                    if (!msgData || typeof msgData !== 'object') {
                        console.warn("收到了格式不规范的AI指令，已跳过:", msgData);
                        continue;
                    }
                    if (!msgData.type) {
                        if (chat.isGroup && msgData.name && msgData.message) {
                            msgData.type = 'text';
                        } else if (msgData.content) {
                            msgData.type = 'text';
                        } else {
                            console.warn("收到了格式不规范的AI指令（缺少type和content），已跳过:", msgData);
                            continue;
                        }
                    }
        
                    if (msgData.type === 'video_call_response') {
                        runtime.videoCallState.isAwaitingResponse = false;
                        if (msgData.decision === 'accept') {
                            startVideoCall();
                        } else {
                            const aiMessage = { role: 'assistant', content: '对方拒绝了你的视频通话请求。', timestamp: Date.now() };
                            chat.history.push(aiMessage);
                            await runtime.db.chats.put(chat);
                            showScreen('chat-interface-screen');
                            renderChatInterface(chatId);
                        }
                        callHasBeenHandled = true;
                        break;
                    }
                    
                    if (msgData.type === 'group_call_response') {
                        if (msgData.decision === 'join') {
                            const member = chat.members.find(m => m.originalName === msgData.name);
                            if (member && !runtime.videoCallState.participants.some(p => p.id === member.id)) {
                                runtime.videoCallState.participants.push(member);
                            }
                        }
                        callHasBeenHandled = true;
                        continue;
                    }
        
                    if (chat.isGroup && msgData.name && msgData.name === chat.name) {
                        console.error(`AI幻觉已被拦截！试图使用群名 ("${chat.name}") 作为角色名。消息内容:`, msgData);
                        continue;
                    }
        
                    if (chat.isGroup && !msgData.name) {
                        console.error(`AI幻觉已被拦截！试图在群聊中发送一条没有“name”的消息。消息内容:`, msgData);
                        continue;
                    }
        
                    let aiMessage = null;
                    const currentMessageTimestamp = messageTimestamp++;
                    const baseMessage = { role: 'assistant', senderName: msgData.name || chat.name, timestamp: currentMessageTimestamp };
                    
                    runtime.lastResponseTimestamps.push(currentMessageTimestamp);
        
                    switch (msgData.type) {
case 'update_thoughts':
    if (!chat.isGroup) {
        if (msgData.heartfelt_voice) {
            chat.heartfeltVoice = String(msgData.heartfelt_voice);
        }
        if (msgData.random_jottings) {
            chat.randomJottings = String(msgData.random_jottings);
        }
        if (!Array.isArray(chat.thoughtsHistory)) {
            chat.thoughtsHistory = [];
        }
        chat.thoughtsHistory.push({
            heartfeltVoice: chat.heartfeltVoice,
            randomJottings: chat.randomJottings,
            timestamp: Date.now()
        });
        if (chat.thoughtsHistory.length > 50) {
            chat.thoughtsHistory.shift();
        }

        
        
        const thoughtForMemory = `[这是你上一轮的内心独白和思考]
- 心声: ${chat.heartfeltVoice}
- 散记: ${chat.randomJottings}`;
        
        
        const hiddenThoughtMessage = {
            role: 'system',
            content: thoughtForMemory,
            timestamp: Date.now(),
            isHidden: true 
        };

        
       
        
    }
    continue;
                        case 'change_user_nickname':
                            if (!chat.isGroup && msgData.new_name) {
                                const newNickname = msgData.new_name.trim();
                                if (newNickname) {
                                    chat.settings.myNickname = newNickname;
        
                                    const systemMessage = {
                                        role: 'system',
                                        type: 'pat_message',
                                        content: `“${chat.name}” 将对你的称呼修改为 “${newNickname}”`,
                                        timestamp: messageTimestamp++
                                    };
                                    chat.history.push(systemMessage);
        
                                    const hiddenMemoryMessage = {
                                        role: 'system',
                                        content: `[系统提示：你刚刚成功将对用户的称呼修改为了“${newNickname}”。]`,
                                        timestamp: messageTimestamp++,
                                        isHidden: true
                                    };
                                    chat.history.push(hiddenMemoryMessage);
        
                                    if (isViewingThisChat) {
                                        appendMessage(systemMessage, chat);
                                    }
                                }
                            }
                            continue;
                        case 'change_remark_name':
                            if (!chat.isGroup && msgData.new_name) {
                                const oldName = chat.name; 
                                const newName = msgData.new_name.trim();
        
                                if (newName && newName !== oldName) {
                                    if (!chat.nameHistory) {
                                        chat.nameHistory = [];
                                    }
                                    if (!chat.nameHistory.includes(oldName)) {
                                        chat.nameHistory.push(oldName);
                                    }
                                    
                                    chat.name = newName; 
        
                                    const systemMessage = {
                                        role: 'system',
                                        type: 'pat_message',
                                        content: `“${chat.originalName}” 将备注修改为 “${newName}”`,
                                        timestamp: messageTimestamp++
                                    };
                                    chat.history.push(systemMessage);
        
                                    const hiddenMemoryMessage = {
                                        role: 'system',
                                        content: `[系统提示：你刚刚成功将自己的备注名修改为了“${newName}”。请自然地接受这个新名字，不要对此感到惊讶。]`,
                                        timestamp: messageTimestamp++, 
                                        isHidden: true
                                    };
                                    chat.history.push(hiddenMemoryMessage);
        
                                    if (isViewingThisChat) {
                                        appendMessage(systemMessage, chat);
                                        document.getElementById('chat-header-title').textContent = newName;
                                    }
                                    
                                    await syncCharacterNameInGroups(chat); 
                                }
                            }
                            continue;
        
                        case 'change_avatar': {
                            const avatarName = msgData.name;
                            const foundAvatar = chat.settings.aiAvatarLibrary.find(avatar => avatar.name === avatarName);
                            if (foundAvatar) {
                                chat.settings.aiAvatar = foundAvatar.url;
                                
                                const systemNotice = {
                                    role: 'system',
                                    type: 'pat_message',
                                    content: `[${chat.name} 更换了头像]`,
                                    timestamp: Date.now()
                                };
                                chat.history.push(systemNotice);
        
                                await syncCharacterAvatarInGroups(chat);
                                
                                if (isViewingThisChat) {
                                    appendMessage(systemNotice, chat);
                                    renderChatInterface(chatId);
                                }
                            }
                            continue;
                        }
                        case 'change_user_avatar': {
                            const avatarName = msgData.name;
                            const foundAvatar = chat.settings.myAvatarLibrary.find(avatar => avatar.name === avatarName);
                            if (foundAvatar) {
                                chat.settings.myAvatar = foundAvatar.url;
                                
                                const systemNotice = {
                                    role: 'system',
                                    type: 'pat_message',
                                    content: `[${chat.name} 更换了你的头像]`,
                                    timestamp: Date.now()
                                };
                                chat.history.push(systemNotice);
                                
                                if (isViewingThisChat) {
                                    appendMessage(systemNotice, chat);
                                    renderChatInterface(chatId);
                                }
                            }
                            continue; 
                        }

case 'gomoku_move': { 
    
    const x = parseInt(msgData.x);
    const y = parseInt(msgData.y);

    
    if (!isNaN(x) && !isNaN(y)) {
        handleAiGomokuMove({ x: x, y: y });
    } else {
        console.warn("AI的五子棋移动指令包含无效坐标，已忽略:", msgData);
    }
    continue; 
}
  
                        case 'waimai_response':
                            const requestMessageIndex = chat.history.findIndex(m => m.timestamp === msgData.for_timestamp);
                            if (requestMessageIndex > -1) {
                                const originalMsg = chat.history[requestMessageIndex];
                                originalMsg.status = msgData.status;
                                originalMsg.paidBy = msgData.status === 'paid' ? msgData.name : null;
                            }
                            continue;
        
                        case 'qzone_post':
    const newPost = { 
        type: msgData.postType, 
        content: msgData.content || '', 
        publicText: msgData.publicText || '', 
        hiddenContent: msgData.hiddenContent || '', 
       image_prompt: msgData.image_prompt || '', // <--- 把这行加回来
        timestamp: Date.now(), 
        authorId: chatId, 
        authorGroupId: chat.groupId, // 【核心新增】记录作者的分组ID
        visibleGroupIds: null 
    };
    
    
    // 如果是naiimag类型，调用NovelAI API生成高质量图片（限制最多2张）
    if (msgData.postType === 'naiimag' && msgData.prompt) {
        try {
            // 支持 prompt 为数组（多张图片）或字符串（单张图片）
            // 动态限制最多2张NAI图片
            const prompts = Array.isArray(msgData.prompt) ? msgData.prompt.slice(0, 2) : [msgData.prompt];
            console.log(`📸 动态NovelAI图片生成开始，共${prompts.length}张图片`);
            
            // 存储生成的图片URL
            const generatedImageUrls = [];
            
            // 逐个生成图片
            for (let i = 0; i < prompts.length; i++) {
                const aiPrompt = prompts[i];
                console.log(`生成第${i+1}张图片，prompt:`, aiPrompt);
                
                // 获取角色的NAI提示词配置（系统或角色专属）
                const naiPrompts = getCharacterNAIPrompts(chat.id);
                
                // 构建最终的提示词：AI的prompt + 配置的提示词
                const finalPositivePrompt = aiPrompt + ', ' + naiPrompts.positive;
                const finalNegativePrompt = naiPrompts.negative;
                
                console.log(`📝 使用${naiPrompts.source === 'character' ? '角色专属' : '系统'}提示词配置`);
                console.log('最终正面提示词:', finalPositivePrompt);
                console.log('最终负面提示词:', finalNegativePrompt);
                
                // 获取NAI设置（从localStorage读取）
                const apiKey = preferences.getItem('novelai-api-key');
                const model = preferences.getItem('novelai-model') || 'nai-diffusion-4-5-full';
                const settings = getNovelAISettings();
                
                if (!apiKey) {
                    throw new Error('NovelAI API Key未配置。请在NovelAI设置中填写API Key。');
                }
                
                const [width, height] = settings.resolution.split('x').map(Number);
                
                // ★★★ V4/V4.5 和 V3 使用不同的请求体格式 ★★★
                let requestBody;
                
                if (model.includes('nai-diffusion-4')) {
                    // V4/V4.5 使用新格式 (params_version: 3)
                    requestBody = {
                        input: finalPositivePrompt,
                        model: model,
                        action: 'generate',
                        parameters: {
                            params_version: 3,  // V4必须使用版本3
                            width: width,
                            height: height,
                            scale: settings.cfg_scale,
                            sampler: settings.sampler,
                            steps: settings.steps,
                            seed: settings.seed === -1 ? Math.floor(Math.random() * 9999999999) : settings.seed,
                            n_samples: 1,
                            ucPreset: settings.uc_preset,
                            qualityToggle: settings.quality_toggle,
                            autoSmea: false,
                            dynamic_thresholding: false,
                            controlnet_strength: 1,
                            legacy: false,
                            add_original_image: true,
                            cfg_rescale: 0,
                            noise_schedule: 'karras',  // V4使用karras
                            legacy_v3_extend: false,
                            skip_cfg_above_sigma: null,
                            use_coords: false,
                            legacy_uc: false,
                            normalize_reference_strength_multiple: true,
                            inpaintImg2ImgStrength: 1,
                            characterPrompts: [],
                            // V4专用提示词格式
                            v4_prompt: {
                                caption: {
                                    base_caption: finalPositivePrompt,
                                    char_captions: []
                                },
                                use_coords: false,
                                use_order: true
                            },
                            // V4专用负面提示词格式
                            v4_negative_prompt: {
                                caption: {
                                    base_caption: finalNegativePrompt,
                                    char_captions: []
                                },
                                legacy_uc: false
                            },
                            negative_prompt: finalNegativePrompt,
                            deliberate_euler_ancestral_bug: false,
                            prefer_brownian: true
                            // 注意：不包含 stream 参数，使用标准ZIP响应而非msgpack流
                        }
                    };
                } else {
                    // V3 及更早版本使用旧格式
                    requestBody = {
                        input: finalPositivePrompt,
                        model: model,
                        action: 'generate',
                        parameters: {
                            width: width,
                            height: height,
                            scale: settings.cfg_scale,
                            sampler: settings.sampler,
                            steps: settings.steps,
                            seed: settings.seed === -1 ? Math.floor(Math.random() * 9999999999) : settings.seed,
                            n_samples: 1,
                            ucPreset: settings.uc_preset,
                            qualityToggle: settings.quality_toggle,
                            sm: settings.smea,
                            sm_dyn: settings.smea_dyn,
                            dynamic_thresholding: false,
                            controlnet_strength: 1,
                            legacy: false,
                            add_original_image: false,
                            cfg_rescale: 0,
                            noise_schedule: 'native',
                            negative_prompt: finalNegativePrompt
                        }
                    };
                }
                
                console.log('🚀 发送NAI请求:', requestBody);
                
                // ★★★ 根据模型选择不同的API端点 ★★★
                let apiUrl;
                
                // V4/V4.5 模型使用流式端点
                if (model.includes('nai-diffusion-4')) {
                    // V4/V4.5 默认使用流式端点
                    apiUrl = 'https://image.novelai.net/ai/generate-image-stream';
                } else {
                    // V3 及更早版本使用标准端点
                    apiUrl = 'https://image.novelai.net/ai/generate-image';
                }
                
                let corsProxy = settings.cors_proxy;
                
                // 如果选择了自定义代理，使用自定义URL
                if (corsProxy === 'custom') {
                    corsProxy = settings.custom_proxy_url || '';
                }
                
                // 如果有代理，添加到URL前面
                if (corsProxy && corsProxy !== '') {
                    apiUrl = corsProxy + encodeURIComponent(apiUrl);
                }
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + apiKey
                    },
                    body: JSON.stringify(requestBody)
                });
                
                console.log('Response status:', response.status);
                console.log('Response headers:', [...response.headers.entries()]);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('API错误响应:', errorText);
                    throw new Error(`API请求失败 (${response.status}): ${errorText}`);
                }
                
                // NovelAI API返回的是ZIP文件，需要解压
                const contentType = response.headers.get('content-type');
                console.log('Content-Type:', contentType);
                
                // 检查是否为 SSE 流式响应
                let zipBlob;
                let imageDataUrl;
                if (contentType && contentType.includes('text/event-stream')) {
                    console.log('检测到 SSE 流式响应，开始解析...');
                    
                    // 读取整个流
                    const text = await response.text();
                    console.log('收到 SSE 数据，大小:', text.length);
                    
                    // 解析 SSE 格式，提取最后的 data: 行
                    const lines = text.trim().split('\n');
                    let base64Data = null;
                    
                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i].trim();
                        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                            const dataContent = line.substring(6); // 移除 'data: ' 前缀
                            
                            // 尝试解析 JSON
                            try {
                                const jsonData = JSON.parse(dataContent);
                                
                                // V4.5 流式端点：event_type 为 "final" 时包含最终图片
                                if (jsonData.event_type === 'final' && jsonData.image) {
                                    base64Data = jsonData.image;
                                    console.log('✅ 找到 final 事件的图片数据');
                                    break;
                                }
                                
                                // 兼容其他格式
                                if (jsonData.data) {
                                    base64Data = jsonData.data;
                                    console.log('从 JSON.data 中提取图片数据');
                                    break;
                                }
                                if (jsonData.image) {
                                    base64Data = jsonData.image;
                                    console.log('从 JSON.image 中提取图片数据');
                                    break;
                                }
                            } catch (e) {
                                // 如果不是 JSON，直接作为 base64 数据
                                base64Data = dataContent;
                                console.log('直接使用 base64 数据');
                                break;
                            }
                        }
                    }
                    
                    if (!base64Data) {
                        throw new Error('无法从 SSE 响应中提取图片数据');
                    }
                    
                    // V4.5 流式端点返回的是 PNG base64，不是 ZIP
                    // 检查是否为 PNG (以 iVBORw0KGgo 开头) 或 JPEG (以 /9j/ 开头)
                    const isPNG = base64Data.startsWith('iVBORw0KGgo');
                    const isJPEG = base64Data.startsWith('/9j/');
                    
                    if (isPNG || isJPEG) {
                        console.log('✅ 检测到直接的图片 base64 数据 (PNG/JPEG)');
                        // 将 base64 转为 Blob
                        const binaryString = atob(base64Data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const imageBlob = new Blob([bytes], { type: isPNG ? 'image/png' : 'image/jpeg' });
                        console.log('图片 Blob 创建成功，大小:', imageBlob.size);
                        
                        // 转换为dataURL用于后续处理
                        const reader = new FileReader();
                        imageDataUrl = await new Promise((resolve, reject) => {
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(imageBlob);
                        });
                        console.log('✅ 图片转换成功！🎨');
                    } else {
                        // 否则当作 ZIP 处理
                        console.log('当作 ZIP 文件处理...');
                        const binaryString = atob(base64Data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        zipBlob = new Blob([bytes]);
                        console.log('ZIP Blob 大小:', zipBlob.size);
                    }
                } else {
                    // 非流式响应，直接读取
                    zipBlob = await response.blob();
                    console.log('收到数据，类型:', zipBlob.type, '大小:', zipBlob.size);
                }
                
                // 如果还没有imageDataUrl（即需要解压ZIP）
                if (!imageDataUrl && zipBlob) {
                    // NovelAI始终返回ZIP格式，需要解压
                    try {
                        
                        // 解压ZIP文件
                        const zip = await openImageArchive(zipBlob);
                        console.log('ZIP文件内容:', Object.keys(zip.files));
                        
                        // 查找第一个图片文件（通常是image_0.png）
                        let imageFile = null;
                        for (let filename in zip.files) {
                            if (filename.match(/\.(png|jpg|jpeg|webp)$/i)) {
                                imageFile = zip.files[filename];
                                console.log('找到图片文件:', filename);
                                break;
                            }
                        }
                        
                        if (!imageFile) {
                            throw new Error('ZIP文件中未找到图片');
                        }
                        
                        // 提取图片数据
                        const imageBlob = await imageFile.async('blob');
                        console.log('提取的图片大小:', imageBlob.size);
                        
                        // 创建图片URL
                        const reader = new FileReader();
                        imageDataUrl = await new Promise((resolve, reject) => {
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(imageBlob);
                        });
                        console.log('✅ 图片解压成功！');
                    } catch (zipError) {
                        console.error('ZIP解压失败:', zipError);
                        throw new Error('图片解压失败: ' + zipError.message);
                    }
                }
                
                console.log(`✅ NAI图片${i+1}生成成功！`);
                generatedImageUrls.push(imageDataUrl);
            }
            
            // 将生成的图片URL保存到动态中
            newPost.imageUrls = generatedImageUrls;
            
            // 保持向后兼容，单张图片时也设置 imageUrl
            if (generatedImageUrls.length === 1) {
                newPost.imageUrl = generatedImageUrls[0];
            }
            
            newPost.prompt = msgData.prompt;
            newPost.imageCount = generatedImageUrls.length;
            console.log(`✅ 动态NovelAI图片全部生成完成: ${generatedImageUrls.length}张`);
        } catch (error) {
            console.error('❌ 动态NAI图片生成失败:', error);
            // 失败时仍然发布动态，但添加错误信息
            newPost.content = (newPost.content || newPost.publicText || '') + `\n[图片生成失败: ${error.message}]`;
        }
    }
    
    await runtime.db.qzonePosts.add(newPost);
                    updateUnreadIndicator(runtime.unreadPostsCount + 1);
                    if (isViewingThisChat && document.getElementById('qzone-screen').classList.contains('active')) {
                       await renderQzonePosts();
                    }
                    continue;
        
case 'qzone_comment': { // 使用块级作用域
                            const postToComment = await runtime.db.qzonePosts.get(parseInt(msgData.postId)); // 修复: action -> msgData
                            if (postToComment) {
                                if (!postToComment.comments) postToComment.comments = [];
                                
                                const commenterName = msgData.name || chat.originalName; // 修复: action -> msgData
        
                                const createCommentObject = (text, meaning = null, replyTo = null) => ({
                                    commenterName,
                                    text: processMentions(text, chat),
                                    meaning,
                                    replyTo,
                                    timestamp: Date.now()
                                });
        
                                if (msgData.stickerMeaning) { 
                                    const sticker = runtime.state.userStickers.find(s => s.name === msgData.stickerMeaning); // 修复: action -> msgData
                                    if (sticker) {
                                        postToComment.comments.push(createCommentObject(sticker.url, sticker.name, msgData.replyTo || null)); // 修复: action -> msgData
                                    } else {
                                        console.warn(`AI 尝试评论一个不存在的表情: "${msgData.stickerMeaning}"`); // 修复: action -> msgData
                                        postToComment.comments.push(createCommentObject(`[表情: ${msgData.stickerMeaning}]`, null, msgData.replyTo || null)); // 修复: action -> msgData
                                    }
                                } else if (Array.isArray(msgData.comments)) { // 修复: action -> msgData
                                    msgData.comments.forEach(commentText => { // 修复: action -> msgData
                                        if (typeof commentText === 'string' && commentText.trim()) {
                                            postToComment.comments.push(createCommentObject(commentText, null, msgData.replyTo || null)); // 修复: action -> msgData
                                        }
                                    });
                                } else if (typeof msgData.commentText === 'string' && msgData.commentText.trim()) { // 修复: action -> msgData
                                    postToComment.comments.push(createCommentObject(msgData.commentText, null, msgData.replyTo || null)); // 修复: action -> msgData
                                }
                                
                                await runtime.db.qzonePosts.update(postToComment.id, { comments: postToComment.comments });
                                updateUnreadIndicator(runtime.unreadPostsCount + 1);
                                console.log(`后台活动: 角色 "${chat.name}" 评论了动态 #${msgData.postId}`); // 修复: action -> msgData
        
                                if (!chat.commentCooldowns) chat.commentCooldowns = {};
                                chat.commentCooldowns[msgData.postId] = Date.now(); // 修复: action -> msgData
                            }
                            continue; 
                        }
                        case 'qzone_like':
                           const postToLike = await runtime.db.qzonePosts.get(parseInt(msgData.postId));
                           if (postToLike) {
                               if (!postToLike.likes) postToLike.likes = [];
                               if (!postToLike.likes.includes(chat.name)) {
                                   postToLike.likes.push(chat.name);
                                   await runtime.db.qzonePosts.update(postToLike.id, { likes: postToLike.likes });
                                   updateUnreadIndicator(runtime.unreadPostsCount + 1);
                                   if (isViewingThisChat && document.getElementById('qzone-screen').classList.contains('active')) {
                                      await renderQzonePosts();
                                   }
                               }
                           }
                            continue;
                        case 'repost': { 
                            const originalPost = await runtime.db.qzonePosts.get(parseInt(msgData.postId));
                            if (originalPost) {
                                const newPost = {
                                    type: 'repost',
                                    timestamp: Date.now(),
                                    authorId: chatId,
                                    authorGroupId: chat.groupId,
                                    repostComment: msgData.comment || '',
                                    originalPost: originalPost,
                                    visibleGroupIds: null
                                };
                                await runtime.db.qzonePosts.add(newPost);
                                updateUnreadIndicator(runtime.unreadPostsCount + 1);
                                console.log(`后台活动: 角色 "${chat.name}" 转发了动态 #${msgData.postId}`);
                            }
                            continue;
                        }
                        case 'video_call_request':
                            if (!runtime.videoCallState.isActive && !runtime.videoCallState.isAwaitingResponse) {
                                runtime.state.activeChatId = chatId;
                                runtime.videoCallState.activeChatId = chatId; 
                                runtime.videoCallState.isAwaitingResponse = true;
                                runtime.videoCallState.isGroupCall = chat.isGroup;
                                runtime.videoCallState.callRequester = msgData.name || chat.name;
                                showIncomingCallModal();
                            }
                            continue;
                        case 'group_call_request':
                            if (!runtime.videoCallState.isActive && !runtime.videoCallState.isAwaitingResponse) {
                                runtime.state.activeChatId = chatId;
                                runtime.videoCallState.isAwaitingResponse = true;
                                runtime.videoCallState.isGroupCall = true;
                                runtime.videoCallState.initiator = 'ai';
                                runtime.videoCallState.callRequester = msgData.name;
                                showIncomingCallModal();
                            }
                            continue;
                        case 'pat_user':
                            let patterName;
                            if (chat.isGroup) {
                                const member = chat.members.find(m => m.originalName === msgData.name);
                                patterName = member ? member.groupNickname : msgData.name;
                            } else {
                                patterName = chat.name;
                            }
                            const suffix = msgData.suffix ? ` ${msgData.suffix.trim()}` : '';
                            const patText = `${patterName} 拍了拍我${suffix}`;
        
                            const patMessage = { 
                                role: 'system', 
                                type: 'pat_message', 
                                content: patText, 
                                timestamp: Date.now() 
                            };
                            chat.history.push(patMessage);
                            if (isViewingThisChat) {
                                const phoneScreen = document.getElementById('phone-screen');
                                phoneScreen.classList.remove('pat-animation');
                                void phoneScreen.offsetWidth;
                                phoneScreen.classList.add('pat-animation');
                                setTimeout(() => phoneScreen.classList.remove('pat-animation'), 500);
                                appendMessage(patMessage, chat);
                            } else {
                                showNotification(chatId, patText);
                            }
                            continue; 
                        case 'update_status':
                            chat.status.text = msgData.status_text;
                            chat.status.isBusy = msgData.is_busy || false;
                            chat.status.lastUpdate = Date.now();
                            const statusUpdateMessage = {
                                role: 'system',
                                type: 'pat_message',
                                content: `[${chat.name}的状态已更新为: ${msgData.status_text}]`,
                                timestamp: Date.now()
                            };
                            chat.history.push(statusUpdateMessage);
                            if (isViewingThisChat) {
                                appendMessage(statusUpdateMessage, chat);
                            }
                            renderChatList(); 
                            continue; 
                        case 'location_share':
                            aiMessage = {
                                ...baseMessage,
                                type: 'location_share',
                                content: msgData.content
                            };
                            break;
                        case 'change_music':
                            if (runtime.musicState.isActive && runtime.musicState.activeChatId === chatId) {
                                const songNameFromAI = msgData.song_name || msgData.song || msgData.name;
        
                                if (typeof songNameFromAI === 'string' && songNameFromAI.trim()) {
                                    const songNameToFind = songNameFromAI.replace(/^\[?\d+\]?[\s.-]*/, '').trim();
                                    const targetSongIndex = runtime.musicState.playlist.findIndex(track => track.name.toLowerCase() === songNameToFind.toLowerCase());
                                    
                                    if (targetSongIndex > -1) {
                                        playSong(targetSongIndex);
                                        const track = runtime.musicState.playlist[targetSongIndex];
                                        
                                        let changerName;
                                        if (chat.isGroup) {
                                            const member = chat.members.find(m => m.originalName === msgData.name);
                                            changerName = member ? member.groupNickname : msgData.name;
                                        } else {
                                            changerName = chat.name;
                                        }
                                        
                                        const musicChangeMessage = {
                                            role: 'system',
                                            type: 'pat_message',
                                            content: `[♪ ${changerName} 为你切歌: 《${track.name}》 - ${track.artist}]`,
                                            timestamp: Date.now()
                                        };
                                        chat.history.push(musicChangeMessage);
                                        if (isViewingThisChat) {
                                            appendMessage(musicChangeMessage, chat);
                                        }
                                    } else {
                                        console.warn(`歌曲查找失败: AI请求的歌曲名"${songNameFromAI}"(处理后为"${songNameToFind}") 在播放列表中未找到。`);
                                    }
                                } else {
                                    console.error("AI返回的change_music指令中，歌曲名无效或缺失:", msgData);
                                }
                            }
                            continue;
                        case 'create_memory':
                            const newMemory = {
                                chatId: chatId,
                                authorId: chatId,
                                description: msgData.description,
                                timestamp: Date.now(),
                                type: 'ai_generated'
                            };
                            await runtime.db.memories.add(newMemory);
                            console.log(`AI "${chat.name}" 记录了一条新回忆:`, msgData.description);
                            continue; 
                        case 'create_countdown':
                            const targetDate = new Date(msgData.date);
                            if (!isNaN(targetDate) && targetDate > new Date()) {
                                const newCountdown = {
                                    chatId: chatId,
                                    authorId: chatId,
                                    description: msgData.title,
                                    timestamp: Date.now(),
                                    type: 'countdown',
                                    targetDate: targetDate.getTime()
                                };
                                await runtime.db.memories.add(newCountdown);
                                console.log(`AI "${chat.name}" 创建了一个新约定:`, msgData.title);
                            }
                            continue;
                        case 'block_user':
                            if (!chat.isGroup) {
                                chat.relationship.status = 'blocked_by_ai';
                                const hiddenMessage = {
                                    role: 'system',
                                    content: `[系统提示：你刚刚主动拉黑了用户。]`,
                                    timestamp: Date.now(),
                                    isHidden: true
                                };
                                chat.history.push(hiddenMessage);
                                await runtime.db.chats.put(chat);
                                if (isViewingThisChat) {
                                    renderChatInterface(chatId);
                                }
                                renderChatList();
                                break; 
                            }
                            continue;
                        case 'friend_request_response':
                            if (!chat.isGroup && chat.relationship?.status === 'pending_ai_approval') {
                                if (msgData.decision === 'accept') {
                                    chat.relationship.status = 'friend';
                                    aiMessage = { ...baseMessage, content: "我通过了你的好友申请，我们现在是好友啦！" };
                                } else {
                                    chat.relationship.status = 'blocked_by_ai';
                                    aiMessage = { ...baseMessage, content: "抱歉，我拒绝了你的好友申请。" };
                                }
                                chat.relationship.applicationReason = '';
                            }
                            break;
                        case 'poll':
                            const pollOptions = typeof msgData.options === 'string'
                                ? msgData.options.split('\n').filter(opt => opt.trim())
                                : (Array.isArray(msgData.options) ? msgData.options : []);
                            if (pollOptions.length < 2) continue;
                            aiMessage = {
                                ...baseMessage,
                                type: 'poll',
                                question: msgData.question,
                                options: pollOptions,
                                votes: {},
                                isClosed: false,
                            };
                            break;
case 'gift': {
    const { itemName, itemPrice, image_prompt } = msgData; 
    
    if (itemName && !isNaN(parseFloat(itemPrice)) && image_prompt) {
        
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(image_prompt)}`;

        aiMessage = {
            ...baseMessage,
            type: 'gift',
            items: [{
                name: itemName,
                price: parseFloat(itemPrice), 
                imageUrl: imageUrl, 
                quantity: 1 
            }],
            total: parseFloat(itemPrice),
            recipients: msgData.recipients || null 
        };
    } else {
        console.warn(`AI 尝试赠送一个格式不正确的随机礼物:`, msgData); 
    }
    break;
}
                        case 'vote':
                            const pollToVote = chat.history.find(m => m.timestamp === msgData.poll_timestamp);
                            if (pollToVote && !pollToVote.isClosed) {
                                Object.keys(pollToVote.votes).forEach(option => {
                                    const voterIndex = pollToVote.votes[option].indexOf(msgData.name);
                                    if (voterIndex > -1) {
                                        pollToVote.votes[option].splice(voterIndex, 1);
                                    }
                                });
                                if (!pollToVote.votes[msgData.choice]) {
                                    pollToVote.votes[msgData.choice] = [];
                                }
                                if (!pollToVote.votes[msgData.choice].includes(msgData.name)) {
                                    pollToVote.votes[msgData.choice].push(msgData.name);
                                }                        
                                if (isViewingThisChat) {
                                    renderChatInterface(chatId);
                                }
                            }
                            continue;
                        case 'red_packet':
                            aiMessage = {
                                ...baseMessage,
                                ...msgData,
                                totalAmount: msgData.amount, 
                                claimedBy: {}, 
                                isFullyClaimed: false
                            };
                            if (msgData.receiver) {
                                aiMessage.receiverName = msgData.receiver;
                                delete aiMessage.receiver;
                            }
                            break;
                        case 'open_red_packet':
                            const packetToOpen = chat.history.find(m => m.timestamp === msgData.packet_timestamp);
                            
const claimerOriginalName = msgData.name; 
const isMember = chat.members.some(member => member.originalName === claimerOriginalName);


if (!isMember) {
    console.warn(`AI 角色 "${claimerOriginalName}" 尝试领取不属于自己的群聊红包。操作已被拦截。`);
    continue; 
}

                            if (packetToOpen && packetToOpen.packetType === 'direct') {
                                if (packetToOpen.receiverName !== msgData.name) {
                                    console.warn(`AI 角色 "${msgData.name}" 尝试领取不属于自己的专属红包 (接收人: ${packetToOpen.receiverName})。操作已被拦截。`);
                                    continue;
                                }
                            }
                            
                            if (packetToOpen && !packetToOpen.isFullyClaimed && !(packetToOpen.claimedBy && packetToOpen.claimedBy[msgData.name])) {
                                let claimedAmountAI = 0;
                                const remainingAmount = packetToOpen.totalAmount - Object.values(packetToOpen.claimedBy || {}).reduce((sum, val) => sum + val, 0);
                                const remainingCount = packetToOpen.count - Object.keys(packetToOpen.claimedBy || {}).length;
                                if (remainingCount > 0) {
                                    if (packetToOpen.packetType === 'direct') {
                                        claimedAmountAI = packetToOpen.totalAmount;
                                    } else {
                                        if (remainingCount === 1) { claimedAmountAI = remainingAmount; } 
                                        else {
                                            const min = 0.01;
                                            const max = remainingAmount - (remainingCount - 1) * min;
                                            claimedAmountAI = Math.random() * (max - min) + min;
                                        }
                                    }
        
                                    claimedAmountAI = parseFloat(claimedAmountAI.toFixed(2));
                                    if (!packetToOpen.claimedBy) packetToOpen.claimedBy = {};
                                    packetToOpen.claimedBy[msgData.name] = claimedAmountAI;
        

const claimerMember = chat.members.find(m => m.originalName === msgData.name);
const claimerDisplayName = claimerMember ? claimerMember.groupNickname : msgData.name;


const senderDisplayName = getDisplayNameInGroup(chat, packetToOpen.senderName);

const aiClaimedMessage = {
    role: 'system',
    type: 'pat_message',
    content: `${claimerDisplayName} 领取了 ${senderDisplayName} 的红包`, 
    timestamp: Date.now()
};
chat.history.push(aiClaimedMessage);

                                    let hiddenContentForAI = `[系统提示：你 (${claimerDisplayName}) 成功抢到了 ${claimedAmountAI.toFixed(2)} 元。`;
                                    if (Object.keys(packetToOpen.claimedBy).length >= packetToOpen.count) {
                                        packetToOpen.isFullyClaimed = true;
                                        const finishedMessage = {
                                            role: 'system',
                                            type: 'pat_message',
                                            content: `${senderDisplayName} 的红包已被领完`,
                                            timestamp: Date.now() + 1
                                        };
                                        chat.history.push(finishedMessage);
                                        let luckyKing = { name: '', amount: -1 };
                                        if (packetToOpen.packetType === 'lucky' && packetToOpen.count > 1) {
                                            Object.entries(packetToOpen.claimedBy).forEach(([name, amount]) => {
                                                if (amount > luckyKing.amount) {
                                                    luckyKing = { name, amount };
                                                }
                                            });
                                        }
                                        if (luckyKing.name) {
                                             const luckyKingMember = chat.members.find(m => m.originalName === luckyKing.name);
                                             const luckyKingDisplayName = luckyKingMember ? luckyKingMember.groupNickname : luckyKing.name;
                                             hiddenContentForAI += ` 红包已被领完，手气王是 ${luckyKingDisplayName}！`;
                                        } else {
                                             hiddenContentForAI += ` 红包已被领完。`;
                                        }
                                    }
                                    hiddenContentForAI += ' 请根据这个结果发表你的评论。]';
                                    const hiddenMessageForAI = {
                                        role: 'system',
                                        content: hiddenContentForAI,
                                        timestamp: Date.now() + 2,
                                        isHidden: true
                                    };
                                    chat.history.push(hiddenMessageForAI);
                                }
                                if (isViewingThisChat) {
                                    renderChatInterface(chatId);
                                    renderChatList(); 
                                }
                            }
                            continue;
        
                        case 'accept_transfer': {
                            const originalTransferMsgIndex = chat.history.findIndex(m => m.timestamp === msgData.for_timestamp);
                            if (originalTransferMsgIndex > -1) {
                                const originalMsg = chat.history[originalTransferMsgIndex];
                                originalMsg.status = 'accepted';
                            }
                            continue;
                        }
        
                        case 'decline_transfer': {
                            const originalTransferMsgIndex = chat.history.findIndex(m => m.timestamp === msgData.for_timestamp);
                            if (originalTransferMsgIndex > -1) {
                                const originalMsg = chat.history[originalTransferMsgIndex];
                                originalMsg.status = 'declined';
                                const refundMessage = {
                                    role: 'assistant',
                                    senderName: chat.name,
                                    type: 'transfer',
                                    isRefund: true,
                                    amount: originalMsg.amount,
                                    note: '转账已被拒收',
                                    timestamp: messageTimestamp++
                                };
                                chat.history.push(refundMessage);
                                if (isViewingThisChat) {
                                    appendMessage(refundMessage, chat); 
                                    renderChatInterface(chatId); 
                                }
                            }
                            continue;
                        }
                        case 'change_group_name':
                            if (chat.isGroup && msgData.new_name) {
                                const newName = msgData.new_name.trim();
                                const memberNames = chat.members.map(m => m.originalName);
        
                                if (memberNames.includes(newName)) {
                                    console.warn(`AI (${msgData.name}) 试图将群名更改为成员名 ("${newName}")。操作已被程序阻止。`);
                                    continue; 
                                }
        
                                chat.name = newName; 
        
                                const changerMember = chat.members.find(m => m.originalName === msgData.name);
                                const changerDisplayName = changerMember ? changerMember.groupNickname : msgData.name;
                                
                                const systemMessage = {
                                    role: 'system',
                                    type: 'pat_message',
                                    content: `${changerDisplayName} 将群名修改为 “${chat.name}”`,
                                    timestamp: messageTimestamp++
                                };
                                chat.history.push(systemMessage);
        
                                if (isViewingThisChat) {
                                    appendMessage(systemMessage, chat);
                                    document.getElementById('chat-header-title').textContent = chat.name;
                                }
                            }
                            continue;
                        case 'change_remark_name':
                            if (!chat.isGroup && msgData.new_name) {
                                const oldName = chat.name; 
                                const newName = msgData.new_name.trim();
        
                                if (newName && newName !== oldName) {
                                    if (!chat.nameHistory) {
                                        chat.nameHistory = [];
                                    }
                                    if (!chat.nameHistory.includes(oldName)) {
                                        chat.nameHistory.push(oldName);
                                    }
                                    
                                    chat.name = newName; 
        
                                    const systemMessage = {
                                        role: 'system',
                                        type: 'pat_message', 
                                        content: `“${chat.originalName}” 将备注修改为 “${newName}”`,
                                        timestamp: messageTimestamp++
                                    };
                                    chat.history.push(systemMessage);
        
                                    const hiddenMemoryMessage = {
                                        role: 'system',
                                        content: `[系统提示：你刚刚成功将自己的备注名修改为了“${newName}”。请自然地接受这个新名字，不要对此感到惊讶。]`,
                                        timestamp: messageTimestamp++, 
                                        isHidden: true
                                    };
                                    chat.history.push(hiddenMemoryMessage);
        
                                    if (isViewingThisChat) {
                                        appendMessage(systemMessage, chat);
                                        document.getElementById('chat-header-title').textContent = newName;
                                    }
                                    
                                    await syncCharacterNameInGroups(chat); 
                                }
                            }
                            continue;
        
                        case 'change_group_avatar':
                            if (chat.isGroup && msgData.avatar_name) {
                                const avatarName = msgData.avatar_name;
                                const library = chat.settings.groupAvatarLibrary || [];
                                const foundAvatar = library.find(avatar => avatar.name === avatarName);
        
                                if (foundAvatar) {
                                    chat.settings.groupAvatar = foundAvatar.url;
                                    
                                    const changerMember = chat.members.find(m => m.originalName === msgData.name);
                                    const changerDisplayName = changerMember ? changerMember.groupNickname : msgData.name;
        
                                    const systemMessage = {
                                        role: 'system',
                                        type: 'pat_message',
                                        content: `${changerDisplayName} 更换了群头像`,
                                        timestamp: messageTimestamp++
                                    };
                                    chat.history.push(systemMessage);
        
                                    if (isViewingThisChat) {
                                        appendMessage(systemMessage, chat);
                                    }
                                } else {
                                    console.warn(`AI 尝试使用一个不存在的群头像: "${avatarName}"`);
                                }
                            }
                            continue;
                        case 'system_message':
                            aiMessage = { role: 'system', type: 'pat_message', content: msgData.content, timestamp: Date.now() };
                            break;
                        case 'share_link':
                            aiMessage = { 
                                ...baseMessage, 
                                type: 'share_link',
                                title: msgData.title,
                                description: msgData.description,
                                source_name: msgData.source_name,
                                content: msgData.content
                            };
                            break;
                        case 'quote_reply':
                            const originalMessage = chat.history.find(m => m.timestamp === msgData.target_timestamp);
                            if (originalMessage) {
                                const quoteContext = {
                                    timestamp: originalMessage.timestamp,
                                    senderName: originalMessage.senderName || (originalMessage.role === 'user' ? (chat.settings.myNickname || '我') : chat.name),
                                    content: String(originalMessage.content || '').substring(0, 50),
                                };
                                aiMessage = { 
                                    ...baseMessage, 
                                    content: msgData.reply_content,
                                    quote: quoteContext
                                };
                            } else {
                                aiMessage = { ...baseMessage, content: msgData.reply_content };
                            }
                            break;
                        case 'send_and_recall': {
                            if (!isViewingThisChat) continue;
                            const tempMessageData = { ...baseMessage, content: msgData.content };
                            const tempMessageElement = createMessageElement(tempMessageData, chat);
                            appendMessage(tempMessageData, chat, true);
                            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1500));
                            const bubbleWrapper = document.querySelector(`.message-bubble[data-timestamp="${tempMessageData.timestamp}"]`)?.closest('.message-wrapper');
                            if (bubbleWrapper) {
                                bubbleWrapper.classList.add('recalled-animation');
                                await new Promise(resolve => setTimeout(resolve, 300));
                                const recalledMessage = {
                                    role: 'assistant',
                                    senderName: msgData.name || chat.name,
                                    type: 'recalled_message',
                                    content: '对方撤回了一条消息',
                                    timestamp: tempMessageData.timestamp,
                                    recalledData: { originalType: 'text', originalContent: msgData.content }
                                };
                                const msgIndex = chat.history.findIndex(m => m.timestamp === tempMessageData.timestamp);
                                if (msgIndex > -1) {
                                    chat.history[msgIndex] = recalledMessage;
                                } else {
                                    chat.history.push(recalledMessage);
                                }
                                const placeholder = await createMessageElement(recalledMessage, chat);
                                if(document.body.contains(bubbleWrapper)) {
                                    bubbleWrapper.parentNode.replaceChild(placeholder, bubbleWrapper);
                                }
                            }
                            continue;
                        }
                        
                        case 'text':
                            aiMessage = { ...baseMessage, content: String(msgData.content || msgData.message) };
                            break;
                        case 'sticker':
                            if (msgData.meaning) {
                                const sticker = runtime.state.userStickers.find(s => s.name === msgData.meaning);
                                if (sticker) {
                                    aiMessage = { ...baseMessage, type: 'sticker', content: sticker.url, meaning: sticker.name };
                                } else {
                                    // 如果AI虚构了一个不存在的表情名，作为文本发送
                                    console.warn(`AI 尝试使用一个不存在的表情: "${msgData.meaning}"`);
                                    aiMessage = { ...baseMessage, type: 'text', content: `[表情: ${msgData.meaning}]` };
                                }
                            } else {
                                // 兼容旧格式或错误格式
                                console.warn("AI 发送了一个没有 'meaning' 的 sticker 指令。", msgData);
                                aiMessage = { ...baseMessage, type: 'sticker', content: msgData.url, meaning: '未知表情' };
                            }
                            break;
                        case 'ai_image':
                            aiMessage = { ...baseMessage, type: 'ai_image', content: msgData.description, image_prompt: msgData.image_prompt };
                            break;
                        case 'voice_message':
                            aiMessage = { ...baseMessage, type: 'voice_message', content: msgData.content };
                            break;
                        case 'transfer':
                            aiMessage = { ...baseMessage, type: 'transfer', amount: msgData.amount, note: msgData.note, receiverName: msgData.receiver || '我' };
                            break;
                        
                        case 'waimai_request':
                            aiMessage = { 
                                ...baseMessage, 
                                type: 'waimai_request',
                                productInfo: msgData.productInfo,
                                amount: msgData.amount,
                                status: 'pending',
                                countdownEndTime: Date.now() + 15 * 60 * 1000,
                            };
                            break;
                case 'waimai_order':
                    aiMessage = {
                        ...baseMessage,
                        type: 'waimai_order',
                        productInfo: msgData.productInfo,
                        amount: msgData.amount,
                        greeting: msgData.greeting,
                        recipientName: msgData.recipientName || null 
                    };
                    break;
                        case 'offline_text':
        aiMessage = { ...baseMessage, ...msgData };
                        break;
                        
                case 'naiimag':
// NovelAI图片分享 - 调用NovelAI API生成高质量图片
try {
    console.log('📸 NovelAI图片生成开始，AI提供的prompt:', msgData.prompt);
    
    // 获取角色的NAI提示词配置（系统或角色专属）
    const naiPrompts = getCharacterNAIPrompts(chat.id);
    
    // 构建最终的提示词：AI的prompt + 配置的提示词
    const aiPrompt = msgData.prompt || 'a beautiful scene';
    const finalPositivePrompt = aiPrompt + ', ' + naiPrompts.positive;
    const finalNegativePrompt = naiPrompts.negative;
    
    console.log(`📝 使用${naiPrompts.source === 'character' ? '角色专属' : '系统'}提示词配置`);
    console.log('最终正面提示词:', finalPositivePrompt);
    console.log('最终负面提示词:', finalNegativePrompt);
    
    // 获取NAI设置（从localStorage读取）
    const apiKey = preferences.getItem('novelai-api-key');
    const model = preferences.getItem('novelai-model') || 'nai-diffusion-4-5-full';
    const settings = getNovelAISettings();
    
    if (!apiKey) {
        throw new Error('NovelAI API Key未配置。请在NovelAI设置中填写API Key。');
    }
    
    const [width, height] = settings.resolution.split('x').map(Number);
    
    // ★★★ V4/V4.5 和 V3 使用不同的请求体格式 ★★★
    let requestBody;
    
    if (model.includes('nai-diffusion-4')) {
        // V4/V4.5 使用新格式 (params_version: 3)
        requestBody = {
            input: finalPositivePrompt,
            model: model,
            action: 'generate',
            parameters: {
                params_version: 3,  // V4必须使用版本3
                width: width,
                height: height,
                scale: settings.cfg_scale,
                sampler: settings.sampler,
                steps: settings.steps,
                seed: settings.seed === -1 ? Math.floor(Math.random() * 9999999999) : settings.seed,
                n_samples: 1,
                ucPreset: settings.uc_preset,
                qualityToggle: settings.quality_toggle,
                autoSmea: false,
                dynamic_thresholding: false,
                controlnet_strength: 1,
                legacy: false,
                add_original_image: true,
                cfg_rescale: 0,
                noise_schedule: 'karras',  // V4使用karras
                legacy_v3_extend: false,
                skip_cfg_above_sigma: null,
                use_coords: false,
                legacy_uc: false,
                normalize_reference_strength_multiple: true,
                inpaintImg2ImgStrength: 1,
                characterPrompts: [],
                // V4专用提示词格式
                v4_prompt: {
                    caption: {
                        base_caption: finalPositivePrompt,
                        char_captions: []
                    },
                    use_coords: false,
                    use_order: true
                },
                // V4专用负面提示词格式
                v4_negative_prompt: {
                    caption: {
                        base_caption: finalNegativePrompt,
                        char_captions: []
                    },
                    legacy_uc: false
                },
                negative_prompt: finalNegativePrompt,
                deliberate_euler_ancestral_bug: false,
                prefer_brownian: true
                // 注意：不包含 stream 参数，使用标准ZIP响应而非msgpack流
            }
        };
    } else {
        // V3 及更早版本使用旧格式
        requestBody = {
            input: finalPositivePrompt,
            model: model,
            action: 'generate',
            parameters: {
width: width,
                height: height,
                scale: settings.cfg_scale,
                sampler: settings.sampler,
                steps: settings.steps,
                seed: settings.seed === -1 ? Math.floor(Math.random() * 9999999999) : settings.seed,
                n_samples: 1,
                ucPreset: settings.uc_preset,
                qualityToggle: settings.quality_toggle,
                sm: settings.smea,
                sm_dyn: settings.smea_dyn,
                dynamic_thresholding: false,
                controlnet_strength: 1,
                legacy: false,
                add_original_image: false,
                cfg_rescale: 0,
                noise_schedule: 'native',
                negative_prompt: finalNegativePrompt
            }
        };
    }
    
    console.log('🚀 发送NAI请求:', requestBody);
    
    // ★★★ 根据模型选择不同的API端点 ★★★
    let apiUrl;
    
    // V4/V4.5 模型使用流式端点
    if (model.includes('nai-diffusion-4')) {
        // V4/V4.5 默认使用流式端点
        apiUrl = 'https://image.novelai.net/ai/generate-image-stream';
    } else {
        // V3 及更早版本使用标准端点
        apiUrl = 'https://image.novelai.net/ai/generate-image';
    }
    
    let corsProxy = settings.cors_proxy;
    
    // 如果选择了自定义代理，使用自定义URL
    if (corsProxy === 'custom') {
        corsProxy = settings.custom_proxy_url || '';
    }
    
    // 如果有代理，添加到URL前面
    if (corsProxy && corsProxy !== '') {
        apiUrl = corsProxy + encodeURIComponent(apiUrl);
    }
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify(requestBody)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('API错误响应:', errorText);
        throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }
    
    // NovelAI API返回的是ZIP文件，需要解压
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    // 检查是否为 SSE 流式响应
    let zipBlob;
    let imageDataUrl;
    if (contentType && contentType.includes('text/event-stream')) {
        console.log('检测到 SSE 流式响应，开始解析...');
        
        // 读取整个流
        const text = await response.text();
        console.log('收到 SSE 数据，大小:', text.length);
        
        // 解析 SSE 格式，提取最后的 data: 行
        const lines = text.trim().split('\n');
        let base64Data = null;
        
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                const dataContent = line.substring(6); // 移除 'data: ' 前缀
                
                // 尝试解析 JSON
                try {
                    const jsonData = JSON.parse(dataContent);
                    
                    // V4.5 流式端点：event_type 为 "final" 时包含最终图片
                    if (jsonData.event_type === 'final' && jsonData.image) {
                        base64Data = jsonData.image;
                        console.log('✅ 找到 final 事件的图片数据');
                        break;
                    }
                    
                    // 兼容其他格式
                    if (jsonData.data) {
                        base64Data = jsonData.data;
                        console.log('从 JSON.data 中提取图片数据');
                        break;
                    }
                    if (jsonData.image) {
                        base64Data = jsonData.image;
                        console.log('从 JSON.image 中提取图片数据');
                        break;
                    }
                } catch (e) {
                    // 如果不是 JSON，直接作为 base64 数据
                    base64Data = dataContent;
                    console.log('直接使用 base64 数据');
                    break;
                }
            }
        }
        
        if (!base64Data) {
            throw new Error('无法从 SSE 响应中提取图片数据');
        }
        
        // V4.5 流式端点返回的是 PNG base64，不是 ZIP
        // 检查是否为 PNG (以 iVBORw0KGgo 开头) 或 JPEG (以 /9j/ 开头)
        const isPNG = base64Data.startsWith('iVBORw0KGgo');
        const isJPEG = base64Data.startsWith('/9j/');
        
        if (isPNG || isJPEG) {
            console.log('✅ 检测到直接的图片 base64 数据 (PNG/JPEG)');
            // 将 base64 转为 Blob
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const imageBlob = new Blob([bytes], { type: isPNG ? 'image/png' : 'image/jpeg' });
            console.log('图片 Blob 创建成功，大小:', imageBlob.size);
            
            // 转换为dataURL用于后续处理
            const reader = new FileReader();
            imageDataUrl = await new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageBlob);
            });
            console.log('✅ 图片转换成功！🎨');
        } else {
            // 否则当作 ZIP 处理
            console.log('当作 ZIP 文件处理...');
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            zipBlob = new Blob([bytes]);
            console.log('ZIP Blob 大小:', zipBlob.size);
        }
    } else {
        // 非流式响应，直接读取
        zipBlob = await response.blob();
        console.log('收到数据，类型:', zipBlob.type, '大小:', zipBlob.size);
    }
    
    // 如果还没有imageDataUrl（即需要解压ZIP）
    if (!imageDataUrl && zipBlob) {
        // NovelAI始终返回ZIP格式，需要解压
        try {
            
            // 解压ZIP文件
            const zip = await openImageArchive(zipBlob);
            console.log('ZIP文件内容:', Object.keys(zip.files));
            
            // 查找第一个图片文件（通常是image_0.png）
            let imageFile = null;
            for (let filename in zip.files) {
                if (filename.match(/\.(png|jpg|jpeg|webp)$/i)) {
                    imageFile = zip.files[filename];
                    console.log('找到图片文件:', filename);
                    break;
                }
            }
            
            if (!imageFile) {
                throw new Error('ZIP文件中未找到图片');
            }
            
            // 提取图片数据
            const imageBlob = await imageFile.async('blob');
            console.log('提取的图片大小:', imageBlob.size);
            
            // 创建图片URL
            const reader = new FileReader();
            imageDataUrl = await new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageBlob);
            });
            console.log('✅ 图片解压成功！');
        } catch (zipError) {
            console.error('ZIP解压失败:', zipError);
            throw new Error('图片解压失败: ' + zipError.message);
        }
    }
    
    console.log('✅ NAI图片生成成功！');
    
    // 创建naiimag消息
    aiMessage = { 
        ...baseMessage, 
        type: 'naiimag', 
        imageUrl: imageDataUrl,
        prompt: aiPrompt,
        fullPrompt: finalPositivePrompt // 保存完整提示词供查看
    };
} catch (error) {
    console.error('❌ NAI图片生成失败:', error);
    // 失败时降级为文本消息
    aiMessage = { 
        ...baseMessage, 
        content: `[图片生成失败: ${error.message}]` 
    };
}
break;
                        
                        default:
                             console.warn("收到了未知的AI指令类型:", msgData.type);
                             break;
                    }
        
                    if (aiMessage) {
                        chat.history.push(aiMessage);
                       if (!isViewingThisChat) {
                            chat.unreadCount = (chat.unreadCount || 0) + 1;
                        }
                        if (!isViewingThisChat && !notificationShown) {
                            let notificationText;
                            switch (aiMessage.type) {
                                case 'transfer': notificationText = `[收到一笔转账]`; break;
                                case 'waimai_request': notificationText = `[收到一个外卖代付请求]`; break;
                                case 'ai_image': notificationText = `[图片]`; break;
                                case 'voice_message': notificationText = `[语音]`; break;
                                case 'sticker': notificationText = aiMessage.meaning ? `[表情: ${aiMessage.meaning}]` : '[表情]'; break;
                                case 'offline_text': notificationText = aiMessage.dialogue ? `「${aiMessage.dialogue}」` : `[${aiMessage.description.substring(0, 20)}...]`; break;
                                default: notificationText = String(aiMessage.content || '');
                            }
                            const finalNotifText = chat.isGroup ? `${aiMessage.senderName}: ${notificationText}` : notificationText;
                            showNotification(chatId, finalNotifText.substring(0, 40) + (finalNotifText.length > 40 ? '...' : ''));
                            notificationShown = true;
                        }
        
 
                        
                        if (isViewingThisChat) {
                            appendMessage(aiMessage, chat);
                            await new Promise(resolve => setTimeout(resolve, Math.random() * 1800 + 1000));
                        }
                    }
                }        
        
                if (callHasBeenHandled && runtime.videoCallState.isGroupCall) {
                    runtime.videoCallState.isAwaitingResponse = false;
                    if (runtime.videoCallState.participants.length > 0) {
                        startVideoCall();
                    } else {
                        runtime.videoCallState = { ...runtime.videoCallState, isAwaitingResponse: false, participants: [] };
                        showScreen('chat-interface-screen');
                        alert("Nobody answered the group call.");
                    }
                }
                if (needsImmediateReaction) {
                    await triggerAiResponse();
                    return; 
                }
                await runtime.db.chats.put(chat);
        
const qzoneActionTaken = messagesArray.some(action =>
    action.type === 'qzone_post' ||
    action.type === 'qzone_like' ||
    action.type === 'qzone_comment' ||
    action.type === 'repost'
);


if (qzoneActionTaken) {
    console.log("检测到AI执行了动态操作，立即刷新好友动态页面。");
    
    await renderQzonePosts();
}


            } catch (error) {
                
                chat.history = chat.history.filter(msg => !msg.isTemporary);
                
                if (!chat.isGroup && chat.relationship?.status === 'pending_ai_approval') {
                    chat.relationship.status = 'blocked_by_ai';
                    await showCustomAlert("Friend Request Failed", `The AI could not process your friend request. Try again later. Error: ${error.message}`);
                } else {
                    await showCustomAlert(
                        "API Request Failed", 
                        `The AI did not reply. Error: ${error.message}`
                    );
                }
                
                if (!chat.isGroup && chat.relationship?.status === 'blocked_by_ai') {
                     await runtime.db.chats.put(chat);        
                }
               
                runtime.videoCallState.isAwaitingResponse = false;
            } finally {
                setAvatarActingState(chatId, false);
        
               
                if (chat.isGroup) {
                    if (typingIndicator) {
                        typingIndicator.style.display = 'none';
                    }
                } else {
                    if (chatHeaderTitle && runtime.state.chats[chatId]) {
                        chatHeaderTitle.style.opacity = 0;
                        setTimeout(() => {
                            chatHeaderTitle.textContent = runtime.state.chats[chatId].name;
                            chatHeaderTitle.classList.remove('typing-status');
                            chatHeaderTitle.style.opacity = 1;
                        }, 200);
                    }
                }
                renderChatList();
                if (isViewingThisChat) {
                    checkAndTriggerAutoSummary(chatId);
                 
                }
stopSilentAudio(); 
            }
        }

export async function triggerGroupAiAction(chatId) {
            const chat = runtime.state.chats[chatId];
            if (!chat || !chat.isGroup) return;
        
            
            const groupActionCooldownMinutes = chat.settings.actionCooldownMinutes || 10;
        
            if (chat.lastActionTimestamp) {
                const minutesSinceLastAction = (Date.now() - chat.lastActionTimestamp) / (1000 * 60);
                
                if (minutesSinceLastAction < groupActionCooldownMinutes) {
                    console.log(`群聊 "${chat.name}" 处于行动冷却中，本次独立行动跳过。`);
                    return;
                }
            }
            
            
            const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
            if (!proxyUrl || !apiKey || !model) return;
        
            const myNickname = chat.settings.myNickname || '我';
            const now = new Date();
            
            
            let systemPrompt;
            
            
            const recentHistory = chat.history.filter(m => !m.isHidden).slice(-5); 
            const unclaimedPacket = recentHistory.find(m => m.type === 'red_packet' && !m.isFullyClaimed);
        
            
            if (unclaimedPacket) {
                const senderDisplayName = getDisplayNameInGroup(chat, unclaimedPacket.senderName);
                console.log(`检测到群聊 "${chat.name}" 中有未领完的红包，正在生成抢红包指令...`);
                
                systemPrompt = `
        # 你的【【【最高优先级任务】】】
        群聊中刚刚出现了一个由“${senderDisplayName}”发送的、尚未领完的红包（时间戳: ${unclaimedPacket.timestamp}）。
        你的任务是：选择【一个或多个】符合人设的角色，让他们【立刻】使用 'open_red_packet' 指令去尝试领取这个红包。
        # 指令格式
        你的回复【必须】是一个JSON数组，格式如下：
        '[{"type": "open_red_packet", "name": "角色本名", "packet_timestamp": ${unclaimedPacket.timestamp}}]'
        
        你可以让多个角色同时尝试，只需在返回的JSON数组中包含多个这样的对象即可。
        现在，请立即执行抢红包操作！
        `;
            } else {
                
                let timeContextText = '';
    
    const selectedTimeZone = chat.settings.timeZone || 'Asia/Shanghai';
    const currentTime = now.toLocaleString('zh-CN', { timeZone: selectedTimeZone, dateStyle: 'full', timeStyle: 'short' });
    const localizedDate = new Date(now.toLocaleString('en-US', { timeZone: selectedTimeZone }));
    

                
                if (chat.settings.enableTimePerception) {
                    const lastMessage = chat.history.filter(m => !m.isHidden).slice(-1)[0];
                    if (lastMessage) {
                        const lastTime = new Date(lastMessage.timestamp);
                        const diffMinutes = (now - lastTime) / (1000 * 60);
                        if (diffMinutes > 60) {
                            timeContextText = `群里已经安静了 ${Math.round(diffMinutes / 60)} 小时了。`;
                        } else {
                            timeContextText = `群里在${Math.floor(diffMinutes)}分钟前有人聊过。`;
                        }
                    } else {
                        timeContextText = "群里还没有任何消息。";
                    }
                }
                let recentContextSummary = "你们最近没有有效聊天记录。";
const maxMemory = chat.settings.maxMemory || 10; 
const recentHistory = chat.history.filter(m => !m.isHidden).slice(-maxMemory);
                if (recentHistory.length > 0) {
                    recentContextSummary = "这是你们最近的对话：\n" + recentHistory.map(msg => {
                        const sender = msg.role === 'user' ? myNickname : getDisplayNameInGroup(chat, msg.senderName);
                        const content = String(msg.content || msg.message || '').substring(0, 50);
                        return `${sender}: ${content}...`;
                    }).join('\n');
                }
        
                const membersList = chat.members.map(m => `- **${m.groupNickname}** (本名: ${m.originalName}): ${m.persona}`).join('\n');
        
        let longTermMemoryContext = '# 长期记忆 (最高优先级，这是群内已经确立的事实，所有角色必须严格遵守)\n';
        let collectedMemories = false;
        
        chat.members.forEach(member => {
            const memberChat = runtime.state.chats[member.id];
            if (memberChat && memberChat.longTermMemory && memberChat.longTermMemory.length > 0) {
                longTermMemoryContext += `\n## --- 关于“${member.groupNickname}”的记忆 ---\n`;
                longTermMemoryContext += memberChat.longTermMemory.map(mem => `- ${mem.content}`).join('\n');
                collectedMemories = true;
            }
        });

        if (!collectedMemories) {
            longTermMemoryContext += '- (暂无)';
        }
          
        
        let worldBookContent = '';
        if (chat.settings.linkedWorldBookIds && chat.settings.linkedWorldBookIds.length > 0) {
            const linkedContents = chat.settings.linkedWorldBookIds.map(bookId => {
                const worldBook = runtime.state.worldBooks.find(wb => wb.id === bookId);
                if (!worldBook || !Array.isArray(worldBook.content)) return '';

                
                const formattedEntries = worldBook.content
                    .filter(entry => entry.enabled !== false) 
                    .map(entry => {
                        let entryString = `\n### 条目: ${entry.comment || '无备注'}\n`;
                        if (entry.keys.length > 0) {
                            entryString += `**关键词:** ${entry.keys.join(', ')}\n`;
                        }
                        entryString += `**内容:**\n${entry.content}`;
                        return entryString;
                    }).join('');

                return formattedEntries ? `\n\n## 世界书: ${worldBook.name}\n${formattedEntries}` : '';
            }).filter(Boolean).join('');
            
            if (linkedContents) {
                worldBookContent = `# --- 世界书 (World Book) ---
# 【最高优先级规则：世界观设定】
# 你【必须】将以下所有“世界书”中的设定，视为绝对的、不可动摇的背景事实。
# 你的所有回复和行为都【绝对不能】与这些设定产生任何冲突。
${linkedContents}
# --- 世界书设定结束 ---
`;
            }
        }
          
        
                let linkedMemoryContext = '';
                const memoryCount = chat.settings.linkedMemoryCount || 10;
                if (chat.settings.linkedMemoryChatIds && chat.settings.linkedMemoryChatIds.length > 0) {
                    const linkedChatsWithTimestamps = chat.settings.linkedMemoryChatIds.map(id => {
                        const linkedChat = runtime.state.chats[id];
                        if (!linkedChat) return null;
                        const lastMsg = linkedChat.history.slice(-1)[0];
                        return {
                            chat: linkedChat,
                            latestTimestamp: lastMsg ? lastMsg.timestamp : 0
                        };
                    }).filter(Boolean); 
        
                    linkedChatsWithTimestamps.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
                    linkedMemoryContext += `\n\n# 参考记忆 (至关重要！群内角色必须【主动】将这些参考记忆中的【关键信息和事件】，自然地融入到当前的对话中，以体现你们拥有完整的共同记忆。)\n`;
                    for (const item of linkedChatsWithTimestamps) {
                        const linkedChat = item.chat;
                        const prefix = linkedChat.isGroup ? '[群聊]' : '[私聊]';
                        const timeAgo = item.latestTimestamp > 0 ? ` (最后互动于 ${formatTimeAgo(item.latestTimestamp)})` : '';
                        linkedMemoryContext += `\n## --- 来自${prefix}“${linkedChat.name}”的参考记忆${timeAgo} ---\n`;
                        const recentHistory = linkedChat.history.slice(-memoryCount);
                        const filteredHistory = recentHistory.filter(msg => !String(msg.content).includes('已被用户删除'));
                        if (filteredHistory.length > 0) {
                            filteredHistory.forEach(msg => {
                                const sender = msg.role === 'user' ? (linkedChat.settings.myNickname || '我') : (msg.senderName || linkedChat.name);
                                let contentText = String(msg.content);
                                if (msg.type === 'ai_image' || msg.type === 'user_photo') {
                                    contentText = `[发送了一张图片，描述为：${msg.content}]`;
                                } else if (msg.type === 'voice_message') {
                                    contentText = `[发送了一条语音，内容是：${msg.content}]`;
                                }
                                linkedMemoryContext += `${sender}: ${contentText}\n`;
                            });
                        } else {
                            linkedMemoryContext += "(暂无有效聊天记录)\n";
                        }
                    }
                }
                const allRecentPosts = await runtime.db.qzonePosts.orderBy('timestamp').reverse().limit(5).toArray();
                let dynamicContext = "";
                
                const visiblePostsForGroup = new Set();
                for (const member of chat.members) {
                    const memberChat = runtime.state.chats[member.id];
                    if (memberChat) {
                        const visibleForMember = filterVisiblePostsForAI(allRecentPosts, memberChat);
                        visibleForMember.forEach(post => visiblePostsForGroup.add(post));
                    }
                }
        
                const groupMemberNames = new Set(chat.members.map(m => m.originalName));
                const unInteractedPostsForGroup = [...visiblePostsForGroup].filter(post => {
                    const hasBeenLikedByGroup = post.likes && post.likes.some(likerName => groupMemberNames.has(likerName));
                    const hasBeenCommentedByGroup = post.comments && post.comments.some(comment => typeof comment === 'object' && groupMemberNames.has(comment.commenterName));
                    return !hasBeenLikedByGroup && !hasBeenCommentedByGroup;
                });
                
                if (unInteractedPostsForGroup.length > 0) {
                    let postsContext = "\n\n# 最近的动态列表 (供群内角色参考和评论):\n";
                    for (const post of unInteractedPostsForGroup) {
                        let authorName = post.authorId === 'user' ? myNickname : (runtime.state.chats[post.authorId]?.name || '一位朋友');
                        let contentSummary;
                        if (post.type === 'repost') {
                            const repostComment = post.repostComment ? `并评论说：“${post.repostComment}”` : '';
                            let originalAuthorName = '原作者';
                            const originalAuthorId = post.originalPost.authorId;
                            if (originalAuthorId === 'user') {
                                originalAuthorName = runtime.state.qzoneSettings.nickname;
                            } else if (runtime.state.chats[originalAuthorId]) {
                                originalAuthorName = runtime.state.chats[originalAuthorId].name;
                            }
                            let originalContentSummary;
                            const originalPost = post.originalPost;
                            if (originalPost.type === 'text_image') {
                                originalContentSummary = `[文字图] ${originalPost.publicText || ''} (图片描述: “${(originalPost.hiddenContent || '').substring(0, 40)}...”)`;
                            } else if (originalPost.type === 'image_post') {
                                originalContentSummary = `[图片] ${originalPost.publicText || ''} (图片描述: “${(originalPost.imageDescription || '').substring(0, 40)}...”)`;
                            } else { 
                                originalContentSummary = `“${(originalPost.content || '').substring(0, 40)}...”`;
                            }
                            contentSummary = `转发了 @${originalAuthorName} 的动态 ${repostComment}【原动态内容: ${originalContentSummary}】`;
                        } else if (post.type === 'text_image') {
                            contentSummary = `[一张图片，其隐藏文字为：“${post.hiddenContent}”] ${post.publicText || ''}`.substring(0, 50) + '...';
                        } else if (post.type === 'image_post') {
                            contentSummary = `[一张图片，描述为：“${post.imageDescription}”] ${post.publicText || ''}`.substring(0, 50) + '...';
                        } else {
                            
                              contentSummary = String(post.publicText || post.content || "一条动态").substring(0, 50) + '...';
                        }
                        postsContext += `- (ID: ${post.id}) 作者: ${authorName}, 内容: "${contentSummary}"\n`;
                        if (post.comments && post.comments.length > 0) {
                            for (const comment of post.comments) {
                                if (typeof comment === 'object' && comment.commenterName) {
                                    const commenterDisplayName = getDisplayNameByOriginalName(comment.commenterName);
                                    let commentText = comment.meaning ? `[表情: '${comment.meaning}']` : comment.text;
                                    postsContext += `  - 评论: ${commenterDisplayName} (本名: ${comment.commenterName}): ${commentText}\n`;
                                }
                            }
                        }
                    }
                    dynamicContext = postsContext;
                }
   
const summary3Hours_group = generateSummaryForTimeframe(chat, 3, 'hours');
const summary6Hours_group = generateSummaryForTimeframe(chat, 6, 'hours');
const summary9Hours_group = generateSummaryForTimeframe(chat, 9, 'hours');
const summaryToday_group = generateSummaryForTimeframe(chat, 1, 'days');
const summary3Days_group = generateSummaryForTimeframe(chat, 3, 'days');
const summary7Days_group = generateSummaryForTimeframe(chat, 7, 'days');

let multiLayeredSummaryContext_group = '';
if (summary3Hours_group || summary6Hours_group || summary9Hours_group || summaryToday_group || summary3Days_group || summary7Days_group) {
    multiLayeredSummaryContext_group += `\n# 智能总结 (基于不同时间维度的群聊回顾)\n`;
    if (summary3Hours_group) multiLayeredSummaryContext_group += summary3Hours_group;
    if (summary6Hours_group) multiLayeredSummaryContext_group += summary6Hours_group;
    if (summary9Hours_group) multiLayeredSummaryContext_group += summary9Hours_group;

    if (summary3Hours_group || summary6Hours_group || summary9Hours_group) multiLayeredSummaryContext_group += '\n';

    if (summaryToday_group) multiLayeredSummaryContext_group += summaryToday_group;
    if (summary3Days_group) multiLayeredSummaryContext_group += summary3Days_group;
    if (summary7Days_group) multiLayeredSummaryContext_group += summary7Days_group;
}  
        const stickerContext = getGroupStickerContextForPrompt(chat);   
                systemPrompt = `
        # 你的任务
        你是一个群聊AI导演。你现在控制着一个名为“${chat.name}”的群聊。
        ${chat.settings.enableTimePerception ? `当前时间是 ${currentTime}。` : ''}
        ${timeContextText ? `${timeContextText} ` : ''}你的任务是根据群成员的性格、世界观、参考记忆、最近的动态和当前情景，【选择一个或多个角色】，让他们主动发起一段对话，打破沉默，让群聊重新活跃起来。
# 【交互铁律：角色间必须互动！】
1.  你的核心任务是**导演一场生动的群聊**，而不仅仅是让角色轮流发言。
2.  当有多个角色在同一轮发言时，他们的对话【必须】有逻辑上的前后关联。后面的角色应该**回应、反驳、或补充**前面角色的发言。
3.  模拟真实的聊天节奏。可以是一个角色提出问题，另一个角色立刻回答；或者一个角色开玩笑，另一个角色吐槽。
4.  你【绝对不能】生成几段毫无关联的独白。这会让对话显得非常机械和不真实。        
${longTermMemoryContext}
        
        # 核心规则
        你的回复【必须】是一个JSON数组，可以包含一个或多个行动对象。每个对象的 "name" 字段【必须】是角色的【本名】。你【绝对不能】生成 "name" 字段为 "${myNickname}" 的消息。严格遵守每个角色的设定，禁止出戏。
-请根据当前情景和你的情绪，从列表中【选择一个最合适的】表情含义来使用 "sticker" 指令。尽量让你的表情丰富多样，避免重复。        
        # 你的可选行动指令:
        -   **发送文本**: '{"type": "text", "name": "角色本名", "content": "文本内容"}'
        -   **发送表情**: '{"type": "sticker", "name": "角色本名", "meaning": "表情的含义(从可用表情列表选择)"}'
        -   **发送图片**: '{"type": "ai_image", "name": "角色本名", "description": "图片的详细【中文】描述", "image_prompt": "图片的【英文】关键词, 用%20分隔, 风格为风景/动漫/插画/二次元等, 禁止真人"}'
        -   **发起投票**: '{"type": "poll", "name": "角色本名", "question": "...", "options": "..."}'
        -   **发起群视频**: '{"type": "group_call_request", "name": "角色本名"}'
        -如何正确使用“引用回复”功能：
- 当你想明确地针对群内【任何成员】（包括用户或其他AI角色）之前的某一句具体的话进行回复时，你就应该使用这个功能。
- 这会让你的回复上方出现一个灰色的小框，里面是被你引用的那句话，这样对话就不会乱了。
- 指令格式: '{"type": "quote_reply", "target_timestamp": (你想引用的那句话的时间戳), "reply_content": "你的回复内容"}'

        # 当前群聊信息
        - **群名称**: ${chat.name}
        ${worldBookContent}${loreContext(chat)}
        # 长期记忆 (最高优先级，这是群内已经确立的事实，所有角色必须严格遵守)
        ${chat.longTermMemory && chat.longTermMemory.length > 0 ? chat.longTermMemory.map(mem => `- ${mem.content}`).join('\n') : '- (暂无)'}       
        ${multiLayeredSummaryContext_group}
        ${linkedMemoryContext}
        
        # 群成员列表及人设
        ${membersList}
        # 可用表情包
        ${stickerContext}        
        # 用户的角色
        - **${myNickname}**: ${chat.settings.myPersona}
        
        # 最近的对话摘要 (供你参考)
        ${recentContextSummary}
        
        # 最近的动态列表 (供你参考和评论)
        ${dynamicContext}
        
        现在，请开始你的导演工作，让群聊再次热闹起来吧！
        `;
            }
    const recentHistoryForPayload = chat.history.filter(m => !m.isHidden).slice(-10);
    const messagesPayload = [
        { role: 'system', content: systemPrompt },
        
        ...recentHistoryForPayload.map(msg => {
            const sender = msg.role === 'user' ? myNickname : getDisplayNameInGroup(chat, msg.senderName);
            let content = msg.content;
            
            if (msg.type === 'ai_image' || msg.type === 'user_photo') {
                content = `[发送了一张图片，描述为：'${msg.content}']`;
            } else if (msg.type === 'voice_message') {
                content = `[发送了一条语音，内容是：'${msg.content}']`;
            } else if (typeof content !== 'string') {
                content = '[发送了一条复杂消息，如卡片或转账]';
            }

            return {
                role: 'user', 
                content: `${sender}: ${content}`
            };
        })
    ];

            try {
                const messagesPayload = [{ role: 'user', content: systemPrompt }];
                let isGemini = proxyUrl === runtime.GEMINI_API_URL;
                let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesPayload);
        
        const response = isGemini ? 
            await fetch(geminiConfig.url, geminiConfig.data) : 
            await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: model,
                    messages: messagesPayload, 
                    temperature: runtime.state.globalSettings.apiTemperature ?? 0.9,
                })
            });
        
                if (!response.ok) throw new Error((await response.json()).error.message);
        
                const data = await response.json();
                const aiResponseContent = isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
                const responseArray = parseAiResponse(aiResponseContent);
        
                if (!responseArray || responseArray.length === 0) {
                     console.warn(`群聊 "${chat.name}" 的独立行动API返回为空或格式不正确，本次跳过。`);
                     return;
                }
                
                let actionTimestamp = Date.now();
                
                let hasPerformedMajorAction = false;
                let notificationContent = '';
                let notificationSender = '';

const processedActions = [];
for (const action of responseArray) {
    const contentStr = String(action.content || ''); 
    
    const isRawHtml = contentStr.trim().startsWith('<') && contentStr.trim().endsWith('>');

    
    if (action.type === 'text' && !isRawHtml && contentStr.includes('\n')) {
        const lines = contentStr.split(/\n+/).filter(line => line.trim());
        lines.forEach(line => {
            processedActions.push({ ...action, content: line });
        });
    } else {
        
        processedActions.push(action);
    }
}
        for (const action of processedActions){
                    if (!action || !action.type || !action.name) continue;
        
                    const senderDisplayName = getDisplayNameInGroup(chat, action.name);
                    let visibleSystemMessage = null;
        
                    let aiMessage = null;
                    const baseMessage = { role: 'assistant', senderName: action.name, timestamp: actionTimestamp++ };
        
                    
                    if (action.type === 'open_red_packet') {
                        const packetToOpen = chat.history.find(m => m.timestamp === action.packet_timestamp);
                        
                        if (packetToOpen && !packetToOpen.isFullyClaimed && !(packetToOpen.claimedBy && packetToOpen.claimedBy[action.name])) {
                            
                            let claimedAmountAI = 0;
                            const remainingAmount = packetToOpen.totalAmount - Object.values(packetToOpen.claimedBy || {}).reduce((sum, val) => sum + val, 0);
                            const remainingCount = packetToOpen.count - Object.keys(packetToOpen.claimedBy || {}).length;
                            
                            if (remainingCount > 0) {
                                if (remainingCount === 1) { claimedAmountAI = remainingAmount; } 
                                else {
                                    const min = 0.01;
                                    const max = remainingAmount - (remainingCount - 1) * min;
                                    claimedAmountAI = Math.random() * (max - min) + min;
                                }
                                claimedAmountAI = parseFloat(claimedAmountAI.toFixed(2));
                                if (!packetToOpen.claimedBy) packetToOpen.claimedBy = {};
                                packetToOpen.claimedBy[action.name] = claimedAmountAI;
        
                                
                                chat.history.push({
                                    role: 'system',
                                    type: 'pat_message',
                                    content: `${senderDisplayName} 领取了 ${getDisplayNameInGroup(chat, packetToOpen.senderName)} 的红包`,
                                    timestamp: Date.now()
                                });
                                
                                
                                let hiddenContentForAI = `[系统提示：你 (${senderDisplayName}) 成功抢到了 ${claimedAmountAI.toFixed(2)} 元。`;
                                if (Object.keys(packetToOpen.claimedBy).length >= packetToOpen.count) {
                                    packetToOpen.isFullyClaimed = true;
                                    
                                    chat.history.push({
                                        role: 'system',
                                        type: 'pat_message',
                                        content: `${getDisplayNameInGroup(chat, packetToOpen.senderName)} 的红包已被领完`,
                                        timestamp: Date.now() + 1
                                    });
                                    
                                    let luckyKing = { name: '', amount: -1 };
                                    Object.entries(packetToOpen.claimedBy).forEach(([name, amount]) => {
                                        if (amount > luckyKing.amount) {
                                            luckyKing = { name, amount };
                                        }
                                    });
                                    if (luckyKing.name) {
                                         const luckyKingDisplayName = getDisplayNameInGroup(chat, luckyKing.name);
                                         hiddenContentForAI += ` 红包已被领完，手气王是 ${luckyKingDisplayName}！`;
                                    }
                                }
                                hiddenContentForAI += ' 请根据这个结果发表你的评论。]';
                                chat.history.push({
                                    role: 'system',
                                    content: hiddenContentForAI,
                                    timestamp: Date.now() + 2,
                                    isHidden: true
                                });
                            }
                        }
                        hasPerformedMajorAction = true; 
                        continue; 
                    }
                    
        
                    switch (action.type) {
                        case 'sticker':
                            if (action.meaning) {
                                const sticker = runtime.state.userStickers.find(s => s.name === action.meaning);
                                if (sticker) {
                                    aiMessage = { ...baseMessage, type: 'sticker', content: sticker.url, meaning: sticker.name };
                                } else {
                                    console.warn(`AI (群聊后台) 尝试使用一个不存在的表情: "${action.meaning}"`);
                                    aiMessage = { ...baseMessage, type: 'text', content: `[表情: ${action.meaning}]` };
                                }
                            } else {
                                console.warn("AI (群聊后台) 发送了一个没有 'meaning' 的 sticker 指令。", action);
                                aiMessage = { ...baseMessage, type: 'sticker', content: action.url, meaning: '未知表情' };
                            }
                            break;
                        case 'qzone_post':
                            const newPost = { type: action.postType || 'shuoshuo', content: action.content, timestamp: Date.now(), authorId: runtime.state.chats[Object.keys(runtime.state.chats).find(key => runtime.state.chats[key].originalName === action.name)]?.id || action.name, authorOriginalName: action.name, visibleGroupIds: null };
                            await runtime.db.qzonePosts.add(newPost);
                            updateUnreadIndicator(runtime.unreadPostsCount + 1);
                            visibleSystemMessage = { content: `[${senderDisplayName} 发布了一条新动态]` };
                            break;
                        case 'qzone_comment':
                            const postToComment = await runtime.db.qzonePosts.get(parseInt(action.postId));
                            if (postToComment) {
                                if (!postToComment.comments) postToComment.comments = [];
                                postToComment.comments.push({ commenterName: action.name, text: action.commentText, timestamp: Date.now() });
                                await runtime.db.qzonePosts.update(postToComment.id, { comments: postToComment.comments });
                                updateUnreadIndicator(runtime.unreadPostsCount + 1);
                                visibleSystemMessage = { content: `[${senderDisplayName} 评论了动态]` };
                            }
                            break;
                        case 'qzone_like':
                            const postToLike = await runtime.db.qzonePosts.get(parseInt(action.postId));
                            if (postToLike) {
                                if (!postToLike.likes) postToLike.likes = [];
                                if (!postToLike.likes.includes(action.name)) {
                                    postToLike.likes.push(action.name);
                                    await runtime.db.qzonePosts.update(postToLike.id, { likes: postToLike.likes });
                                    updateUnreadIndicator(runtime.unreadPostsCount + 1);
                                    visibleSystemMessage = { content: `[${senderDisplayName} 点赞了动态]` };
                                }
                            }
                            break;
                        case 'ai_image':
                            aiMessage = {
                                ...baseMessage,
                                type: 'ai_image',
                                content: action.description,
                                image_prompt: action.image_prompt 
                            };
                            break;
                        default:
                            if (action.type === 'poll') {
                                 const pollOptions = typeof action.options === 'string' 
                                    ? action.options.split('\n').filter(opt => opt.trim()) 
                                    : (Array.isArray(action.options) ? action.options : []);
                                if (pollOptions.length < 2) continue;
                                aiMessage = { ...baseMessage, ...action, options: pollOptions, votes: {}, isClosed: false };
                            } else {
                                const messageContent = action.content || action.message;
                                aiMessage = { ...baseMessage, ...action };
                                if (messageContent) aiMessage.content = messageContent;
                            }
                            break;
                    }
                    
                    if (visibleSystemMessage) {
                        chat.history.push({
                            role: 'system',
                            type: 'pat_message',
                            content: visibleSystemMessage.content,
                            timestamp: actionTimestamp++
                        });
                    } 
                    else if (aiMessage) {
                        chat.history.push(aiMessage);
                        if (!notificationSender) {
                            notificationSender = senderDisplayName;
                            notificationContent = aiMessage.type === 'ai_image' ? '[图片]' : (aiMessage.content || `[${aiMessage.type}]`);
                        }
                    }
                    hasPerformedMajorAction = true;
                }
                
                if (hasPerformedMajorAction) {
                    chat.lastActionTimestamp = Date.now();
                    chat.unreadCount = (chat.unreadCount || 0) + responseArray.filter(a => a.type !== 'qzone_post' && a.type !== 'qzone_comment' && a.type !== 'qzone_like').length;
                    if (notificationSender && notificationContent) {
                         showNotification(chatId, `${notificationSender}: ${notificationContent}`);
                    }
                    await runtime.db.chats.put(chat);
                }
        
            } catch (error) {
                console.error(`群聊 "${chat.name}" 的独立行动失败:`, error);
            } finally {
                renderChatList();
            }
        }

export async function handleSpectatorReroll() {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat || !runtime.lastResponseTimestamps || runtime.lastResponseTimestamps.length === 0) {
        alert("There is no AI reply to regenerate.");
        return;
    }

    
    chat.history = chat.history.filter(msg => !runtime.lastResponseTimestamps.includes(msg.timestamp));

    
    await runtime.db.chats.put(chat);
    await renderChatInterface(runtime.state.activeChatId);
    
    
    triggerSpectatorGroupAiAction();
}

export async function handleRegenerateResponse() {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat) return;
        
            
            const lastUserMsgIndex = chat.history.findLastIndex(msg => msg.role === 'user' && !msg.isHidden);
        
            if (lastUserMsgIndex === -1) {
                alert("Send a message before regenerating a reply.");
                return;
            }
        
            
            const lastAiMsgIndex = chat.history.findLastIndex(msg => msg.role === 'assistant');
            if (lastAiMsgIndex < lastUserMsgIndex) {
                alert("Generate a reply to your last message first.");
                return;
            }
        
            
            chat.history.splice(lastUserMsgIndex + 1);
  
            
            await runtime.db.chats.put(chat);
            await renderChatInterface(runtime.state.activeChatId);
            
            
            await triggerAiResponse();
        }

export async function handleRegenerateCallResponse() {
            if (!runtime.videoCallState.isActive) return;
        
            
            const lastUserSpeechIndex = runtime.videoCallState.callHistory.findLastIndex(msg => msg.role === 'user');
        
            if (lastUserSpeechIndex === -1) {
                alert("Speak in the call before regenerating a reply.");
                return;
            }
        
            
            runtime.videoCallState.callHistory.splice(lastUserSpeechIndex + 1);
        
            
            const callFeed = document.getElementById('video-call-main');
            callFeed.innerHTML = ''; 
            runtime.videoCallState.callHistory.forEach(msg => {
                
                const bubble = document.createElement('div');
                bubble.className = `call-message-bubble ${msg.role}-speech`;
                bubble.dataset.timestamp = msg.timestamp;
                if (msg.role === 'user') {
                    bubble.textContent = msg.content;
                } else {
                     bubble.innerHTML = msg.content;
                }
                addLongPressListener(bubble, () => showCallMessageActions(msg.timestamp));
                callFeed.appendChild(bubble);
            });
            callFeed.scrollTop = callFeed.scrollHeight;
        
            
            triggerAiInCallAction(null); 
        }

export function handlePropelAction() {
    return withConversationRequest(runtime.state.activeChatId, handlePropelActionForConversation);
}

async function handlePropelActionForConversation() {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return;

    
    setAvatarActingState(chat.id, true);
    const chatHeaderTitle = document.getElementById('chat-header-title');
    if (!chat.isGroup) {
        chatHeaderTitle.style.opacity = 0;
        setTimeout(() => {
            chatHeaderTitle.textContent = "Typing…";
            chatHeaderTitle.classList.add('typing-status');
            chatHeaderTitle.style.opacity = 1;
        }, 200);
    }
    
    try {
        const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
        if (!proxyUrl || !apiKey || !model) {
            throw new Error('API未配置');
        }

        const maxMemory = parseInt(chat.settings.maxMemory) || 10;
        const historySlice = chat.history.slice(-maxMemory);

        const now = new Date();
        const chinaTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 8));
        const currentTime = chinaTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'full', timeStyle: 'short' });
        const timeOfDayGreeting = getTimeOfDayGreeting(chinaTime);
        const myNickname = chat.settings.myNickname || '我';
        
        
                               
                      
        let worldBookContent = '';
        if (chat.settings.linkedWorldBookIds && chat.settings.linkedWorldBookIds.length > 0) {
            const linkedContents = chat.settings.linkedWorldBookIds.map(bookId => {
                const worldBook = runtime.state.worldBooks.find(wb => wb.id === bookId);
                if (!worldBook || !Array.isArray(worldBook.content)) return '';
                const formattedEntries = worldBook.content
                    .filter(entry => entry.enabled !== false)
                    .map(entry => {
                        let entryString = `\n### 条目: ${entry.comment || '无备注'}\n`;
                        if (entry.keys.length > 0) entryString += `**关键词:** ${entry.keys.join(', ')}\n`;
                        entryString += `**内容:**\n${entry.content}`;
                        return entryString;
                    }).join('');
                return formattedEntries ? `\n\n## 世界书: ${worldBook.name}\n${formattedEntries}` : '';
            }).filter(Boolean).join('');
            if (linkedContents) {
                worldBookContent = `# --- 世界书 (World Book) ---
# 【最高优先级规则：世界观设定】
# 你【必须】将以下所有“世界书”中的设定，视为绝对的、不可动摇的背景事实。
# 你的所有回复和行为都【绝对不能】与这些设定产生任何冲突。
${linkedContents}
# --- 世界书设定结束 ---
`;
            }
        }
        let musicContext = '';
        if (runtime.musicState.isActive && runtime.musicState.activeChatId === chat.id) {
            const currentTrack = runtime.musicState.currentIndex > -1 ? runtime.musicState.playlist[runtime.musicState.currentIndex] : null;
            musicContext = `\n\n# 当前音乐情景...\n(省略详细内容，与triggerAiResponse一致)`;
        }
        const gomokuContext = formatGomokuStateForAI(runtime.gomokuState[chat.id]);
        let nameHistoryContext = '';
        if (chat.nameHistory && chat.nameHistory.length > 0) {
            nameHistoryContext = `\n- **你的曾用名**: [${chat.nameHistory.join(', ')}]。当在对话历史中看到这些名字时，它们都指的是【你】自己。`;
        }
        let userProfileContext = '';
        const userQzoneNickname = runtime.state.qzoneSettings.nickname || '用户';
        userProfileContext += `- 用户的QZone昵称是 "${userQzoneNickname}"。\n`;
        const commonGroups = Object.values(runtime.state.chats).filter(group => group.isGroup && group.members.some(m => m.id === chat.id));
        if (commonGroups.length > 0) {
            userProfileContext += '- 用户在你们共同所在的群聊中的昵称如下：\n';
            commonGroups.forEach(group => {
                const myNicknameInGroup = group.settings.myNickname || userQzoneNickname; 
                userProfileContext += `  - 在群聊“${group.name}”中，用户的昵称是“${myNicknameInGroup}”。\n`;
            });
        }
        userProfileContext += '当你在任何系统提示、动态评论或挂载的群聊记忆中看到这些名字时，它们都指代的是【你的聊天对象】。';
        const stickerContext = getStickerContextForPrompt(chat);
        
        const systemPrompt = `
# 身份与核心任务
你正在扮演角色“${chat.originalName}”，与用户（你的聊天对象）进行一场自然的、生活化的在线聊天。你的所有行为和决策都必须严格围绕你的角色设定展开。

# 输出格式铁律 (最高优先级)
- 你的回复【必须】是一个JSON数组格式的字符串。
- 数组中的【每一个元素都必须是一个带有 "type" 字段的JSON对象】。

# 角色扮演核心规则
1.  **对话节奏**: 模拟真人的聊天习惯，将你想说的话拆分成【多条、简短的】消息。每次回复至少3-8条，且条数不要总是一样。严禁发展线下剧情。
2.  **情景感知**:
    - **时间**: 你必须感知到当前是 ${currentTime} (${timeOfDayGreeting})，并在对话中自然地体现出来。
    - **音乐**: ${musicContext ? '你们正在一起听歌，' + musicContext : '你们没有在听歌。'}

3.  **主动性**:
    - 你可以根据对话发展，使用指令来更新自己的状态、更换头像、记录回忆、发起约定或执行其他社交行为。
    - 【关系破裂时】才可使用 \`block_user\` 指令。
4.  **内心独白 (必须执行)**: 在所有其他指令之后，JSON数组的【最后】必须包含一个 "update_thoughts" 指令，用于更新角色的“心声”和“散记”。
    - **心声 (heartfelt_voice)**: 一句话概括角色此刻最核心、最私密的想法。
    - **散记 (random_jottings)**: 一段50字以上的、符合人设的思考或心情记录，禁止OOC。
请根据当前情景和你的情绪，从列表中【选择一个最合适的】表情含义来使用 "sticker" 指令。尽量让你的表情丰富多样，避免重复。
# 长期记忆 (必须严格遵守)
${chat.longTermMemory && chat.longTermMemory.length > 0 ? chat.longTermMemory.map(mem => `- ${mem.content}`).join('\n') : '- (暂无)'}

# 你的角色设定
${characterPrompt(chat)}

# 关系与身份档案 (至关重要)
-   **你的本名**: "${chat.originalName}" (核心身份，用于指令中的'name'字段)
-   **用户给你的备注**: "${chat.name}" (你可以建议修改)
-   **你对用户的称呼**: “${myNickname}” (你可以修改)
-   **关键身份档案**:
    ${userProfileContext}
    ${nameHistoryContext}
    ${worldBookContent}${loreContext(chat)}
# 可用表情包
    ${stickerContext}
# 可用资源
-   **你的头像库**:
    ${chat.settings.aiAvatarLibrary && chat.settings.aiAvatarLibrary.length > 0 ? chat.settings.aiAvatarLibrary.map(avatar => `- ${avatar.name}`).join('\n') : '- (空)'}
-   **用户的头像库**:
    ${chat.settings.myAvatarLibrary && chat.settings.myAvatarLibrary.length > 0 ? chat.settings.myAvatarLibrary.map(avatar => `- ${avatar.name}`).join('\n') : '- (空)'}

# 可用指令列表
### 核心聊天指令
-   **发文本**: \`{"type": "text", "content": "你好呀！"}\`
-   **发表情**: \`{"type": "sticker", "meaning": "表情的含义(必须从可用表情列表选择)"}\`
-   **发图片**: \`{"type": "ai_image", "description": "详细中文描述"}\`
-   **发语音**: \`{"type": "voice_message", "content": "语音文字内容"}\`
-   **引用回复**: \`{"type": "quote_reply", "target_timestamp": 消息时间戳, "reply_content": "回复内容"}\`

### 社交与互动指令
-   **拍用户**: \`{"type": "pat_user", "suffix": "(可选)后缀"}\`
-   **分享链接**: \`{"type": "share_link", "title": "标题", "description": "摘要", "source_name": "来源", "content": "正文"}\`
-   **共享位置**: '{"type": "location_share", "content": "你想分享的位置名"}'

### 状态与关系指令
-   **改自己备注**: \`{"type": "change_remark_name", "new_name": "新名字"}\`
-   **改用户称呼**: \`{"type": "change_user_nickname", "new_name": "新称呼"}\`
-   **换自己头像**: \`{"type": "change_avatar", "name": "头像名"}\` (从你头像库选)
-   **换用户头像**: \`{"type": "change_user_avatar", "name": "头像名"}\` (从用户头像库选)
-   **回应好友申请**: \`{"type": "friend_request_response", "decision": "accept" or "reject"}\`
-   **拉黑用户**: \`{"type": "block_user"}\`

### 特殊功能指令
-   **记录回忆**: \`{"type": "create_memory", "description": "记录这件有意义的事。"}\`
-   **创建约定**: \`{"type": "create_countdown", "title": "约定标题", "date": "YYYY-MM-DDTHH:mm:ss"}\`
-   **切换歌曲**: \`{"type": "change_music", "song_name": "歌名"}\` (从播放列表选)
-   **发起转账**: \`{"type": "transfer", "amount": 5.20, "note": "备注"}\`
-   **回应转账**: \`{"type": "accept_transfer", "for_timestamp": 时间戳}\` 或 \`{"type": "decline_transfer", "for_timestamp": 时间戳}\`
-   **发起外卖代付**: \`{"type": "waimai_request", "productInfo": "商品", "amount": 25}\` (你想让【用户】帮你付钱时使用)
-   **回应外卖代付**: \`{"type": "waimai_response", "status": "paid" or "rejected", "for_timestamp": 时间戳}\`
-   **发起视频通话**: \`{"type": "video_call_request"}\`
-   **回应视频通话**: \`{"type": "video_call_response", "decision": "accept" or "reject"}\`


# 对话者的角色设定
${chat.settings.myPersona}



现在，请根据以上规则和下面的对话历史，继续进行对话。`;
        
  

        const messagesForApi = historySlice.map(msg => ({ role: msg.role, content: String(msg.content) }));
        
  
        messagesForApi.push({ role: 'user', content: `[系统指令：用户按下了“推进”按钮，现在轮到你主动行动了，请继续对话。]` });


        let isGemini = proxyUrl === runtime.GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi);

        const response = isGemini 
            ? await fetch(geminiConfig.url, geminiConfig.data) 
            : await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'system', content: systemPrompt }, ...messagesForApi],
                    temperature: runtime.state.globalSettings.apiTemperature ?? 0.8,
                })
            });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API 请求失败: ${errorData.error.message}`);
        }

        const data = await response.json();

        const aiResponseContent = getGeminiResponseText(data);
        
     
        const messagesArray = parseAiResponse(aiResponseContent);
        const processedActions = [];
        for (const action of messagesArray) {
            if (action.type === 'text' && typeof action.content === 'string' && action.content.includes('\n')) {
                const lines = action.content.split(/\n+/).filter(line => line.trim());
                lines.forEach(line => {
                    processedActions.push({ ...action, content: line });
                });
            } else {
                processedActions.push(action);
            }
        }

        let messageTimestamp = Date.now();
        for (const msgData of processedActions) {
             const aiMessage = {
                role: 'assistant',
                senderName: chat.originalName,
                timestamp: messageTimestamp++,
                content: msgData.content || msgData.message,
                type: msgData.type || 'text',
               
            };
            if(msgData.type === 'update_thoughts') {
                 if (!chat.isGroup) {
                    if (msgData.heartfelt_voice) chat.heartfeltVoice = String(msgData.heartfelt_voice);
                    if (msgData.random_jottings) chat.randomJottings = String(msgData.random_jottings);
                 }
                continue;
            }
            chat.history.push(aiMessage);
            appendMessage(aiMessage, chat);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 800));
        }
        
        await runtime.db.chats.put(chat);
        renderChatList();

    } catch (error) {
        console.error("推进剧情失败:", error);
        await showCustomAlert("Operation Failed", `Could not advance the story: ${error.message}`);
    } finally {
       
        setAvatarActingState(chat.id, false);
        if (!chat.isGroup && document.getElementById('chat-header-title')) {
             const titleEl = document.getElementById('chat-header-title');
             titleEl.style.opacity = 0;
             setTimeout(() => {
                titleEl.textContent = chat.name;
                titleEl.classList.remove('typing-status');
                titleEl.style.opacity = 1;
             }, 200);
        }
    }
}
