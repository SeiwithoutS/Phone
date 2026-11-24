import { completionText, requestContextCompletion } from '../../features/api/completion'
import { showChoiceModal, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { renderLongTermMemoryList } from '../memories/memories.js'
import { runtime } from '../runtime/state.js'

export function getGeminiResponseText(data) {
    const text = completionText(data);
    if (text) return text;
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
    const userNickname = runtime.state.qzoneSettings.nickname || 'the user';


    const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `
# Refine saved memories
You are "${targetChatForRefine.originalName}". Combine your saved memories with "${userNickname}" into one coherent, factual core memory. Write as the character in the first person ("I"). Use the language established by the character, user, and relevant context.

## What to keep
- Link the individual memories in chronological order.
- Retain important shared events, decisions, and agreed plans. Identify any plans or tasks still outstanding.
- Today is ${today}. Convert relative times such as "tomorrow" or "next week" to exact calendar dates.
- Write a clear personal record or event recap. Remove repetition, trivial details, and venting. Keep what matters to the story and relationship.
- Aim for about ${wordCount} characters.

## Output
Return only a valid JSON object, starting with { and ending with }. Omit surrounding prose, explanation, and Markdown fences.
{"summary":"Write the essential facts and plans in the first person."}

## Context
- Your persona: ${targetChatForRefine.settings.aiPersona}
- The user's persona: ${targetChatForRefine.settings.myPersona}

## Memories to combine
${memoryContent}
`;

      
    await showCustomAlert("Please wait…", "Asking the AI to refine the memories…");

    try {
        const response = await requestContextCompletion(targetChatForRefine, { instructions: systemPrompt, standalone: true,
            task: 'Refine selected memories', scope: 'memory:refine:' + targetChatForRefine.id,
            request: [{ role: 'user', content: 'Summarize the selected saved memories.' }] }, { temperature: 0.2 });

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);

        const data = await response.json();
        let rawContent = getGeminiResponseText(data);
        
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
