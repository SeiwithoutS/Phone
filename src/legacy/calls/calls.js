import { openAiUrl } from '../../features/api/endpoints'
import { parseAiResponse, toGeminiRequestData } from '../api/client.js'
import { triggerAiResponse } from '../chat/ai.js'
import { renderCallHistoryScreen } from '../chat/attachments.js'
import { openChat, renderChatInterface } from '../chat/conversation.js'
import { renderChatList } from '../chat/list.js'
import { addLongPressListener, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { summarizeCallTranscript } from '../memories/memories.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'

export async function handleInitiateCall() {
            if (!runtime.state.activeChatId || runtime.videoCallState.isActive || runtime.videoCallState.isAwaitingResponse) return;
        
            const chat = runtime.state.chats[runtime.state.activeChatId];
            runtime.videoCallState.isGroupCall = chat.isGroup;
            runtime.videoCallState.isAwaitingResponse = true;
            runtime.videoCallState.initiator = 'user';
            runtime.videoCallState.activeChatId = chat.id;
            runtime.videoCallState.isUserParticipating = true; 
        
            
            if (chat.isGroup) {
                document.getElementById('outgoing-call-avatar').src = chat.settings.myAvatar || runtime.defaultMyGroupAvatar;
                document.getElementById('outgoing-call-name').textContent = chat.settings.myNickname || "Me";
            } else {
                document.getElementById('outgoing-call-avatar').src = chat.settings.aiAvatar || runtime.defaultAvatar;
                document.getElementById('outgoing-call-name').textContent = chat.name;
            }
            document.querySelector('#outgoing-call-screen .caller-text').textContent = chat.isGroup ? "Calling group members…" : "Calling…";
            showScreen('outgoing-call-screen');
            
            
            const requestMessage = {
                role: 'system',
                content: chat.isGroup 
                    ? `[系统提示：用户 (${chat.settings.myNickname || '我'}) 发起了群视频通话请求。请你们各自决策，并使用 "group_call_response" 指令，设置 "decision" 为 "join" 或 "decline" 来回应。]`
                    : `[系统提示：用户向你发起了视频通话请求。请根据你的人设，使用 "video_call_response" 指令，并设置 "decision" 为 "accept" 或 "reject" 来回应。]`,
                timestamp: Date.now(),
                isHidden: true,
            };
            chat.history.push(requestMessage);
            await runtime.db.chats.put(chat);
            
            
            await triggerAiResponse();
        }

export function startVideoCall() {
            const chat = runtime.state.chats[runtime.videoCallState.activeChatId];
            if (!chat) return;
        
            runtime.videoCallState.isActive = true;
            runtime.videoCallState.isAwaitingResponse = false;
            runtime.videoCallState.startTime = Date.now();
            runtime.videoCallState.callHistory = []; 
        
            
            const preCallHistory = chat.history.slice(-10); 
            runtime.videoCallState.preCallContext = preCallHistory.map(msg => {
                const sender = msg.role === 'user' ? (chat.settings.myNickname || '我') : (msg.senderName || chat.name);
                return `${sender}: ${String(msg.content).substring(0, 50)}...`;
            }).join('\n');
            
        
            updateParticipantAvatars(); 
            
            document.getElementById('video-call-main').innerHTML = `<em>${runtime.videoCallState.isGroupCall ? '群聊已建立...' : '正在接通...'}</em>`;
            showScreen('video-call-screen');
        
            document.getElementById('user-speak-btn').style.display = runtime.videoCallState.isUserParticipating ? 'block' : 'none';
            document.getElementById('join-call-btn').style.display = runtime.videoCallState.isUserParticipating ? 'none' : 'block';
        
            if (runtime.callTimerInterval) clearInterval(runtime.callTimerInterval);
            runtime.callTimerInterval = setInterval(updateCallTimer, 1000);
            updateCallTimer();
        
            triggerAiInCallAction();
        }

export async function endVideoCall() {
    if (!runtime.videoCallState.isActive) return;

    const duration = Math.floor((Date.now() - runtime.videoCallState.startTime) / 1000);
    const durationText = `${Math.floor(duration / 60)}分${duration % 60}秒`;
    const endCallText = `通话结束，时长 ${durationText}`;

    const chat = runtime.state.chats[runtime.videoCallState.activeChatId];
    if (chat) {
        
        const participantsData = [];
        if (runtime.videoCallState.isGroupCall) {
            runtime.videoCallState.participants.forEach(p => participantsData.push({ name: p.originalName, avatar: p.avatar }));
            if (runtime.videoCallState.isUserParticipating) {
                participantsData.unshift({ name: chat.settings.myNickname || '我', avatar: chat.settings.myAvatar || runtime.defaultMyGroupAvatar });
            }
        } else {
            participantsData.push({ name: chat.name, avatar: chat.settings.aiAvatar || runtime.defaultAvatar });
            participantsData.unshift({ name: '我', avatar: chat.settings.myAvatar || runtime.defaultAvatar });
        }

        const callRecord = {
            chatId: runtime.videoCallState.activeChatId,
            timestamp: Date.now(),
            duration: duration,
            participants: participantsData,
            transcript: [...runtime.videoCallState.callHistory]
        };
        await runtime.db.callRecords.add(callRecord);
        console.log("通话记录已保存:", callRecord);
        
        
        let summaryMessage = {
            role: runtime.videoCallState.initiator === 'user' ? 'user' : 'assistant',
            content: endCallText,
            timestamp: Date.now(),
        };
        if (chat.isGroup && summaryMessage.role === 'assistant') {
            summaryMessage.senderName = runtime.videoCallState.callRequester || chat.members[0]?.originalName || chat.name;
        }
        chat.history.push(summaryMessage);

        
        
        
        
        
        const callTranscriptForAI = runtime.videoCallState.callHistory.map(h => {
            const sender = h.role === 'user' ? (chat.settings.myNickname || '我') : h.senderName;
            return `${sender}: ${h.content}`;
        }).join('\n');
        
        
        
        summarizeCallTranscript(chat.id, callTranscriptForAI);

        
        const hiddenReactionInstruction = {
            role: 'system',
            content: `[系统指令：视频通话刚刚结束。请你以角色的口吻，向用户主动发送一两条消息，来自然地总结这次通话的要点、确认达成的约定，或者表达你的感受。]`,
            timestamp: Date.now() + 1, 
            isHidden: true 
        };
        chat.history.push(hiddenReactionInstruction);

        
        await runtime.db.chats.put(chat);
    }
    
    
    clearInterval(runtime.callTimerInterval);
    runtime.callTimerInterval = null;
    runtime.videoCallState = { isActive: false, isAwaitingResponse: false, isGroupCall: false, activeChatId: null, initiator: null, startTime: null, participants: [], isUserParticipating: true, callHistory: [], preCallContext: "" };
    
    
    if (chat) {
        openChat(chat.id);
        triggerAiResponse();
    }
}

export function updateParticipantAvatars() {
            const grid = document.getElementById('participant-avatars-grid');
            grid.innerHTML = '';
            const chat = runtime.state.chats[runtime.videoCallState.activeChatId];
            if (!chat) return;
        
            let participantsToRender = [];
        
            
            if (runtime.videoCallState.isGroupCall) {
                
                participantsToRender = [...runtime.videoCallState.participants];
                
                if (runtime.videoCallState.isUserParticipating) {
                    participantsToRender.unshift({
                        id: 'user',
                        name: chat.settings.myNickname || '我',
                        avatar: chat.settings.myAvatar || runtime.defaultMyGroupAvatar
                    });
                }
            } else {
                
                participantsToRender.push({
                    id: 'ai',
                    name: chat.name,
                    avatar: chat.settings.aiAvatar || runtime.defaultAvatar
                });
            }
            
            participantsToRender.forEach(p => {
                const wrapper = document.createElement('div');
                wrapper.className = 'participant-avatar-wrapper';
                wrapper.dataset.participantId = p.id;
        const displayName = p.groupNickname || p.name; 
        wrapper.innerHTML = `
            <img src="${p.avatar}" class="participant-avatar" alt="${displayName}">
            <div class="participant-name">${displayName}</div>
        `;
                grid.appendChild(wrapper);
            });
        }

export function handleUserJoinCall() {
            if (!runtime.videoCallState.isActive || runtime.videoCallState.isUserParticipating) return;
            
            runtime.videoCallState.isUserParticipating = true;
            updateParticipantAvatars(); 
        
            
            document.getElementById('user-speak-btn').style.display = 'block';
            document.getElementById('join-call-btn').style.display = 'none';
        
            
            triggerAiInCallAction("[系统提示：用户加入了通话]");
        }

export function updateCallTimer() {
            if (!runtime.videoCallState.isActive) return;
            const elapsed = Math.floor((Date.now() - runtime.videoCallState.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            document.getElementById('call-timer').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

export function showIncomingCallModal() {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat) return;
        
            
            if (chat.isGroup) {
                
                const requesterName = runtime.videoCallState.callRequester || chat.members[0]?.name || '一位成员';
                document.getElementById('caller-avatar').src = chat.settings.groupAvatar || runtime.defaultGroupAvatar;
                document.getElementById('caller-name').textContent = chat.name; 
                document.querySelector('.incoming-call-content .caller-text').textContent = `${requesterName} invited you to a group video call`; 
            } else {
                
                document.getElementById('caller-avatar').src = chat.settings.aiAvatar || runtime.defaultAvatar;
                document.getElementById('caller-name').textContent = chat.name;
                document.querySelector('.incoming-call-content .caller-text').textContent = "Incoming video call";
            }
            
            document.getElementById('incoming-call-modal').classList.add('visible');
        }

export function hideIncomingCallModal() {
            document.getElementById('incoming-call-modal').classList.remove('visible');
        }

export async function triggerAiInCallAction(userInput = null) {
            if (!runtime.videoCallState.isActive) return;
        
            const chat = runtime.state.chats[runtime.videoCallState.activeChatId];
            const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
            const callFeed = document.getElementById('video-call-main');
            const userNickname = chat.settings.myNickname || '我';
        
            let worldBookContent = '';
            if (chat.settings.linkedWorldBookIds && chat.settings.linkedWorldBookIds.length > 0) {
                const linkedContents = chat.settings.linkedWorldBookIds.map(bookId => {
                    const worldBook = runtime.state.worldBooks.find(wb => wb.id === bookId);
                    return worldBook && worldBook.content ? `\n\n## 世界书: ${worldBook.name}\n${worldBook.content}` : '';
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
        
            
            if (userInput && runtime.videoCallState.isUserParticipating) {
                const userTimestamp = Date.now(); 
                const userBubble = document.createElement('div');
                userBubble.className = 'call-message-bubble user-speech';
                userBubble.textContent = userInput;
                userBubble.dataset.timestamp = userTimestamp; 
                addLongPressListener(userBubble, () => showCallMessageActions(userTimestamp)); 
                callFeed.appendChild(userBubble);
                callFeed.scrollTop = callFeed.scrollHeight;
                runtime.videoCallState.callHistory.push({ role: 'user', content: userInput, timestamp: userTimestamp }); 
            }
        
            
            let inCallPrompt;
            if (runtime.videoCallState.isGroupCall) {
                const participantNames = runtime.videoCallState.participants.map(p => p.name);
                if(runtime.videoCallState.isUserParticipating) {
                    participantNames.unshift(userNickname);
                }
                inCallPrompt = `
        # 你的任务
        你是一个群聊视频通话的导演。你的任务是扮演所有【除了用户以外】的AI角色，并以【第三人称旁观视角】来描述他们在通话中的所有动作和语言。
        # 核心规则
        1.  **【【【身份铁律】】】**: 用户的身份是【${userNickname}】。你【绝对不能】生成 \`name\` 字段为 **"${userNickname}"** 的发言。
        2.  **【【【视角铁律】】】**: 你的回复【绝对不能】使用第一人称“我”。
        3.  **格式**: 你的回复【必须】是一个JSON数组，每个对象代表一个角色的发言，格式为：\`{"name": "角色名", "speech": "*他笑了笑* 大家好啊！"}\`。
        4.  **角色扮演**: 严格遵守每个角色的设定。
        # 当前情景
        你们正在一个群视频通话中。
        **通话前的聊天摘要**:
        ${runtime.videoCallState.preCallContext}
        **当前参与者**: ${participantNames.join('、 ')}。
        **通话刚刚开始...**
        ${worldBookContent} // <-- 【核心】注入世界书
        现在，请根据【通话前摘要】和下面的【通话实时记录】，继续进行对话。
        `;
            } else { 
                let openingContext = runtime.videoCallState.initiator === 'user'
                    ? `你刚刚接听了用户的视频通话请求。`
                    : `用户刚刚接听了你主动发起的视频通话。`;
                inCallPrompt = `
        # 你的任务
        你现在是一个场景描述引擎。你的任务是扮演 ${chat.name} (${chat.settings.aiPersona})，并以【第三人称旁观视角】来描述TA在视频通话中的所有动作和语言。
        # 核心规则
        1.  **【【【视角铁律】】】**: 你的回复【绝对不能】使用第一人称“我”。必须使用第三人称，如“他”、“她”、或直接使用角色名“${chat.name}”。
        2.  **格式**: 你的回复【必须】是一段描述性的文本。
        # 当前情景
        你正在和用户（${userNickname}，人设: ${chat.settings.myPersona}）进行视频通话。
        **${openingContext}**
        **通话前的聊天摘要 (这是你们通话的原因，至关重要！)**:
        ${runtime.videoCallState.preCallContext}
        现在，请根据【通话前摘要】和下面的【通话实时记录】，继续进行对话。
        `;
            }
            
            // 3. 构建发送给API的 messages 数组
            const messagesForApi = [
                { role: 'system', content: inCallPrompt },
                ...runtime.videoCallState.callHistory.map(h => ({ role: h.role, content: h.content }))
            ];
        
            if (runtime.videoCallState.callHistory.length === 0) {
                const firstLineTrigger = runtime.videoCallState.initiator === 'user' ? `*你按下了接听键...*` : `*对方按下了接听键...*`;
                messagesForApi.push({ role: 'user', content: firstLineTrigger });
            }
            
                try {
                    let  isGemini = proxyUrl === runtime.GEMINI_API_URL;
                    let geminiConfig = toGeminiRequestData(model,apiKey,inCallPrompt, messagesForApi)
                    const response = isGemini ? await fetch(geminiConfig.url, geminiConfig.data) : await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
                        body: JSON.stringify({
                            model: model, messages: messagesForApi, temperature: runtime.state.globalSettings.apiTemperature ?? 0.8
                        })
                    });
                    if (!response.ok) throw new Error((await response.json()).error.message);
        
                    const data = await response.json();
                    const aiResponse = isGemini? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
        
                    const connectingElement = callFeed.querySelector('em');
                    if (connectingElement) connectingElement.remove();
                if (runtime.videoCallState.isGroupCall) {
                    const speechArray = parseAiResponse(aiResponse);
                    speechArray.forEach(turn => {
                        if (!turn.name || turn.name === userNickname || !turn.speech) return;
                        const aiTimestamp = Date.now() + Math.random(); 
                        const aiBubble = document.createElement('div');
                        aiBubble.className = 'call-message-bubble ai-speech';
                        aiBubble.innerHTML = `<strong>${turn.name}:</strong> ${turn.speech}`;
                        aiBubble.dataset.timestamp = aiTimestamp; 
                        addLongPressListener(aiBubble, () => showCallMessageActions(aiTimestamp)); 
                        callFeed.appendChild(aiBubble);
                        runtime.videoCallState.callHistory.push({ role: 'assistant', content: `${turn.name}: ${turn.speech}`, timestamp: aiTimestamp }); 
                        
                        const speaker = runtime.videoCallState.participants.find(p => p.name === turn.name);
                        if (speaker) {
                            const speakingAvatar = document.querySelector(`.participant-avatar-wrapper[data-participant-id="${speaker.id}"] .participant-avatar`);
                            if(speakingAvatar) {
                                speakingAvatar.classList.add('speaking');
                                setTimeout(() => speakingAvatar.classList.remove('speaking'), 2000);
                            }
                        }
                    });
                } else {
                    const aiTimestamp = Date.now(); 
                    const aiBubble = document.createElement('div');
                    aiBubble.className = 'call-message-bubble ai-speech';
                    aiBubble.textContent = aiResponse;
                    aiBubble.dataset.timestamp = aiTimestamp; 
                    addLongPressListener(aiBubble, () => showCallMessageActions(aiTimestamp)); 
                    callFeed.appendChild(aiBubble);
                    runtime.videoCallState.callHistory.push({ role: 'assistant', content: aiResponse, timestamp: aiTimestamp }); 
        
                    const speakingAvatar = document.querySelector(`.participant-avatar-wrapper .participant-avatar`);
                    if(speakingAvatar) {
                        speakingAvatar.classList.add('speaking');
                        setTimeout(() => speakingAvatar.classList.remove('speaking'), 2000);
                    }
                }
                
                callFeed.scrollTop = callFeed.scrollHeight;
        
            } catch (error) {
                const errorBubble = document.createElement('div');
                errorBubble.className = 'call-message-bubble ai-speech';
                errorBubble.style.color = '#ff8a80';
                errorBubble.textContent = `[ERROR: ${error.message}]`;
                callFeed.appendChild(errorBubble);
                callFeed.scrollTop = callFeed.scrollHeight;
                runtime.videoCallState.callHistory.push({ role: 'assistant', content: `[ERROR: ${error.message}]` });
            }
        }

export function toggleCallButtons(isGroup) {
            document.getElementById('video-call-btn').style.display = isGroup ? 'none' : 'flex';
            document.getElementById('group-video-call-btn').style.display = isGroup ? 'flex' : 'none';
        }

export function showCallMessageActions(timestamp) {
            runtime.activeCallMessageTimestamp = timestamp;
            document.getElementById('call-message-actions-modal').classList.add('visible');
        }

export function hideCallMessageActions() {
            document.getElementById('call-message-actions-modal').classList.remove('visible');
            runtime.activeCallMessageTimestamp = null;
        }

export async function openCallMessageEditor() {
            if (!runtime.activeCallMessageTimestamp) return;
        
            const timestampToEdit = runtime.activeCallMessageTimestamp;
            const message = runtime.videoCallState.callHistory.find(m => m.timestamp === timestampToEdit);
            if (!message) return;
        
            hideCallMessageActions(); 
        
            let contentForEditing = message.content;
            
            if (runtime.videoCallState.isGroupCall && message.role === 'assistant') {
                const parts = message.content.split(': ');
                if (parts.length > 1) {
                    contentForEditing = parts.slice(1).join(': ');
                }
            }
        
            const newContent = await showCustomPrompt(
                "Edit Call Message",
                "Edit the message…",
                contentForEditing,
                'textarea'
            );
        
            if (newContent !== null) {
                await saveEditedCallMessage(timestampToEdit, newContent);
            }
        }

export async function saveEditedCallMessage(timestamp, newContent) {
            const message = runtime.videoCallState.callHistory.find(m => m.timestamp === timestamp);
            if (message) {
                let finalContent = newContent;
                
                if (runtime.videoCallState.isGroupCall && message.role === 'assistant') {
                    const parts = message.content.split(': ');
                    const senderName = parts[0];
                    finalContent = `${senderName}: ${newContent}`;
                }
                message.content = finalContent; 
        
                
                const messageBubble = document.querySelector(`.call-message-bubble[data-timestamp="${timestamp}"]`);
                if (messageBubble) {
                    if (runtime.videoCallState.isGroupCall && message.role === 'assistant') {
                        const parts = message.content.split(': ');
                        const senderName = parts[0];
                        messageBubble.innerHTML = `<strong>${senderName}:</strong> ${newContent}`;
                    } else {
                        messageBubble.textContent = newContent;
                    }
                }
            }
            await showCustomAlert("Success", "Call message updated.");
        }

export async function deleteCallMessage() {
            if (!runtime.activeCallMessageTimestamp) return;
        
            const confirmed = await showCustomConfirm("Delete messages", "Delete this call message?", { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                const timestampToDelete = runtime.activeCallMessageTimestamp;
                hideCallMessageActions();
        
                
                const messageIndex = runtime.videoCallState.callHistory.findIndex(m => m.timestamp === timestampToDelete);
                if (messageIndex > -1) {
                    runtime.videoCallState.callHistory.splice(messageIndex, 1);
                }
        
                
                const messageBubble = document.querySelector(`.call-message-bubble[data-timestamp="${timestampToDelete}"]`);
                if (messageBubble) {
                    messageBubble.remove();
                }
            } else {
                hideCallMessageActions();
            }
        }

export function createCallRecordCard(record) {
            const card = document.createElement('div');
            card.className = 'call-record-card';
            card.dataset.recordId = record.id; 
        
            
            const chatInfo = runtime.state.chats[record.chatId];
            const chatName = chatInfo ? chatInfo.name : '未知会话';
        
            const callDate = new Date(record.timestamp);
            const dateString = `${callDate.getFullYear()}-${String(callDate.getMonth() + 1).padStart(2, '0')}-${String(callDate.getDate()).padStart(2, '0')} ${String(callDate.getHours()).padStart(2, '0')}:${String(callDate.getMinutes()).padStart(2, '0')}`;
            const durationText = `${Math.floor(record.duration / 60)}分${record.duration % 60}秒`;
        
            const avatarsHtml = record.participants.map(p => 
                `<img src="${p.avatar}" alt="${p.name}" class="participant-avatar" title="${p.name}">`
            ).join('');
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="date">${dateString}</span>
                    <span class="duration">${durationText}</span>
                </div>
                <div class="card-body">
                    <!-- 【核心修改】在这里新增一个标题行 -->
                    ${record.customName ? `<div class="custom-title">${record.customName}</div>` : ''}
                    
                    <div class="participants-info"> <!-- 新增一个容器方便布局 -->
                        <div class="participants-avatars">${avatarsHtml}</div>
                        <span class="participants-names">With ${chatName}</span>
                    </div>
                </div>
            `;
            return card;
        }

export async function showCallTranscript(recordId) {
    const record = await runtime.db.callRecords.get(recordId);
    if (!record) return;

    const modal = document.getElementById('call-transcript-modal');
    const titleEl = document.getElementById('transcript-modal-title');
    const bodyEl = document.getElementById('call-transcript-modal-body');

    titleEl.textContent = `Call on ${new Date(record.timestamp).toLocaleString()} (${Math.floor(record.duration / 60)}m ${record.duration % 60}s)`;
    bodyEl.innerHTML = '';
    
    const deleteBtn = document.getElementById('delete-transcript-btn');
    const summarizeBtn = document.getElementById('manual-summarize-btn');
    
    if (!record.transcript || record.transcript.length === 0) {
        bodyEl.innerHTML = "<p style=\"text-align:center; color: #8a8a8a;\">This call has no transcript.</p>";
        summarizeBtn.style.display = 'none';
    } else {
        summarizeBtn.style.display = 'block';
        record.transcript.forEach(entry => {
            const bubble = document.createElement('div');
            bubble.className = `transcript-entry ${entry.role}`; 
            bubble.textContent = entry.content;
            bodyEl.appendChild(bubble);
        });
    }

    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    const newSummarizeBtn = summarizeBtn.cloneNode(true);
    summarizeBtn.parentNode.replaceChild(newSummarizeBtn, summarizeBtn);
    
    newDeleteBtn.addEventListener('click', async () => {
        const confirmed = await showCustomConfirm(
            "Confirm Delete", "Permanently delete this call record?", { confirmButtonClass: 'btn-danger' }
        );
        if (confirmed) {
            modal.classList.remove('visible');
            await runtime.db.callRecords.delete(recordId);
            await renderCallHistoryScreen();
            alert("Call record deleted.");
        }
    });



newSummarizeBtn.addEventListener('click', async () => {
    
    const confirmed = await showCustomConfirm(
        "Confirm Repair",
        "Send this transcript to the AI for a summary? This uses API credits.", {
            confirmText: '确认总结'
        }
    );

    
    if (!confirmed) return;

    modal.classList.remove('visible');
    const chat = runtime.state.chats[record.chatId];
    if (!chat) {
        alert("The chat for this call record could not be found.");
        return;
    }

    await showCustomAlert("Please wait…", "Asking the AI to summarize the call…");

    try {
        const transcriptText = record.transcript.map(h => {
            const sender = h.role === 'user' ? (chat.settings.myNickname || '我') : (h.senderName || chat.name);
            return `${sender}: ${h.content}`;
        }).join('\n');

        await summarizeCallTranscript(record.chatId, transcriptText);

        await showCustomAlert("Summary Complete", `The summary was added to the long-term memory for “${chat.name}”.`);

    } catch (error) {
        await showCustomAlert("Summary Failed", `Could not generate a memory. Error: ${error.message}`);
    }
});





const closeBtn = document.getElementById('close-transcript-modal-btn');
const newCloseBtn = closeBtn.cloneNode(true);
closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

newCloseBtn.addEventListener('click', () => {
    modal.classList.remove('visible');
});


    modal.classList.add('visible');
}

export async function handleEditStatusClick() {
            
            if (!runtime.state.activeChatId || runtime.state.chats[runtime.state.activeChatId].isGroup) {
                return; 
            }
            const chat = runtime.state.chats[runtime.state.activeChatId];
        
            
            const newStatusText = await showCustomPrompt(
                "Edit Character Status",
                "Enter the character’s new status",
                chat.status.text 
            );
        
            
            if (newStatusText !== null) {
                
                chat.status.text = newStatusText.trim() || 'Online'; 
                chat.status.isBusy = false; 
                chat.status.lastUpdate = Date.now();
                await runtime.db.chats.put(chat);
        
                
                renderChatInterface(runtime.state.activeChatId);
                renderChatList();
                
                
                await showCustomAlert("Status Updated", `“${chat.name}” is now: ${chat.status.text}`);
            }
        }
