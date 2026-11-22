import { openAiUrl } from '../../features/api/endpoints'
import { getGeminiResponseText, toGeminiRequestData } from '../api/client.js'
import { showChoiceModal, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

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
        
            memoriesToDisplay.forEach((memory, index) => {
                const item = document.createElement('div');
                item.className = 'memory-card'; 
                item.style.cursor = 'default';
        
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="content" style="padding: 0; flex-grow: 1;">
                            <!-- 新增：显示记忆来源 -->
                            <div style="font-size: 0.8em; color: #999; margin-bottom: 5px;">
                                [ ${memory.authorName} 的记忆 ]
                            </div>
                            ${memory.content.replace(/\n/g, '<br>')}
                        </div>
                        <div style="display: flex; gap: 8px; flex-shrink: 0; margin-left: 15px;">
                            <button class="memory-action-btn edit-memory-btn" data-author-id="${memory.authorChatId}" data-memory-timestamp="${memory.timestamp}" title="Edit">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="memory-action-btn delete-memory-btn" data-author-id="${memory.authorChatId}" data-memory-timestamp="${memory.timestamp}" title="Delete">
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
            text: `为“${member.groupNickname}”添加记忆`,
            value: member.id
        }));
        const selectedMemberId = await showChoiceModal('选择记忆所属角色', memberOptions);
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
    if (!chat || !transcriptText) {
        throw new Error("基础数据不完整，无法开始总结。");
    }

    const userNickname = runtime.state.qzoneSettings.nickname || '用户';
    let systemPrompt;
    let targetMemoryChat = chat; 

    
    
    
    const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

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
        
        const userPersonaInGroup = chat.settings.myPersona || '(未设置)';

        systemPrompt = `
# 你的任务
你就是角色“${protagonist.originalName}”。请你回顾一下刚才和 “${userNickname}” 以及其他群成员的【群组视频通话】，然后用【第一人称 ("我")】的口吻，总结出一段简短的、客观的、包含关键信息的记忆。

# 当前时间
- **今天是：${today}**

# 核心规则
1.  **【视角铁律】**: 你的总结【必须】使用【主观的第一人称视角 ("我")】来写。
2.  **【内容核心 (最高优先级)】**: 你的总结【必须】专注于以下几点：
    *   **关键议题**: 我们在群聊通话里讨论了哪些核心话题？
    *   **重要决定与共识**: 我们达成了什么共识或做出了什么决定？
    *   **后续计划与任务**: 有没有确定下来什么下一步的行动或计划？
    *   **关键信息**: 有没有交换什么重要的信息？（例如：约定了时间、地点等）
3.  **【时间转换铁律 (必须遵守)】**: 如果通话中提到了相对时间（如“明天”），你【必须】结合“今天是${today}”这个信息，将其转换为【具体的公历日期】。
4.  **【风格要求】**: 你的总结应该像一份会议纪要或备忘录，而不是一篇抒情散文。
5.  **【长度铁律】**: 你的总结【必须】非常简短，总长度【绝对不能超过80个字】。
6.  **【输出格式】**: 你的回复【必须且只能】是一个JSON对象，格式如下：
    \`{"summary": "在这里写下你以第一人称视角，总结好的核心事实与计划。"}\`

# 你的角色设定 (必须严格遵守)
${protagonistChat.settings.aiPersona}

# 你的聊天对象（用户）的人设
${userPersonaInGroup}

# 待总结的群组视频通话记录
${transcriptText}

现在，请以“${protagonist.originalName}”的身份，开始你的客观总结。`;
        
        targetMemoryChat = protagonistChat;

    } else {
        systemPrompt = `
# 你的任务
你就是角色“${chat.originalName}”。请你回顾一下刚才和“${userNickname}”的视频通话，然后用【第一人称 ("我")】的口吻，总结出一段简短的、客观的、包含关键信息的记忆。

# 当前时间
- **今天是：${today}**

# 核心规则
1.  **【视角铁律】**: 你的总结【必须】使用【主观的第一人称视角 ("我")】来写。
2.  **【内容核心 (最高优先级)】**: 你的总结【必须】专注于以下几点：
    *   **关键议题**: 我们聊了什么核心话题？
    *   **重要决定与共识**: 我们达成了什么共识或做出了什么决定？
    *   **后续计划与任务**: 有没有确定下来什么下一步的行动或计划？
    *   **关键信息**: 有没有交换什么重要的信息？（例如：约定了时间、地点等）
3.  **【时间转换铁律 (必须遵守)】**: 如果通话中提到了相对时间（如“明天”），你【必须】结合“今天是${today}”这个信息，将其转换为【具体的公历日期】。
4.  **【风格要求】**: 你的总结应该像一份会议纪要或备忘录，而不是一篇抒情散文。
5.  **【长度铁律】**: 你的总结【必须】非常简短，总长度【绝对不能超过80个字】。
6.  **【输出格式】**: 你的回复【必须且只能】是一个JSON对象，格式如下：
    \`{"summary": "在这里写下你以第一人称视角，总结好的核心事实与计划。"}\`

# 你的角色设定
${chat.settings.aiPersona}

# 你的聊天对象（用户）的人设
${chat.settings.myPersona}

# 待总结的视频通话记录
${transcriptText}

现在，请以“${chat.originalName}”的身份，开始你的客观总结。`;
    }



    try {
        const useSecondaryApi = runtime.state.apiConfig.secondaryProxyUrl && runtime.state.apiConfig.secondaryApiKey && runtime.state.apiConfig.secondaryModel;
        const { proxyUrl, apiKey, model } = useSecondaryApi ? 
            { proxyUrl: runtime.state.apiConfig.secondaryProxyUrl, apiKey: runtime.state.apiConfig.secondaryApiKey, model: runtime.state.apiConfig.secondaryModel } : 
            runtime.state.apiConfig;

        if (!proxyUrl || !apiKey || !model) throw new Error('API未配置，无法进行总结。');

        let isGemini = proxyUrl.includes('generativelanguage');
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, [{ role: 'user', content: "请开始总结。" }]);

        const response = isGemini 
            ? await fetch(geminiConfig.url, geminiConfig.data) 
            : await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
                body: JSON.stringify({
                    model: model,
                    messages: [{role: 'system', content: systemPrompt}, {role: 'user', content: "请开始总结。"}],
                    temperature: 0.1
                })
            });

        if (!response.ok) {
             const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
             throw new Error(`API 请求失败: ${response.status} - ${errorData.error.message}`);
        }
        
        const data = await response.json();
        let rawContent = isGemini ? getGeminiResponseText(data) : data.choices[0].message.content;
        rawContent = rawContent.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        const result = JSON.parse(rawContent);

        if (result.summary && result.summary.trim()) {
            const newMemoryEntry = {
                content: `(在那次${chat.isGroup ? '群聊' : ''}通话中，${result.summary.trim()})`,
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

export async function triggerAutoSummary(chatId, force = false) {
    const chat = runtime.state.chats[chatId];
    if (!chat) return;

    const lastSummaryTimestamp = chat.lastMemorySummaryTimestamp || 0;
    const messagesToSummarize = force 
        ? chat.history.filter(m => !m.isHidden || (m.role === 'system' && m.content.includes('内心独白'))).slice(-(chat.settings.autoMemoryInterval || 20))
        : chat.history.filter(m => m.timestamp > lastSummaryTimestamp && (!m.isHidden || (m.role === 'system' && m.content.includes('内心独白'))));
        
    if (messagesToSummarize.length < 5) {
        if (force) alert("There are too few recent messages to summarize.");
        return;
    }

    const userNickname = runtime.state.qzoneSettings.nickname || '用户';
    
    const formattedHistory = messagesToSummarize.map(msg => {
        if (msg.isHidden && msg.role === 'system' && msg.content.includes('内心独白')) {
            return msg.content;
        }
        let sender;
        if (msg.role === 'user') {
            sender = userNickname;
        } else {
            sender = msg.senderName || chat.originalName;
        }
        let contentToSummarize = '';
        if (msg.type === 'offline_text') {
            if (msg.content) {
                 contentToSummarize = msg.content;
            } else {
                const dialogue = msg.dialogue ? `「${msg.dialogue}」` : '';
                const description = msg.description ? `(${msg.description})` : '';
                contentToSummarize = `${dialogue} ${description}`.trim();
            }
        } else {
            contentToSummarize = String(msg.content);
        }
        return `${sender}: ${contentToSummarize}`;
    }).join('\n');

    let systemPrompt;

    if (chat.isGroup) {
        // (群聊总结逻辑保持不变)
        systemPrompt = `
# 你的任务
你是一个高级的“记忆分配专家”。你的任务是阅读下面的群聊记录，并为【每一个参与的AI角色】生成一段【个性化的、第一人称】的长期记忆。
# 核心规则
1.  **视角铁律**: 每一条总结都【必须】使用【第一人称视角 ("我")】。
2.  **内容核心**: 重点总结：我说过的话、我做过的事、别人对我说的话、与我相关的事、以及对我个人很重要的群聊事件、关键信息和心理活动。
3.  **【简洁性铁律】**: 每条个人记忆总结【绝对不能超过60个字】。
4.  **【省略规则】**: 如果一个角色在本次对话中【完全没有参与或提及】，你可以省略TA的记忆。
5.  **输出格式**: 你的回复【必须且只能】是一个JSON对象，格式如下：
    \`\`\`json
    {
      "summaries": {
        "角色的本名A": "我今天在群里和大家讨论了电影，感觉很开心。",
        "角色的本名B": "我在群里和${userNickname}聊了关于生日派对的事，我们约好了10月1日见面。"
      }
    }
    \`\`\`
# 待总结的群聊记录
${formattedHistory}
# 群成员列表 (你的总结目标)
${chat.members.map(m => `- ${m.groupNickname} (本名: ${m.originalName})`).join('\n')}
现在，请为【参与了对话的AI角色】生成他们各自的、第一人称的、精简的记忆。`;

    } else {

 
        const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });


        systemPrompt = `
# 你的任务
你就是角色“${chat.originalName}”。请你回顾一下刚才和“${userNickname}”的对话，然后用【第一人称 ("我")】的口吻，总结出一段简短的、客观的、包含关键信息的记忆。

# 当前时间
- **今天是：${today}**

# 核心规则
1.  **【视角铁律】**: 你的总结【必须】使用【主观的第一人称视角 ("我")】来写。
2.  **【内容核心 (最高优先级)】**: 你的总结【必须】专注于以下几点：
    *   **重要事件**: 刚才发生了什么具体的事情？
    *   **关键决定**: 我们达成了什么共识或做出了什么决定？
    *   **未来计划**: 我们约定了什么未来的计划或待办事项？
    *   **重要时间点**: 对话中提到了哪些具体的日期或时间？
3.  **【时间转换铁律 (必须遵守)】**: 如果对话中提到了相对时间（如“明天”、“后天”），你【必须】结合“今天是${today}”这个信息，将其转换为【具体的公历日期】（例如：“约定了明天见面”应总结为“我们约定了${new Date(Date.now() + 86400000).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}见面”）。
4.  **【风格要求】**: 你的总结应该像一份备忘录或要点记录，而不是一篇抒情散文。请尽量减少主观的心理感受描述，除非它直接导致了某个决定或计划。
5.  **【长度铁律】**: 你的总结【必须】非常简短，总长度【绝对不能超过100个字】。
6.  **【输出格式】**: 你的回复【必须且只能】是一个JSON对象，格式如下：
    \`{"summary": "在这里写下你以第一人称视角，总结好的核心事实与计划。"}\`

# 你的角色设定
${chat.settings.aiPersona}
# 你的聊天对象（用户）的人设
${chat.settings.myPersona}
# 待总结的对话历史
${formattedHistory}

现在，请以“${chat.originalName}”的身份，开始你的客观总结。`;

    }

    try {
        const useSecondaryApi = runtime.state.apiConfig.secondaryProxyUrl && runtime.state.apiConfig.secondaryApiKey && runtime.state.apiConfig.secondaryModel;
        const { proxyUrl, apiKey, model } = useSecondaryApi ? { proxyUrl: runtime.state.apiConfig.secondaryProxyUrl, apiKey: runtime.state.apiConfig.secondaryApiKey, model: runtime.state.apiConfig.secondaryModel } : runtime.state.apiConfig;
        if (!proxyUrl || !apiKey || !model) throw new Error('API未配置');
        
        let isGemini = proxyUrl.includes('generativelanguage');
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, [{ role: 'user', content: "请开始总结。" }]);
        const response = isGemini ? await fetch(geminiConfig.url, geminiConfig.data) : await fetch(openAiUrl(proxyUrl, 'chat/completions'), { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`}, body: JSON.stringify({ model: model, messages: [{role: 'system', content: systemPrompt}, {role: 'user', content: "请开始总结。"}], temperature: 0.2 }) });
        
        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        const data = await response.json();
        let rawContent = isGemini ? getGeminiResponseText(data) : data.choices[0].message.content;
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
