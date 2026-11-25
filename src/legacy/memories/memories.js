import { withConversationRequest } from '../../features/chat/sessions'
import { requestContextCompletion } from '../../features/api/completion'
import { contextConfig } from '../../features/context/context'
import { getGeminiResponseText } from '../api/client.js'
import { showChoiceModal, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'
import { escapeHtml } from '../../runtime/files'

export function renderLongTermMemoryList() {
            const container = document.getElementById('memory-list-container');
            const chat = runtime.state.chats[runtime.state.activeChatId];
            container.innerHTML = '';
        
            let memoriesToDisplay = [];

            
            if (chat.isGroup) {
                
                chat.members.forEach(member => {
                    const memberChat = runtime.state.chats[member.id];
                    if (memberChat && memberChat.longTermMemory) {
                        
                        const memberMemories = memberChat.longTermMemory.map(mem => ({
                            ...mem,
                            authorName: member.groupNickname, 
                            authorChatId: member.id, 
                        }));
                        memoriesToDisplay.push(...memberMemories);
                    }
                });
            } else {
                
                if (chat.longTermMemory) {
                    memoriesToDisplay = chat.longTermMemory.map(mem => ({
                        ...mem,
                        authorName: chat.name, 
                        authorChatId: chat.id,
                    }));
                }
            }
              

            if (memoriesToDisplay.length === 0) {
                container.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); margin-top: 50px;\">No long-term memories yet.</p>";
                return;
            }

            
            memoriesToDisplay.sort((a, b) => b.timestamp - a.timestamp);
        
            memoriesToDisplay.forEach(memory => {
                const item = document.createElement('div');
                item.className = 'memory-card'; 
                item.style.cursor = 'default';
        
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="content" style="padding: 0; flex-grow: 1; min-width: 0; overflow-wrap: anywhere;">
                            <div style="font-size: 0.8em; color: var(--ui-muted); margin-bottom: 5px;">
                                Memory for ${escapeHtml(String(memory.authorName))}
                            </div>
                            ${escapeHtml(String(memory.content ?? '')).replace(/\n/g, '<br>')}
                        </div>
                        <div style="display: flex; gap: 8px; flex-shrink: 0; margin-left: 15px;">
                            <button class="memory-action-btn edit-memory-btn" data-author-id="${escapeHtml(String(memory.authorChatId))}" data-memory-timestamp="${Number(memory.timestamp)}" title="Edit">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="memory-action-btn delete-memory-btn" data-author-id="${escapeHtml(String(memory.authorChatId))}" data-memory-timestamp="${Number(memory.timestamp)}" title="Delete">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
                container.appendChild(item);
            });
        }

export async function handleAddManualMemory() {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return;
    let targetChatForMemory = chat;
    if (chat.isGroup) {
        const memberOptions = chat.members.map(member => ({
            text: `Add memory for “${member.groupNickname}”`,
            value: member.id
        }));
        const selectedMemberId = await showChoiceModal('Choose a group member', memberOptions);
        if (!selectedMemberId) return;
        targetChatForMemory = runtime.state.chats[selectedMemberId];
        if (!targetChatForMemory) {
            alert("The group member’s profile could not be found.");
            return;
        }
    }
    const content = await showCustomPrompt(`Add Memory for “${targetChatForMemory.name}”`, "Enter the memory", '', 'textarea');
    if (content && content.trim()) {
        if (!targetChatForMemory.longTermMemory) targetChatForMemory.longTermMemory = [];
        targetChatForMemory.longTermMemory.push({ content: content.trim(), timestamp: Date.now(), source: 'manual' });
        await runtime.db.chats.put(targetChatForMemory);
        renderLongTermMemoryList();
    }
}

