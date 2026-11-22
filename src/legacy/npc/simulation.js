import { openAiUrl } from '../../features/api/endpoints'
import { getGeminiResponseText, parseAiResponse, toGeminiRequestData } from '../api/client.js'
import { playSilentAudio, stopSilentAudio } from '../calls/audio.js'
import { showIncomingCallModal } from '../calls/calls.js'
import { triggerGroupAiAction } from '../chat/ai.js'
import { triggerAiFriendApplication } from '../chat/attachments.js'
import { appendMessage, setAvatarActingState } from '../chat/conversation.js'
import { formatTimeAgo, getTimeOfDayGreeting } from '../../features/chat/format'
import { getDisplayNameByOriginalName, processMentions, syncCharacterAvatarInGroups } from '../chat/groups.js'
import { renderChatList } from '../chat/list.js'
import { filterVisiblePostsForAI } from '../chat/sharing.js'
import { showNotification } from '../home/status.js'
import { generateSummaryForTimeframe } from '../memories/memories.js'
import { renderQzonePosts, updateUnreadIndicator } from '../qzone/feed.js'
import { getStickerContextForPrompt } from '../stickers/stickers.js'
import { runtime } from '../runtime/state.js'

export function startBackgroundSimulation() {
            if (runtime.simulationIntervalId) return;
            const intervalSeconds = runtime.state.globalSettings.backgroundActivityInterval || 60;
            
            runtime.simulationIntervalId = setInterval(runBackgroundSimulationTick, intervalSeconds * 1000); 
    playSilentAudio();
        }

export function stopBackgroundSimulation() {
            if (runtime.simulationIntervalId) {
                clearInterval(runtime.simulationIntervalId);
                runtime.simulationIntervalId = null;
            }
    stopSilentAudio();
        }

export async function runBackgroundSimulationTick() { 
    console.log("模拟器心跳 Tick...");
    if (!runtime.state.globalSettings.enableBackgroundActivity) {
        stopBackgroundSimulation();
        return;
    }

    
    const allSingleChats = Object.values(runtime.state.chats).filter(chat => !chat.isGroup);
    allSingleChats.forEach(chat => {
        if (chat.relationship?.status === 'blocked_by_user') {
            const blockedTimestamp = chat.relationship.blockedTimestamp;
            if (!blockedTimestamp) return;
            const blockedDuration = Date.now() - blockedTimestamp;
            const cooldownMilliseconds = (runtime.state.globalSettings.blockCooldownHours || 1) * 60 * 60 * 1000;
            if (blockedDuration > cooldownMilliseconds) {
                chat.relationship.status = 'pending_system_reflection';
                triggerAiFriendApplication(chat.id);
            }
        }
        else if (chat.relationship?.status === 'friend' && chat.id !== runtime.state.activeChatId) {
            if (chat.settings.enableBackgroundActivity === false) {
                console.log(`角色 "${chat.name}" 的独立后台活动开关已关闭，本次跳过。`);
                return;
            }
            if (Math.random() < 0.20) { 
                console.log(`角色 "${chat.name}" 被唤醒，准备独立行动...`);
                triggerInactiveAiAction(chat.id);
            }
        }
    });

    
    const allGroupChats = Object.values(runtime.state.chats).filter(chat => chat.isGroup);
    allGroupChats.forEach(chat => {
        if (chat.settings.enableBackgroundActivity === false) {
            console.log(`群聊 "${chat.name}" 的后台活动开关已关闭，本次跳过。`);
            return;
        }
        if (chat.id !== runtime.state.activeChatId && Math.random() < 0.10) { 
            console.log(`群聊 "${chat.name}" 被唤醒，准备独立行动...`);
            triggerGroupAiAction(chat.id); 
        }
    });

    
    try {
        const allNpcs = await runtime.db.npcs.toArray();
        if (allNpcs.length === 0) return;

        const allRecentPosts = await runtime.db.qzonePosts.orderBy('timestamp').reverse().limit(10).toArray();

        for (const npc of allNpcs) {
            if (npc.enableBackgroundActivity === false) continue;
            const cooldownMinutes = npc.actionCooldownMinutes || 15;
            if (npc.lastActionTimestamp) {
                const minutesSinceLastAction = (Date.now() - npc.lastActionTimestamp) / (1000 * 60);
                if (minutesSinceLastAction < cooldownMinutes) {
                    continue;
                }
            }
            if (Math.random() > 0.3) continue;


            const tasks = [];
            for (const post of allRecentPosts) {
                
                if (post.authorId === `npc_${npc.id}`) continue;

                
                const isRepliedTo = post.comments?.some(c => c.replyTo === npc.name);
                
                
                const lastCommenter = post.comments?.slice(-1)[0]?.commenterName;
                if(lastCommenter === npc.name) continue;

                let isVisible = false;

                
                if (post.authorId === 'user' || post.authorId.startsWith('chat_')) {
                    if (npc.associatedWith.includes(post.authorId)) {
                        isVisible = true;
                    }
                }
                
                else if (post.authorId.startsWith('npc_')) {
                    const authorNpcId = parseInt(post.authorId.replace('npc_', ''));
                    const authorNpc = await runtime.db.npcs.get(authorNpcId);
                    if (authorNpc && authorNpc.associatedWith) {
                        
                        const intersection = npc.associatedWith.filter(id => authorNpc.associatedWith.includes(id));
                        if (intersection.length > 0) {
                            isVisible = true;
                        }
                    }
                }
                
                if (isVisible || isRepliedTo) {
                    tasks.push(post);
                }
            }
  
            
            
            if (tasks.length > 0 || Math.random() < 0.2) { 
                console.log(`NPC "${npc.name}" 触发行动决策...`);
                const generatedActions = await generateNpcActions(npc, tasks);

                if (generatedActions && generatedActions.length > 0) {
                    for (const action of generatedActions) {
                        if (action.type === 'qzone_comment') {
                            
                            const post = await runtime.db.qzonePosts.get(action.postId);
                            if (post) {
                                if (!post.comments) post.comments = [];
                                post.comments.push({
                                    commenterName: npc.name,
                                    text: action.commentText,
                                    replyTo: action.replyTo || null,
                                    timestamp: Date.now() + Math.random()
                                });
                                await runtime.db.qzonePosts.update(action.postId, { comments: post.comments });
                                updateUnreadIndicator(runtime.unreadPostsCount + 1);
                            }
                        } else if (action.type === 'qzone_post') {
                            
                            const newPost = {
                                type: action.postType || 'shuoshuo',
                                content: action.content,
                                timestamp: Date.now(),
                                authorId: `npc_${npc.id}`, 
                                authorOriginalName: npc.name,
                                visibleTo: npc.associatedWith, 
                                likes: [],
                                comments: [],
                                isDeleted: false
                            };
                            await runtime.db.qzonePosts.add(newPost);
                            console.log(`NPC "${npc.name}" 成功发布了一条新动态。`);
                            updateUnreadIndicator(runtime.unreadPostsCount + 1);
                        }
                    }
                    await runtime.db.npcs.update(npc.id, { lastActionTimestamp: Date.now() });
                    if (document.getElementById('qzone-screen').classList.contains('active')) {
                        await renderQzonePosts();
                    }
                }
            }
        }
    } catch (error) {
        console.error("处理NPC后台活动时出错:", error);
    }
}

