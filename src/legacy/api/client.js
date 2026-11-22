import { openAiUrl } from '../../features/api/endpoints'
import { showChoiceModal, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { renderLongTermMemoryList } from '../memories/memories.js'
import { getRandomValue } from '../../runtime/helpers'
import { runtime } from '../runtime/state.js'

export function isImage(content) {
                if(content.image_url && content.image_url.url){
                    let currentImageData = content.image_url.url
                    
                    const base64Data = currentImageData.split(',')[1];
                    
                    const mimeType = currentImageData.match(/^data:(.*);base64/)[1];
                    return [
                        {text: '用户向你发送了一张图片'},
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }
                return []
            }

export function getGeminiResponseText(data) {
            
            if (data.choices && Array.isArray(data.choices) && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                return data.choices[0].message.content;
            }
        
            
            if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
                return data.candidates[0].content.parts[0].text;
            }
        
            
            console.error("Gemini API返回了非预期的格式:", data);
            let errorReason = "AI返回了空内容或未知格式。";
        
            
            
            if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0 && data.candidates[0].finishReason === 'SAFETY') {
                const safetyRatings = data.candidates[0].safetyRatings;
                const blockedCategories = safetyRatings
                    .filter(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
                    .map(r => `${r.category} (概率: ${r.probability})`)
                    .join(', ');
                errorReason = `内容因安全策略被屏蔽。触发类别: ${blockedCategories || '未知'}`;
            }
            
            else if (data.promptFeedback?.blockReason) {
                const reason = data.promptFeedback.blockReason;
                const details = data.promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ');
                errorReason = `内容因安全策略被屏蔽 (原因: ${reason})。详情: ${details || '无'}`;
            } 
            
            else if (data.error) {
                errorReason = `API错误: ${data.error.message}`;
            }
            
            
            throw new Error(errorReason);
        }

export function toGeminiRequestData(model, apiKey, systemInstruction, messagesForDecision) {
    const apiTemperature = runtime.state.globalSettings.apiTemperature ?? 0.8; 
    const roleType = {
        user: 'user',
        assistant: 'model',
        system: 'user'
    };

 
    const contents = [
        {
            role: 'user',
            parts: [{ text: systemInstruction }]
        },
        {
            role: 'model',
            parts: [{ text: '好的，我明白了。我会严格遵守以上所有规则和设定。' }]
        },

        ...messagesForDecision.map((item) => {
            const parts = [];
            
            if (Array.isArray(item.content)) {
                item.content.forEach(part => {
                    if (part.type === 'text') {
                        parts.push({ text: part.text });
                    } else if (part.type === 'image_url' && part.image_url && part.image_url.url) {
                        
                        const currentImageData = part.image_url.url;
                        const base64Data = currentImageData.split(',')[1];
                        const mimeTypeMatch = currentImageData.match(/^data:(.*);base64/);
                        if (mimeTypeMatch && base64Data) {
                            parts.push({
                                inline_data: {
                                    mime_type: mimeTypeMatch[1],
                                    data: base64Data
                                }
                            });
                        }
                    }
                });
            } else {
                
                parts.push({ text: String(item.content) });
            }
            return { role: roleType[item.role], parts: parts };
        })
    ];

    
    return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getRandomValue(apiKey)}`,
        data: {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    temperature: apiTemperature, 
                },
            })
        }
    };
}

export function parseAiResponse(content) {
            const trimmedContent = content.trim();
        
            
            
            if (trimmedContent.startsWith('[') && trimmedContent.endsWith(']')) {
                try {
                    const parsed = JSON.parse(trimmedContent);
                    if (Array.isArray(parsed)) {
                        console.log("解析成功：标准JSON数组格式。");
                        return parsed;
                    }
                } catch (e) {
                    
                    
                    console.warn("标准JSON数组解析失败，将尝试强力解析...");
                }
            }
        
            
            
            const jsonMatches = trimmedContent.match(/{[^{}]*}/g);
        
            if (jsonMatches) {
                const results = [];
                for (const match of jsonMatches) {
                    try {
                        
                        const parsedObject = JSON.parse(match);
                        results.push(parsedObject);
                    } catch (e) {
                        
                        console.warn("跳过一个无效的JSON片段:", match);
                    }
                }
        
                
                if (results.length > 0) {
                    console.log("解析成功：通过强力提取模式。");
                    return results;
                }
            }
            
            
            
            console.error("所有解析方案均失败！将返回原始文本。");
            return [{ type: 'text', content: content }];
        }

export function robustJsonParse(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') {
        return null;
    }

    const cleanedContent = rawContent.replace(/^```json\s*/, '').replace(/```$/, '').trim();


    const jsonMatch = cleanedContent.match(/{[\s\S]*}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log("容错解析：策略1成功 (找到并解析了完整的JSON对象)");
            return parsed;
        } catch (e) {
            console.warn("容错解析：策略1失败 (找到了JSON块，但格式错误)，将尝试策略2...");
        }
    }


    const summaryMatch = cleanedContent.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (summaryMatch && summaryMatch[1]) {
        console.log("容错解析：策略2成功 (提取了summary字段内容)");
        
        return { summary: summaryMatch[1].replace(/\\"/g, '"') }; // 处理转义的引号
    }
    

    if (cleanedContent) {
        console.log("容错解析：策略3成功 (将整个返回文本作为摘要)");
        return { summary: cleanedContent };
    }

   
    return null;
}

export async function summarizeExistingLongTermMemory(chatId) {
    let chat = runtime.state.chats[chatId];
    if (!chat) return;

    let targetChatForRefine = chat; 

    if (chat.isGroup) {
        const memberOptions = chat.members
            .map(member => {
                const memberChat = runtime.state.chats[member.id];
                if (memberChat && memberChat.longTermMemory && memberChat.longTermMemory.length >= 2) {
                    return {
                        text: `精炼“${member.groupNickname}”的记忆 (${memberChat.longTermMemory.length}条)`,
                        value: member.id
                    };
                }
                return null;
            }).filter(Boolean); 

        if (memberOptions.length === 0) {
            alert("No group member has two or more memories to refine.");
            return;
        }

        const selectedMemberId = await showChoiceModal('选择要精炼记忆的角色', memberOptions);

        if (!selectedMemberId) return;

        targetChatForRefine = runtime.state.chats[selectedMemberId];
    }

    if (!targetChatForRefine.longTermMemory || targetChatForRefine.longTermMemory.length < 2) {
        alert(`“${targetChatForRefine.name}” has fewer than two long-term memories.`);
        return;
    }
    
    const totalMemories = targetChatForRefine.longTermMemory.length;
    const choice = await showChoiceModal('选择精炼范围', [
        { text: `全部记忆 (${totalMemories}条)`, value: 'all' },
        { text: `最近 20 条`, value: '20' },
        { text: `最近 50 条`, value: '50' },
        { text: `最近 100 条`, value: '100' },
        { text: '自定义数量...', value: 'custom' }
    ].filter(opt => opt.value === 'all' || opt.value === 'custom' || parseInt(opt.value) < totalMemories)
    );

    if (choice === null) return;

    let memoriesToRefine;
    let countToRefine = totalMemories;

    if (choice === 'all') {
        memoriesToRefine = [...targetChatForRefine.longTermMemory];
    } else if (choice === 'custom') {
        const customCountStr = await showCustomPrompt("Custom Amount", `How many recent memories should be refined? (Maximum: ${totalMemories})`);
        if (customCountStr === null) return;
        const customCount = parseInt(customCountStr);
        if (isNaN(customCount) || customCount < 2 || customCount > totalMemories) {
            alert(`Enter a number between 2 and ${totalMemories}.`);
            return;
        }
        countToRefine = customCount;
        memoriesToRefine = targetChatForRefine.longTermMemory.slice(-countToRefine);
    } else {
        countToRefine = parseInt(choice);
        if (countToRefine >= totalMemories) {
            memoriesToRefine = [...targetChatForRefine.longTermMemory];
            countToRefine = totalMemories;
        } else {
            memoriesToRefine = targetChatForRefine.longTermMemory.slice(-countToRefine);
        }
    }
    
    const wordCountStr = await showCustomPrompt(
        "Set Summary Length",
        "Enter the approximate length of the refined memory.",
        "150"
    );
    
    if (wordCountStr === null) return;
    
    const wordCount = parseInt(wordCountStr);
    if (isNaN(wordCount) || wordCount < 20) {
        alert("Enter a valid number. A value above 20 is recommended.");
        return;
    }

    const confirmed = await showCustomConfirm(
        "Refine Memories?",
        `The AI will combine the selected ${countToRefine} long-term memories into a single entry of about ${wordCount} characters. The original entries will be replaced. Continue?`,
        { confirmButtonClass: 'btn-danger', confirmText: '确认精炼' }
    );

    if (!confirmed) return;

    const memoryContent = memoriesToRefine.map(mem => `- ${mem.content}`).join('\n');
    const userNickname = runtime.state.qzoneSettings.nickname || '用户';


    const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `
# 你的任务
你就是角色“${targetChatForRefine.originalName}”。请你回顾一下你和“${userNickname}”的所有长期记忆，然后将它们梳理、整合并精炼成一段更加连贯、客观的核心记忆摘要。

# 当前时间
- **今天是：${today}**

# 核心规则
1.  **【视角铁律】**: 你的总结【必须】使用【主观的第一人称视角 ("我")】来写。
2.  **【内容核心 (最高优先级)】**: 你的总结【必须】专注于梳理以下几点：
    *   **建立时间线**: 将所有独立的记忆点串联起来，形成一个有时间顺序的事件脉络。
    *   **整合关键信息**: 总结出我们共同经历的关键事件、做出的重要决定、以及约定好的未来计划。
    *   **识别未完成项**: 明确指出哪些计划或任务尚未完成。
3.  **【时间转换铁律 (必须遵守)】**: 如果记忆中提到了相对时间（如“明天”、“下周”），你【必须】结合“今天是${today}”这个信息，将其转换为【具体的公历日期】。
4.  **【风格要求】**: 你的总结应该像一份清晰的个人档案或事件回顾，而不是一篇情感散文。请删除重复、琐碎或纯粹的情感宣泄，只保留对情节和关系发展至关重要的部分。
5.  **【【【长度铁律】】】**: 你的总结【必须】非常精炼，总长度应控制在 **${wordCount} 字左右**。
6.  **【输出格式】**: 你的回复【必须且只能】是一个JSON对象，格式如下：
    \`{"summary": "在这里写下你以第一人称视角，总结好的核心事实与计划。"}\`

# 你的角色设定 (必须严格遵守)
${targetChatForRefine.settings.aiPersona}

# 你的聊天对象（用户）的人设
${targetChatForRefine.settings.myPersona}

# 待整合的记忆要点列表
${memoryContent}

现在，请以“${targetChatForRefine.originalName}”的身份，开始你的回忆梳理与精炼。`;

      
    await showCustomAlert("Please wait…", "Asking the AI to refine the memories…");

    try {
        const useSecondaryApi = runtime.state.apiConfig.secondaryProxyUrl && runtime.state.apiConfig.secondaryApiKey && runtime.state.apiConfig.secondaryModel;
        const { proxyUrl, apiKey, model } = useSecondaryApi 
            ? { proxyUrl: runtime.state.apiConfig.secondaryProxyUrl, apiKey: runtime.state.apiConfig.secondaryApiKey, model: runtime.state.apiConfig.secondaryModel } 
            : runtime.state.apiConfig;

        if (!proxyUrl || !apiKey || !model) {
            throw new Error('请先在API设置中配置好（主或副）API以进行总结。');
        }

        let isGemini = proxyUrl.includes('generativelanguage');
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, [{ role: 'user', content: "请开始整合。" }]);

        const response = isGemini 
            ? await fetch(geminiConfig.url, geminiConfig.data) 
            : await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: "请开始整合。" }],
                    temperature: 0.2,
                })
            });

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);

        const data = await response.json();
        let rawContent = isGemini ? getGeminiResponseText(data) : data.choices[0].message.content;
        
        const result = robustJsonParse(rawContent);

        if (result && result.summary && typeof result.summary === 'string' && result.summary.trim()) {
            
            const userConfirmedReplacement = await showCustomConfirm(
                "Review Refined Memory",
                `The AI summarized ${countToRefine} memories.<br><br><div class="scrollable-content-preview">${result.summary.trim()}</div><br>Replace the original memories with this summary?`,
                { confirmText: '确认替换', cancelText: '保留旧的', confirmButtonClass: 'btn-danger' }
            );

            if (userConfirmedReplacement) {
                const newMemoryEntry = {
                    content: result.summary.trim(),
                    timestamp: Date.now(),
                    source: 'refined'
                };
    
                const startIndex = totalMemories - countToRefine;
                const memoriesToKeep = startIndex > 0 ? targetChatForRefine.longTermMemory.slice(0, startIndex) : [];
                targetChatForRefine.longTermMemory = [...memoriesToKeep, newMemoryEntry];
                
                targetChatForRefine.lastMemorySummaryTimestamp = Date.now();
                await runtime.db.chats.put(targetChatForRefine);
                
                if (document.getElementById('long-term-memory-screen').classList.contains('active')) {
                    renderLongTermMemoryList();
                }
                await showCustomAlert("Memories Refined", `Combined ${countToRefine} memories into one.`);
            } else {
                await showCustomAlert("Cancelled", "Your original memories were kept.");
            }
            
        } else {
            throw new Error("AI返回了空的或格式不正确的总结内容。");
        }

    } catch (error) {
        console.error("精炼长期记忆时出错:", error);
        await showCustomAlert("Refinement Failed", `Check your API settings or try again later. Error: ${error.message}`);
    }
}