export async function handleEditMemory(authorChatId, memoryTimestamp) {
    const authorChat = runtime.state.chats[authorChatId];
    if (!authorChat || !authorChat.longTermMemory) return;
    const memoryIndex = authorChat.longTermMemory.findIndex(m => m.timestamp === memoryTimestamp);
    if (memoryIndex === -1) return;
    const memory = authorChat.longTermMemory[memoryIndex];
    const newContent = await showCustomPrompt("Edit Memory", "Edit the memory", memory.content, 'textarea');
    if (newContent && newContent.trim()) {
        memory.content = newContent.trim();
        await runtime.db.chats.put(authorChat);
        renderLongTermMemoryList();
    }
}

export async function handleDeleteMemory(authorChatId, memoryTimestamp) {
    const confirmed = await showCustomConfirm("Confirm Delete", "Delete this long-term memory?", { confirmButtonClass: 'btn-danger' });
    if (confirmed) {
        const authorChat = runtime.state.chats[authorChatId];
        if (!authorChat || !authorChat.longTermMemory) return;
        authorChat.longTermMemory = authorChat.longTermMemory.filter(m => m.timestamp !== memoryTimestamp);
        await runtime.db.chats.put(authorChat);
        renderLongTermMemoryList();
    }
}

export async function handleManualSummary() {
            const confirmed = await showCustomConfirm("Confirm Repair", "Send the latest messages to the AI for a summary? This uses API credits.");
            if (confirmed) {
                await triggerAutoSummary(runtime.state.activeChatId, true); 
            }
        }

export async function checkAndTriggerAutoSummary(chatId) {
            const chat = runtime.state.chats[chatId];
            if (!chat || !chat.settings.enableAutoMemory) return;
        
            const lastSummaryTimestamp = chat.lastMemorySummaryTimestamp || 0;
            const messagesSinceLastSummary = chat.history.filter(m => m.timestamp > lastSummaryTimestamp && !m.isHidden);
        
            if (messagesSinceLastSummary.length >= chat.settings.autoMemoryInterval) {
                console.log(`达到自动总结阈值 (${messagesSinceLastSummary.length}/${chat.settings.autoMemoryInterval})，开始总结...`);
                await triggerAutoSummary(chatId);
            }
        }