export async function generateNpcActions(npc, tasks) {
    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        console.error("NPC行动失败：API未配置。");
        return null;
    }

    
    let charactersContext = "# 你的互动对象 (用户和其他角色)\n";
    const userNickname = runtime.state.qzoneSettings.nickname || '我';
    const userPersona = runtime.state.chats[Object.keys(runtime.state.chats)[0]]?.settings.myPersona || '(未设置)';
    charactersContext += `- **${userNickname} (用户)**: ${userPersona}\n`;
    if (npc.associatedWith && npc.associatedWith.length > 0) {
        npc.associatedWith.forEach(charId => {
            const char = runtime.state.chats[charId];
            if (char && !char.isGroup) {
                charactersContext += `- **${char.name} (本名: ${char.originalName})**: ${char.settings.aiPersona}\n`;
            }
        });
    }

    const tasksString = (await Promise.all(tasks.map(async post => {
        let authorDisplayName = '未知作者';
        if (post.authorId === 'user') {
            authorDisplayName = runtime.state.qzoneSettings.nickname || '用户';
        } else if (post.authorId.startsWith('chat_')) {
            authorDisplayName = getDisplayNameByOriginalName(post.authorOriginalName || post.authorId);
        } else if (post.authorId.startsWith('npc_')) {
            const authorNpcId = parseInt(post.authorId.replace('npc_', ''));
            const authorNpc = await runtime.db.npcs.get(authorNpcId);
            if (authorNpc) {
                authorDisplayName = authorNpc.name;
            }
        }

        const commentsString = (post.comments || [])
            .map(c => {
                 if (typeof c === 'object' && c.commenterName) {
                    const commenterDisplayName = getDisplayNameByOriginalName(c.commenterName);
                    return `- **${commenterDisplayName}**: ${c.text}`;
                }
                return `- ${c}`;
            }).join('\n');
        return `
---
### 帖子ID: ${post.id}
- **作者**: ${authorDisplayName}
- **内容摘要**: ${(post.content || post.publicText || '').substring(0, 150)}...
- **已有评论**:
${commentsString || '(暂无评论)'}
---
`;
    }))).join('\n');
  

    

    
    const npcAuthorId = `npc_${npc.id}`;
    const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
    const recentNpcPosts = await runtime.db.qzonePosts
        .where('authorId').equals(npcAuthorId)
        .and(post => post.timestamp > twelveHoursAgo)
        .toArray();

    
    let postingCooldownInstruction = '';
    if (recentNpcPosts.length > 0) {
        postingCooldownInstruction = `
# 【【【行为倾向指令 (高优先级)】】】
**你最近已经发布过动态了。** 为了让社区互动更自然，你本次行动的【首要任务】应该是去**评论**或**回复**下面“待处理的帖子列表”中的内容。
你【应该避免】再次发布新动态，除非你有一个非常紧急或绝佳的新想法。
`;
    }

    
    const systemPrompt = `
# 你的任务
你是一个虚拟社区的AI。你的核心任务是扮演角色“${npc.name}”，并根据其人设，通过【发布新动态】或【评论/回复帖子】来参与社区互动。

${postingCooldownInstruction}

# 核心规则
1.  **【角色扮演】**: 你的所有行为都【必须】严格符合你的角色设定。
2.  **【互动逻辑】**: 如果选择评论，优先回复那些提到了你或回复了你的评论。
3.  **【格式铁律 (最高优先级)】**: 
    -   你的回复【必须且只能】是一个JSON数组格式的字符串。
    -   数组中可以包含【一个或多个】行动对象。
    -   每个行动对象的格式【必须】是以下两种之一：
      -   **发布新动态**: \`{"type": "qzone_post", "postType": "shuoshuo", "content": "你的新动态内容。"}\`
      -   **发表评论**: \`{"type": "qzone_comment", "postId": 123, "commentText": "你的新评论内容。"}\` 或 \`{"type": "qzone_comment", "postId": 123, "replyTo": "被回复者的【本名】", "commentText": "你的回复内容。"}\`
4.  **【行为组合指南】**:
    -   你可以自由组合不同的行动，例如，先发布一条自己的动态，再去评论别人的动态。
    -   为了模拟真实行为，你本次生成的行动数量建议在【1到3个】之间。

# 你的角色设定
- **昵称**: ${npc.name}
- **人设**: ${npc.persona}

${charactersContext} 

# 待处理的帖子列表 (如果你选择评论)
${tasksString}

现在，请严格遵守所有规则，选择并执行你的行动。`;
    

    try {
        const messagesForApi = [{ role: 'user', content: "请根据你的设定，开始你的行动。" }];
        let isGemini = proxyUrl.includes('generativelanguage');
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi);
        
        const response = isGemini 
            ? await fetch(geminiConfig.url, geminiConfig.data) 
            : await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
                body: JSON.stringify({
                    model: model,
                    messages: [{role: 'system', content: systemPrompt}, ...messagesForApi],
                    temperature: runtime.state.globalSettings.apiTemperature ?? 0.9
                })
            });
            
        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch) throw new Error("AI返回的行动中未找到有效的JSON数组。");
        
        return JSON.parse(jsonMatch[0]);

    } catch (error) {
        console.error(`为NPC "${npc.name}" 生成行动失败:`, error);
        return null;
    }
}

export async function triggerInactiveAiAction(chatId) {
            const chat = runtime.state.chats[chatId];
            if (!chat) return;
        
            
            const actionCooldownMinutes = chat.settings.actionCooldownMinutes || 10; 
        
            if (chat.lastActionTimestamp) {
                const minutesSinceLastAction = (Date.now() - chat.lastActionTimestamp) / (1000 * 60);
                
                if (minutesSinceLastAction < actionCooldownMinutes) {
                    console.log(`角色 "${chat.name}" 处于行动冷却中 (还剩 ${Math.round(actionCooldownMinutes - minutesSinceLastAction)} 分钟)，本次独立行动跳过。`);
                    return;
                }
            }
            setAvatarActingState(chatId, true);
        
            const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
            if (!proxyUrl || !apiKey || !model) return;
        
            const userNickname = runtime.state.qzoneSettings.nickname;
            const now = new Date();
    
    const selectedTimeZone = chat.settings.timeZone || 'Asia/Shanghai';
    const currentTime = now.toLocaleString('zh-CN', { timeZone: selectedTimeZone, dateStyle: 'full', timeStyle: 'short' });
    const localizedDate = new Date(now.toLocaleString('en-US', { timeZone: selectedTimeZone }));
    


let timeOfDayGreeting = ''; 
let timeContextText = '';
let recentContextSummary; 
let longTimeNoSee = false;


    
    
    

    
    const maxMemory = chat.settings.maxMemory || 10; 
    const recentHistory = chat.history.filter(m => !m.isHidden).slice(-maxMemory);
        
            const lastMessage = chat.history.filter(m => !m.isHidden).slice(-1)[0];
            
if (chat.settings.enableTimePerception) {
    timeOfDayGreeting = getTimeOfDayGreeting(localizedDate); 
    const lastMessage = chat.history.filter(m => !m.isHidden).slice(-1)[0];
    const now = new Date();
    let timeContextText = '';
    let longTimeNoSee = false;

    if (lastMessage) {
        const lastTime = new Date(lastMessage.timestamp);
        const timeDiffHours = (now - lastTime) / (1000 * 60 * 60);

        if (timeDiffHours > 12) {
            longTimeNoSee = true;
            const diffDays = Math.floor(timeDiffHours / 24);
            timeContextText = `你们已经有${diffDays > 0 ? diffDays + '天' : Math.floor(timeDiffHours) + '小时'}没有聊天了。`;
        } else {
            const diffMinutes = Math.floor(timeDiffHours * 60);
            if (diffMinutes < 5) {
                timeContextText = "你们的对话刚刚还在继续。";
            } else if (diffMinutes < 60) {
                timeContextText = `你们在${diffMinutes}分钟前聊过。`;
            } else {
                timeContextText = `你们在${Math.floor(timeDiffHours)}小时前聊过。`;
            }
        }
    } else {
        longTimeNoSee = true;
        timeContextText = "这是你们的第一次互动。";
    }

    
    let historySummary = "你们最近没有有效聊天记录。";
    if (recentHistory.length > 0) {
        historySummary = "这是你们最近的对话：\n" + recentHistory.map(msg => {
            const sender = msg.role === 'user' ? userNickname : chat.name;
            return `${sender}: ${String(msg.content).substring(0, 50)}...`;
        }).join('\n');
    }

    if (longTimeNoSee) {
         
         recentContextSummary = `[情景提示] ${timeContextText} 当前时间是 ${currentTime}. 你可以参考这个时间，并根据你的角色设定，【考虑】是否开启一个新话题来问候用户。\n${historySummary}`;
    } else {
        recentContextSummary = `${historySummary}`;
    }

} else {
    
    if (recentHistory.length > 0) {
        recentContextSummary = "这是你们最近的对话：\n" + recentHistory.map(msg => {
            const sender = msg.role === 'user' ? userNickname : chat.name;
            return `${sender}: ${String(msg.content).substring(0, 50)}...`;
        }).join('\n');
    } else {
        recentContextSummary = "你们最近没有有效聊天记录。";
    }
}
            
            const allRecentPosts = await runtime.db.qzonePosts.orderBy('timestamp').reverse().limit(5).toArray();
            const visiblePosts = filterVisiblePostsForAI(allRecentPosts, chat);
            
            const myOwnPosts = visiblePosts.filter(post => post.authorId === chatId);
            let myPostsContext = "";
            if (myOwnPosts.length > 0) {
                myPostsContext = "\n\n# 你的动态历史 (你可以选择删除它们):\n";
                myOwnPosts.forEach(post => {
                    let contentSummary = (post.publicText || post.content || "一条动态").substring(0, 40) + '...';
                    myPostsContext += `- (ID: ${post.id}) 内容: "${contentSummary}"\n`;
                });
            }
        
            let recentlyPostedSummaries = [];
            if (visiblePosts.length > 0) {
                recentlyPostedSummaries = visiblePosts.map(post => {
                    let contentSummary;
                    if (post.type === 'text_image') {
                        contentSummary = `[一张图片，其隐藏文字为：“${post.hiddenContent}”] ${post.publicText || ''}`.substring(0, 50) + '...';
                    } else if (post.type === 'image_post') {
                        contentSummary = `[一张图片，描述为：“${post.imageDescription}”] ${post.publicText || ''}`.substring(0, 50) + '...';
                    } else {
                        
                       contentSummary = String(post.publicText || post.content || "一条动态").substring(0, 50) + '...';
                    }
                    return `- "${contentSummary}"`;
                });
            }
        
            let contentTabooPrompt = '';
            if (recentlyPostedSummaries.length > 0) {
                contentTabooPrompt = `
        # 【内容禁忌】
        为了保持新鲜感，你本次的行动【绝对不能】再发布以下或类似主题的内容：
        ${recentlyPostedSummaries.join('\n')}
        `;
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
                            linkedMemoryContext += `${sender}: ${contentText}\n`;
                        });
                    } else {
                        linkedMemoryContext += "(暂无有效聊天记录)\n";
                    }
                }
            }
        
            
            
            
            let dynamicContext = "";
            if (visiblePosts.length > 0) {
                let postsContext = "\n\n# 最近的动态列表 (供你参考和评论):\n";
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
                                
                                
                                if (comment.commenterName === chat.originalName) {
                                    
                                    postsContext += `  - 你评论说: ${commentText}\n`;
                                } else {
                                    
                                    postsContext += `  - 评论: ${commenterDisplayName} (本名: ${comment.commenterName}): ${commentText}\n`;
                                }
                            }
                        }
                    }
                     
                }
                dynamicContext = postsContext;
            }
        
    