export async function summarizeCallTranscript(chatId, transcriptText) {
    const chat = runtime.state.chats[chatId];
    if (!contextConfig().sources.activity.enabled || !contextConfig().sources.activity.percent) throw new Error('Enable App activity in Context to summarize the call.');
    if (!chat || !transcriptText) {
        throw new Error("基础数据不完整，无法开始总结。");
    }

    const userNickname = runtime.state.qzoneSettings.nickname || 'the user';
    let systemPrompt;
    let targetMemoryChat = chat; 

    
    
    
    const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

    if (chat.isGroup) {
        let protagonist = null;
        if (runtime.videoCallState.callRequester) {
            protagonist = chat.members.find(m => m.originalName === runtime.videoCallState.callRequester);
        }
        if (!protagonist) {
            protagonist = chat.members.find(m => m.id !== 'user' && runtime.videoCallState.participants.some(p => p.id === m.id));
        }
        if (!protagonist) {
            protagonist = chat.members.find(m => m.id !== 'user');
        }

        if (!protagonist) {
            throw new Error("群聊通话中没有找到可作为总结主体的AI角色。");
        }
        
        const protagonistChat = runtime.state.chats[protagonist.id];
        if (!protagonistChat) {
             throw new Error(`找不到主角 “${protagonist.groupNickname}” 的详细角色信息。`);
        }
        
        const userPersonaInGroup = chat.settings.myPersona || '(not set)';

        systemPrompt = `
# Summarize the video call
You are "${protagonist.originalName}". Recall the group video call with "${userNickname}" and the other members. Write a brief, factual memory in the first person ("I"). Use the language established by the character, user, and relevant context.

## What to keep
- The main topics we discussed.
- Any decisions or agreements.
- Next steps, plans, or tasks.
- Important information we exchanged, including times and places.
- Today is ${today}. Convert relative dates such as "tomorrow" to exact calendar dates.

## Output
Write it like meeting notes or a memo. Keep the summary to at most 80 characters.
Return only a valid JSON object, starting with { and ending with }. Omit surrounding prose, explanation, and Markdown fences.
{"summary":"Record the key facts and plans in the first person."}

## Context
- Your persona: ${protagonistChat.settings.aiPersona}
- The user's persona: ${userPersonaInGroup}
Use the provided call transcript.
`;
        
        targetMemoryChat = protagonistChat;

    } else {
        systemPrompt = `
# Summarize the video call
You are "${chat.originalName}". Recall the video call with "${userNickname}". Write a brief, factual memory in the first person ("I"). Use the language established by the character, user, and relevant context.

## What to keep
- The main topics we discussed.
- Any decisions or agreements.
- Next steps, plans, or tasks.
- Important information we exchanged, including times and places.
- Today is ${today}. Convert relative dates such as "tomorrow" to exact calendar dates.

## Output
Write it like meeting notes or a memo. Keep the summary to at most 80 characters.
Return only a valid JSON object, starting with { and ending with }. Omit surrounding prose, explanation, and Markdown fences.
{"summary":"Record the key facts and plans in the first person."}

## Context
- Your persona: ${chat.settings.aiPersona}
- The user's persona: ${chat.settings.myPersona}
Use the provided call transcript.
`;
    }



    try {
        const response = await requestContextCompletion(chat, { instructions: systemPrompt, includeOnly: ['activity'],
            task: 'Call summary', scope: 'memory:call:' + chat.id, activity: transcriptText.split('\n'),
            request: [{ role: 'user', content: 'Summarize the provided call transcript.' }] }, { temperature: 0.1 });

        if (!response.ok) {
             const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
             throw new Error(`API 请求失败: ${response.status} - ${errorData.error.message}`);
        }
        
        const data = await response.json();
        let rawContent = getGeminiResponseText(data);
        rawContent = rawContent.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        const result = JSON.parse(rawContent);

        if (result.summary && result.summary.trim()) {
            const newMemoryEntry = {
                content: `(During the ${chat.isGroup ? 'group ' : ''}call: ${result.summary.trim()})`,
                timestamp: Date.now(),
                source: chat.isGroup ? 'group_call_summary' : 'call_summary'
            };
            if (!targetMemoryChat.longTermMemory) targetMemoryChat.longTermMemory = [];
            targetMemoryChat.longTermMemory.push(newMemoryEntry);
            await runtime.db.chats.put(targetMemoryChat);
            console.log(`通话记录已成功总结并存入角色“${targetMemoryChat.name}”的长期记忆中。`);
            
            return true;
        } else {
            throw new Error("AI返回了空的或格式不正确的总结内容。");
        }

    } catch (error) {
        console.error("总结通话记录时出错:", error);
        throw error;
    }
}

export function analyzeTextForSummary(text) {
    const stopWords = new Set(['的', '是', '了', '在', '我', '你', '他', '她', '它', '我们', '你们', '他们', '这', '那', '一个', '也', '和', '与', '或', '但', '然而', '所以', '因此', '就', '都', '地', '得', '着', '过', '吧', '吗', '呢', '啊', '哦', '嗯', '什么', '怎么', '为什么', '哪个', '一些', '这个', '那个', '还有']);
    const words = text.match(/[\u4e00-\u9fa5]+|[a-zA-Z0-9]+/g) || [];
    const frequencies = new Map();
    let maxFrequency = 0;

    words.forEach(word => {
        if (word.length > 1 && !stopWords.has(word)) {
            const count = (frequencies.get(word) || 0) + 1;
            frequencies.set(word, count);
            if (count > maxFrequency) maxFrequency = count;
        }
    });
    
    const coreKeywords = [];
    const situationalKeywords = [];
    const coreThreshold = maxFrequency * 0.9;
    const situationalThreshold = maxFrequency * 0.6;

    frequencies.forEach((count, word) => {
        if (count >= coreThreshold) {
            coreKeywords.push(word);
        } else if (count >= situationalThreshold) {
            situationalKeywords.push(word);
        }
    });

    const coreSet = new Set(coreKeywords);
    const finalSituational = situationalKeywords.filter(word => !coreSet.has(word)).slice(0, 5);

    return {
        coreKeywords: coreKeywords.slice(0, 3),
        situationalKeywords: finalSituational
    };
}