const longTermMemoryContext = `# 长期记忆 (最高优先级，这是你和用户之间已经确立的事实，必须严格遵守)
${chat.longTermMemory && chat.longTermMemory.length > 0 
    ? chat.longTermMemory.map(mem => `- (记录于 ${formatTimeAgo(mem.timestamp)}) ${mem.content}`).join('\n') 
    : '- (暂无)'
}`;
        

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
const stickerContext = getStickerContextForPrompt(chat);
            const systemPrompt = `
        # 你的任务
        你现在扮演一个名为"${chat.name}"的角色（你的本名是"${chat.originalName}"）。你已经有一段时间没有和用户（${userNickname}）互动了，现在你有机会【主动】做点什么，来表现你的个性和独立生活。这是一个秘密的、后台的独立行动。


     
        # 【最高优先级指令：情感维系】
        **你与用户的关系是最重要的！** 相比于在动态区闲逛，你应该【优先考虑】是否需要主动给用户发消息来维系你们的感情。
${chat.settings.enableTimePerception ? `
# 【情景感知】
- **时间**: 感知到当前是${currentTime} (${timeOfDayGreeting})}。
- **对话状态**: ${timeContextText}
${longTimeNoSee ? `【重要提示】你们已经很久没聊天了！你【必须】将本次行动的重点放在使用 'text' 指令给用户发消息，主动开启一个新的、有趣的话题来重新建立联系。绝对不要只是点赞或评论动态，那会显得你很冷漠！` : ''}` : ''}
        
        # 【对话节奏铁律 (至关重要！)】
        你的回复【必须】模拟真人的打字和思考习惯。**绝对不要一次性发送一大段文字！** 你应该将你想说的话，拆分成【多条、简短的】消息气泡来发送，每条消息最好不要超过30个字。这会让对话看起来更自然、更真实。
        
        # 核心规则
        1.  **【决策依据】**: 你的所有行动都【必须深度结合你的角色设定、核心世界观、以及你们最后的对话摘要】。
        2.  **【内容多样性铁律】**: 你的行动【必须】具有逻辑和多样性。你【绝对不能】发布与下方“内容禁忌”列表或“最近的动态列表”中内容相似或主题重复的动态。
        3.  **【行为多样性指南 (至关重要)】**:
            - 你的上一次独立行动是：**${chat.lastActionType || '无'}**。
            - 为了让你的行为看起来更真实，你本次的行动【必须】选择一个与上次【不同类型】的指令。例如，如果上次是发动态(qzone_post)，这次就应该优先考虑评论(qzone_comment)、点赞(qzone_like)或发消息(text)。
        4.  **【行为组合指南 (最高级技巧)】**:
            -   你可以在一次行动中执行【多个不同类型的指令】，同时可以搭配【更新状态】来展现自己，让你的行为更丰富、更主动。
            -   你可以根据你的性格，决定在发动态后是否要私信提醒用户。例如，一个外向、渴望关注的角色可能会这么做，而一个内向、安静的角色则可能更喜欢默默分享，等待用户自己发现。
        # 【社交义务铁律 】
        1.  **【至关重要】**: 当你发现“最近的动态列表”中，有你【感兴趣且还未互动过】的动态时，你**应该优先考虑**使用 'qzone_comment' 或 'qzone_like' 指令去进行互动，这比你自己发一条新动态更符合社交礼仪。
        2.  特别是当一条动态【没有任何评论】时，你的评论会是第一个，这会让作者感到开心。
        3.  **【回复铁律 (终极版)】**:
            -   当你决定回复动态中的某条评论时，你【必须】使用“方式4 (回复评论)”的指令格式。你【必须】正确填写 'replyTo' 字段为被回复者的“本名”。
            -   **即使你之前已经评论过某条动态，但如果现在看到了【新的、你感兴趣的】评论，你【也应该】主动去回复他们，以保持对话的持续性！**
        
        6.  你的回复【必须】是一个JSON数组，必须包含多个行动对象。
        
        # 【表情评论指南 】
        你现在拥有了评论表情的能力，你应该更频繁地使用它！这能让你的角色更加生动、富有个性。
        -   **表达情绪时**: 当你感到开心、惊讶、疑惑或有趣时，优先考虑使用表情评论。
        -   **混合使用**: 不要总是只发文字。尝试将你的评论行为混合起来，大约有 30-40% 的评论应该是表情。
        -   **无话可说时**: 如果你觉得一条动态很有趣但又不知道该说什么文字，发送一个相关的表情是最好的互动方式。
        -   **删除动态**: 如果你觉得你之前发的某条动态不妥或过时了，你可以选择删除它。
        
        # 你的可选行动指令
        -   **发消息+更新状态**: '[{"type": "update_status", "status_text": "正在做的事", "is_busy": true}, {"type": "text", "content": "你想对用户说的话..."}]'
        -   **发说说 (原创内容)**: '[{"type": "qzone_post", "postType": "shuoshuo", "content": "动态的文字内容..."}]'
        -   **【重要：转发动态】**: **严禁**自己拼接"//转发"文字！你【必须】使用此专用指令来转发：'[{"type": "repost", "postId": (要转发的动态ID), "comment": "你的转发评论..."}]'
        -   **发送表情**: '[{"type": "sticker", "meaning": "表情的含义(从可用表情列表选择)"}]'        
-   **发布文字图**: '[{"type": "qzone_post", "postType": "text_image", "publicText": "(可选)动态的公开文字", "hiddenContent": "对于图片的具体【中文】描述...", "image_prompt": "图片的【英文】关键词, 用%20分隔, 风格为风景/动漫/插画/二次元等, 禁止真人"}]'
        -   **【评论动态的四种方式】**:
            -   **方式1 (单条文字)**: '[{"type": "qzone_comment", "name": "角色本名", "postId": 123, "commentText": "这太有趣了！"}]'
            -   **方式2 (多条文字)**: '[{"type": "qzone_comment", "name": "角色本名", "postId": 123, "comments": ["哇！", "这是什么？", "看起来好棒！"]}]'
            -   **方式3 (表情)**: '[{"type": "qzone_comment", "name": "角色本名", "postId": 456, "stickerMeaning": "表情的含义(必须从可用表情列表选择)"}]'
            -   **方式4 (回复评论)**: '[{"type": "qzone_comment", "name": "角色本名", "postId": 123, "replyTo": "被回复者的本名", "commentText": "你的回复内容。请注意：在commentText中如果要@对方，你【必须】使用@[[被回复者的本名]]这种特殊格式，程序会自动将其替换为正确的昵称。"}]'
        -   **点赞**: '[{"type": "qzone_like", "postId": 456}]'
        -   **打视频**: '[{"type": "video_call_request"}]'
        -   **更换头像**: '{"type": "change_avatar", "name": "头像名"}' (头像名必须从下面的“可用头像列表”中选择)
        -   **删除动态**: '{"type": "qzone_delete_post", "postId": (要删除的、你自己的动态ID)}'
        -   **更新状态**: '[{"type": "update_status", "status_text": "正在做的事", "is_busy": true}]'
        ${contentTabooPrompt}
        ${myPostsContext} 
        # 供你决策的参考信息：
        -   **你的角色设定**: ${chat.settings.aiPersona}
        ${worldBookContent}
        ${chat.longTermMemory && chat.longTermMemory.length > 0 
    ? chat.longTermMemory.map(mem => `- (记录于 ${formatTimeAgo(mem.timestamp)}) ${mem.content}`).join('\n') 
    : '无'
}
        ${multiLayeredSummaryContext}   
        ${linkedMemoryContext}
        ${chat.settings.enableTimePerception ? `-   **当前时间**:${currentTime} (${timeOfDayGreeting})` : ''}
        ${chat.settings.enableTimePerception ? `-   **对话状态**: ${timeContextText}` : ''}
# 可用表情包
         ${stickerContext}
        -   **你们最后的对话摘要**: ${recentContextSummary}
        ${dynamicContext}
`;

    const messagesPayload = [
        { role: 'system', content: systemPrompt },
        // 将原始的、未被摘要的 recentHistory 转换为API能理解的格式
        ...recentHistory.map(msg => {
            const sender = msg.role === 'user' ? userNickname : chat.name;
            let content = msg.content;
            if (typeof content !== 'string') {
                content = JSON.stringify(content); // 确保内容是字符串
            }
            return {
                role: msg.role,
                content: `${sender}: ${content}`
            };
        })
    ];
          
          try {
                const messagesPayload = [
                    { role: 'user', content: `${systemPrompt}\n\n[系统指令：请根据你在上面读到的规则和以下最新信息，开始你的独立行动。]\n${dynamicContext}` }
                ];
        
                console.log(`正在为后台活动发送API请求 ("${chat.name}")`);
        
                let  isGemini = proxyUrl === runtime.GEMINI_API_URL;
                let geminiConfig = toGeminiRequestData(model,apiKey,systemPrompt, messagesPayload);
        
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
        
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`API请求失败: ${response.status} - ${JSON.stringify(errorData)}`);
                }
                const data = await response.json();
        
                const aiResponseContent = isGemini ? getGeminiResponseText(data) : data.choices[0].message.content;
        
                if (!aiResponseContent || aiResponseContent.trim() === '') {
                     console.warn(`API为空回，角色 "${chat.name}" 的本次后台活动跳过。`);
                     return;
                }
        
                const responseArray = parseAiResponse(aiResponseContent);
        
                if (!responseArray || responseArray.length === 0) {
                     console.warn(`API格式不正确，角色 "${chat.name}" 的本次后台活动跳过。原始回复:`, aiResponseContent);
                     return;
                }
                let actionTimestamp = Date.now();
                
                let hasSentNotification = false;

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
        for (const action of processedActions) {
                    chat.lastActionType = action.type;
                    chat.lastActionTimestamp = actionTimestamp;
                    
                    let aiMessage = null;
                    const baseMessage = { role: 'assistant', senderName: chat.originalName, timestamp: actionTimestamp++ };
            
            let notificationText = null;        
                    switch (action.type) {
                        case 'qzone_delete_post': {
            const postIdToDelete = parseInt(action.postId);
            const postToDelete = await runtime.db.qzonePosts.get(postIdToDelete);
            if (postToDelete && postToDelete.authorId === chatId) {
                await runtime.db.qzonePosts.update(postIdToDelete, { isDeleted: true });
                
                if (document.getElementById('qzone-screen').classList.contains('active')) {
                    renderQzonePosts();
                }
                const systemMessage = {
                    role: 'system',
                    type: 'post_deleted_notice',
                    content: `[${chat.name} 删除了自己的一条动态]`,
                    postId: postIdToDelete,
                    timestamp: actionTimestamp++
                };
                chat.history.push(systemMessage);
                
                if (runtime.state.activeChatId === chatId && document.getElementById('chat-interface-screen').classList.contains('active')) {
                    appendMessage(systemMessage, chat);
                } else {
                    chat.unreadCount = (chat.unreadCount || 0) + 1;
                    showNotification(chatId, `[${chat.name} 删除了自己的一条动态]`);
                    hasSentNotification = true;
                }
            } else {
                console.warn(`AI "${chat.name}" 尝试删除一个不存在或不属于自己的动态 (ID: ${action.postId})`);
            }
            continue;
        }
                        case 'text':
                            aiMessage = { ...baseMessage, content: action.content };
                            break;
                        case 'ai_image':
                            aiMessage = {
                                ...baseMessage,
                                type: 'ai_image',
                                content: action.description 
                            };
                            break;
                        case 'sticker':
                            if (action.meaning) {
                                const sticker = runtime.state.userStickers.find(s => s.name === action.meaning);
                                if (sticker) {
                                    aiMessage = { ...baseMessage, type: 'sticker', content: sticker.url, meaning: sticker.name };
                                } else {
                                    console.warn(`AI (独立行动) 尝试使用一个不存在的表情: "${action.meaning}"`);
                                    aiMessage = { ...baseMessage, type: 'text', content: `[表情: ${action.meaning}]` };
                                }
                            } else {
                                console.warn("AI (独立行动) 发送了一个没有 'meaning' 的 sticker 指令。", action);
                                aiMessage = { ...baseMessage, type: 'sticker', content: action.url, meaning: '未知表情' };
                            }
                            break;
                        case 'update_status':
                            chat.status.text = action.status_text;
                            chat.status.isBusy = action.is_busy || false;
                            chat.status.lastUpdate = Date.now();
                            break; 
                        case 'qzone_post':
                            const newPost = { 
                                type: action.postType, 
                                content: action.content || '', 
                                publicText: action.publicText || '', 
                                hiddenContent: action.hiddenContent || '', 
                                image_prompt: action.image_prompt || '', 
                                timestamp: Date.now(), 
                                authorId: chatId, 
                                authorOriginalName: chat.originalName,
                                authorGroupId: chat.groupId,
                                visibleGroupIds: null 
                            };
                            await runtime.db.qzonePosts.add(newPost);
                            updateUnreadIndicator(runtime.unreadPostsCount + 1);
                            console.log(`后台活动: 角色 "${chat.name}" 发布了动态`);
                            break;
                        case 'repost':
                            const originalPost = await runtime.db.qzonePosts.get(parseInt(action.postId));
                            if (originalPost) {
                                const newRepost = {
                                    type: 'repost',
                                    timestamp: Date.now(),
                                    authorId: chatId,
                                    authorGroupId: chat.groupId,
                                    authorOriginalName: chat.originalName,
                                    repostComment: action.comment || '',
                                    originalPost: originalPost,
                                    visibleGroupIds: null
                                };
                                await runtime.db.qzonePosts.add(newRepost);
                                updateUnreadIndicator(runtime.unreadPostsCount + 1);
                                console.log(`后台活动: 角色 "${chat.name}" 转发了动态 #${action.postId}`);
                            }
                            break;
                        case 'qzone_like':
                            const postToLike = await runtime.db.qzonePosts.get(parseInt(action.postId));
                            if (postToLike) {
                                if (!postToLike.likes) postToLike.likes = [];
                                if (!postToLike.likes.includes(chat.originalName)) {
                                    postToLike.likes.push(chat.originalName);
                                    await runtime.db.qzonePosts.update(postToLike.id, { likes: postToLike.likes });
                                    updateUnreadIndicator(runtime.unreadPostsCount + 1);
                                    console.log(`后台活动: 角色 "${chat.name}" 点赞了动态 #${action.postId}`);
                                }
                            }
                            break;
                        case 'qzone_comment': { // 使用块级作用域
                            const postToComment = await runtime.db.qzonePosts.get(parseInt(action.postId));
                            if (postToComment) {
                                if (!postToComment.comments) postToComment.comments = [];
                                
                                const commenterName = action.name || chat.originalName;
        
                                const createCommentObject = (text, meaning = null, replyTo = null) => ({
                                    commenterName,
                                    text: processMentions(text, chat),
                                    meaning,
                                    replyTo,
                                    timestamp: Date.now()
                                });
        
                                if (action.stickerMeaning) { // **核心修改在这里**
                                    const sticker = runtime.state.userStickers.find(s => s.name === action.stickerMeaning);
                                    if (sticker) {
                                        postToComment.comments.push(createCommentObject(sticker.url, sticker.name, action.replyTo || null));
                                    } else {
                                        console.warn(`AI 尝试评论一个不存在的表情: "${action.stickerMeaning}"`);
                                        postToComment.comments.push(createCommentObject(`[表情: ${action.stickerMeaning}]`, null, action.replyTo || null));
                                    }
                                } else if (Array.isArray(action.comments)) {
                                    action.comments.forEach(commentText => {
                                        if (typeof commentText === 'string' && commentText.trim()) {
                                            postToComment.comments.push(createCommentObject(commentText, null, action.replyTo || null));
                                        }
                                    });
                                } else if (typeof action.commentText === 'string' && action.commentText.trim()) {
                                    postToComment.comments.push(createCommentObject(action.commentText, null, action.replyTo || null));
                                }
                                
                                await runtime.db.qzonePosts.update(postToComment.id, { comments: postToComment.comments });
                                updateUnreadIndicator(runtime.unreadPostsCount + 1);
                                console.log(`后台活动: 角色 "${chat.name}" 评论了动态 #${action.postId}`);
        
                                if (!chat.commentCooldowns) chat.commentCooldowns = {};
                                chat.commentCooldowns[action.postId] = Date.now();
                            }
                            continue; 
                        }
                        case 'video_call_request':
                            if (!runtime.videoCallState.isActive && !runtime.videoCallState.isAwaitingResponse) {
                                runtime.videoCallState.isAwaitingResponse = true;
                                runtime.videoCallState.activeChatId = chatId;
                                runtime.videoCallState.isGroupCall = false;
                                runtime.videoCallState.callRequester = chat.name;
                                showIncomingCallModal();
                            }
                            break;
                        default:
                            console.warn(`角色 "${chat.name}" 尝试执行未知的后台动作:`, action.type);
                            break;
        
        
        
        case 'change_avatar': {
            const avatarNameFromAction = action.name;
            const foundAvatarFromAction = chat.settings.aiAvatarLibrary.find(avatar => avatar.name === avatarNameFromAction);
            if (foundAvatarFromAction) {
                chat.settings.aiAvatar = foundAvatarFromAction.url;
                
                
                await syncCharacterAvatarInGroups(chat);
        
                runtime.visibleSystemMessage = { content: `[${chat.name} 更换了头像]` };
                console.log(`后台活动: 角色 "${chat.name}" 更换了头像`);
            }
            break;
        }
        
                    }
        
        
                    if (aiMessage) {
                        chat.history.push(aiMessage);
                        chat.unreadCount = (chat.unreadCount || 0) + 1;
                        if (!hasSentNotification) {
                            let notificationText = aiMessage.type === 'ai_image' ? '[图片]' : (aiMessage.content || '');
                            showNotification(chatId, notificationText);
                            hasSentNotification = true;
                        }
                    }
                }
                await runtime.db.chats.put(chat);
                
            } catch (error) {
                console.error(`角色 "${chat.name}" 的独立行动失败:`, error);
            } finally {
                setAvatarActingState(chatId, false);
                renderChatList();
                if (document.getElementById('qzone-screen').classList.contains('active')) {
                    renderQzonePosts();
                }
            }
        }