export function generateSummaryForTimeframe(chat, duration, unit) {
    let timeAgo;
    if (unit === 'hours') {
        timeAgo = Date.now() - duration * 60 * 60 * 1000;
    } else { // 'days'
        timeAgo = Date.now() - duration * 24 * 60 * 60 * 1000;
    }

    const messagesToSummarize = chat.history.filter(m => m.timestamp > timeAgo && !m.isHidden);

    if (messagesToSummarize.length < 3) {
        return "";
    }
    
    // (此处的关键词提取逻辑与您现有的代码完全相同，无需修改)
    const allText = messagesToSummarize.map(msg => {
        if (typeof msg.content === 'string') return msg.content;
        if (msg.type === 'voice_message') return msg.content;
        if (msg.type === 'offline_text') return `${msg.dialogue || ''} ${msg.description || ''}`;
        return '';
    }).join(' ');

    const stopWords = new Set(['的', '是', '了', '在', '我', '你', '他', '她', '它', '我们', '你们', '他们', '这', '那', '一个', '也', '和', '与', '或', '但', '然而', '所以', '因此', '就', '都', '地', '得', '着', '过', '吧', '吗', '呢', '啊', '哦', '嗯']);
    const words = allText.match(/[\u4e00-\u9fa5]+|[a-zA-Z0-9]+/g) || [];
    const frequencies = new Map();
    words.forEach(word => {
        if (word.length > 1 && !stopWords.has(word)) {
            frequencies.set(word, (frequencies.get(word) || 0) + 1);
        }
    });
    const sortedKeywords = [...frequencies.entries()].sort((a, b) => b[1] - a[1]).map(entry => entry[0]);
    
    if (sortedKeywords.length === 0) {
        return "";
    }


    let title;
    if (unit === 'hours') {
        title = `最近${duration}小时核心议题`;
    } else {
        if (duration === 1) {
            title = "本日核心议题";
        } else {
            title = `最近${duration}天核心议题`;
        }
    }
    
    return `\n- **${title}**: 关于 **${sortedKeywords.slice(0, 3).join('、 ')}**。`;
}

export function triggerAutoSummary(chatId, force = false) {
    return withConversationRequest(chatId, () => summarizeConversation(chatId, force));
}