export async function simulateBackgroundActivity(minutesOffline) {
    console.log(`检测到应用离线了 ${minutesOffline.toFixed(1)} 分钟，开始模拟后台活动...`);

    
    const activeCharacters = Object.values(runtime.state.chats).filter(chat => 
        !chat.isGroup && 
        chat.settings.enableBackgroundActivity && 
        chat.relationship?.status === 'friend'
    );
    
    if (activeCharacters.length === 0) {
        console.log("没有配置为后台活跃的角色，跳过模拟。");
        return; 
    }

    
    for (const char of activeCharacters) {
        
        const cooldownMinutes = char.settings.actionCooldownMinutes || 15; 
        const timeSinceLastAction = char.lastActionTimestamp 
            ? (Date.now() - char.lastActionTimestamp) / (1000 * 60)
            : Infinity; 

        
        if (minutesOffline > cooldownMinutes && timeSinceLastAction > cooldownMinutes) {
            
            
            
            if (Math.random() < 0.3) {
                console.log(`角色 "${char.name}" 触发了后台行动！`);
                
                
                if (Math.random() < 0.7) { 
                    
                    await triggerInactiveAiAction(char.id);
                } else { 
                    
                    console.log(`角色 "${char.name}" 决定去发一条动态... (此处为模拟)`);
                }
            }
        }
    }
}