async function summarizeConversation(chatId, force) {
    const chat = runtime.state.chats[chatId];
    if (!chat) return;

    const qq = contextConfig().sources.qq;
    if (!qq.enabled || !qq.percent) {
        if (force) alert('Enable QQ chat in Context to summarize messages.');
        return;
    }

    const lastSummaryTimestamp = chat.lastMemorySummaryTimestamp || 0;
    const isMemorySource = message => !message.isHidden || (message.role === 'system' && (
        message.type === 'private_thoughts' || message.content?.includes?.('内心独白')
    ));
    const messagesToSummarize = force
        ? chat.history.filter(isMemorySource).slice(-(chat.settings.autoMemoryInterval || 20))
        : chat.history.filter(message => message.timestamp > lastSummaryTimestamp && isMemorySource(message));
        
    if (messagesToSummarize.length < 5) {
        if (force) alert("There are too few recent messages to summarize.");
        return;
    }

    const userNickname = runtime.state.qzoneSettings.nickname || 'the user';
    
    let systemPrompt;

    if (chat.isGroup) {
        // (群聊总结逻辑保持不变)
        systemPrompt = `
# Allocate long-term group memories
Read the group transcript. Write one personalized first-person memory for each participating AI character. Keep each memory to at most 60 characters. You may omit anyone who was neither involved nor mentioned. Use the language established by the character, user, and relevant context.

## What each character remembers
Focus on what I said or did, what others said to me, events concerning me, important developments in the group, relevant facts, and my own thoughts.

## Output
Return only a valid JSON object, starting with { and ending with }. Omit surrounding prose, explanation, and Markdown fences. Key "summaries" by the characters' original names.
{"summaries":{"Character A's original name":"I enjoyed our chat about the film.","Character B's original name":"I agreed to meet ${userNickname} on October 1."}}

## Group members
${chat.members.map(member => `- ${member.groupNickname} (original name: ${member.originalName})`).join('\n')}
`;

    } else {

 
        const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });


        systemPrompt = `
# Summarize the conversation
You are "${chat.originalName}". Recall your exchange with "${userNickname}" and write a brief, factual memory in the first person ("I"). Use the language established by the character, user, and relevant context.

## What to keep
- Specific events, key decisions or agreements, future plans or tasks, and important dates or times.
- Today is ${today}. Convert relative dates such as "tomorrow" or "the day after tomorrow" to exact calendar dates. For example, "We agreed to meet tomorrow" becomes "We agreed to meet on ${new Date(Date.now() + 86400000).toLocaleDateString('en-GB', { month: 'long', day: 'numeric' })}."
- Use factual notes. Include a feeling only if it directly led to a decision or plan.

## Output
Keep the summary to at most 100 characters. Return only a valid JSON object, starting with { and ending with }. Omit surrounding prose, explanation, and Markdown fences.
{"summary":"Record the key facts and plans in the first person."}

## Context
- Your persona: ${chat.settings.aiPersona}
- The user's persona: ${chat.settings.myPersona}
Use the provided conversation history.
`;

    }

    try {
        const response = await requestContextCompletion(chat, { instructions: systemPrompt, includeOnly: ['qq'],
            task: 'QQ memory summary', scope: 'memory:qq:' + chat.id, rawHistory: messagesToSummarize,
            request: [{ role: 'user', content: 'Summarize the provided messages.' }] }, { temperature: 0.2 });

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        const data = await response.json();
        let rawContent = getGeminiResponseText(data);
        rawContent = rawContent.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        const result = JSON.parse(rawContent);

        if (chat.isGroup) {
            if (result.summaries && typeof result.summaries === 'object') {
                let memoriesAddedCount = 0;
                for (const memberOriginalName in result.summaries) {
                    const summaryText = result.summaries[memberOriginalName];
                    if (summaryText && summaryText.trim()) {
                        const memberChat = Object.values(runtime.state.chats).find(c => c.originalName === memberOriginalName);
                        if (memberChat) {
                            const newMemoryEntry = {
                                content: summaryText.trim(),
                                timestamp: Date.now(),
                                source: `group_summary_from_${chat.name}`
                            };
                            if (!memberChat.longTermMemory) memberChat.longTermMemory = [];
                            memberChat.longTermMemory.push(newMemoryEntry);
                            await runtime.db.chats.put(memberChat);
                            memoriesAddedCount++;
                        }
                    }
                }
                if (memoriesAddedCount > 0) {
                    console.log(`自动总结成功：为 ${memoriesAddedCount} 位群成员生成并注入了个性化记忆！`);
                } else {
                    throw new Error("AI返回了空的或格式不正确的总结内容。");
                }
            } else {
                throw new Error("AI返回的JSON格式不正确，缺少 'summaries' 字段。");
            }
        } else {
            if (result.summary && result.summary.trim()) {
                const newMemoryEntry = { content: result.summary.trim(), timestamp: Date.now(), source: 'auto' };
                chat.longTermMemory.push(newMemoryEntry);
                await runtime.db.chats.put(chat);
                console.log('自动总结成功：已成功添加 1 条新的长期记忆！');
            } else {
                throw new Error("AI返回了空的或格式不正确的总结内容。");
            }
        }

        chat.lastMemorySummaryTimestamp = messagesToSummarize.slice(-1)[0].timestamp;
        await runtime.db.chats.put(chat);
        
        if (document.getElementById('long-term-memory-screen').classList.contains('active')) {
            renderLongTermMemoryList();
        }
    } catch (error) {
        console.error("总结长期记忆时出错:", error);
        await showCustomAlert("Summary Failed", `Operation failed: ${error.message}`);
    }
}
