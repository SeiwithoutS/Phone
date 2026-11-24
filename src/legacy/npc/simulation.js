import { newReplyTurn, replyTimestamp } from '../../features/chat/reply-turns'
import { publishChatPost } from '../../features/social/activity'
import { postTransfer, transferCents, TransferError } from '../../features/bank/bank'
import { withConversationRequest } from '../../features/chat/sessions'
import { requestContextCompletion } from '../../features/api/completion'
import { getGeminiResponseText, parseAiResponse } from '../api/client.js'
import { playSilentAudio, stopSilentAudio } from '../calls/audio.js'
import { showIncomingCallModal } from '../calls/calls.js'
import { triggerGroupAiAction } from '../chat/ai.js'
import { triggerAiFriendApplication } from '../chat/attachments.js'
import { appendMessage, setAvatarActingState, updateChatHeaderStatus } from '../chat/conversation.js'
import { getTimeOfDayGreeting } from '../../features/chat/format'
import { processMentions, syncCharacterAvatarInGroups } from '../chat/groups.js'
import { renderChatList } from '../chat/list.js'
import { showNotification } from '../home/status.js'
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
        else if (chat.relationship?.status === 'friend') {
            if (chat.settings.scheduledMessages === true) {
                const lastMessage = chat.history.findLast(message => !message.isHidden && !message.isTemporary);
                const idleSince = Math.max(chat.lastActionTimestamp || 0, chat.lastScheduledAttemptAt || 0,
                    lastMessage?.timestamp || chat.status?.lastUpdate || 0);
                const cooldown = (chat.settings.actionCooldownMinutes || 10) * 60000;
                if (chat.settings.enableBackgroundActivity !== false && idleSince && Date.now() - idleSince >= cooldown) {
                    chat.lastScheduledAttemptAt = Date.now();
                    void triggerInactiveAiAction(chat.id, true).catch(error => console.error('Scheduled chat message failed', error));
                }
                return;
            }
            if (chat.id === runtime.state.activeChatId) return;
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

                
                const associations = npc.associatedWith ?? [];
                if (post.isDeleted) continue;
                if (post.authorId === 'user' || runtime.state.chats[post.authorId]) {
                    const groupIds = post.visibleGroupIds;
                    isVisible = associations.includes(post.authorId) && (!groupIds?.length || associations.some(id => groupIds.includes(runtime.state.chats[id]?.groupId)));
                }
                
                else if (String(post.authorId).startsWith('npc_')) {
                    const authorNpcId = parseInt(post.authorId.replace('npc_', ''));
                    const authorNpc = await runtime.db.npcs.get(authorNpcId);
                    if (authorNpc && authorNpc.associatedWith) {
                        
                        const intersection = associations.filter(id => authorNpc.associatedWith.includes(id));
                        if (intersection.length > 0) {
                            isVisible = true;
                        }
                    }
                }
                
                if (isVisible || (isRepliedTo && !post.visibleGroupIds?.length && !post.visibleTo?.length)) {
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
  

    

    
    const npcAuthorId = `npc_${npc.id}`;
    const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
    const recentNpcPosts = await runtime.db.qzonePosts
        .where('authorId').equals(npcAuthorId)
        .and(post => post.timestamp > twelveHoursAgo)
        .toArray();

    
    let postingCooldownInstruction = '';
    if (recentNpcPosts.length > 0) {
        postingCooldownInstruction = `
# Posting cooldown (high priority)
You posted recently. Prioritize commenting or replying to the pending posts supplied in context. Avoid a new post unless you have something unusually timely or worthwhile to share.
`;
    }

    
    const systemPrompt = `
# Participate in the community
Portray "${npc.name}". Act in character when posting or commenting. When choosing a comment to answer, prioritize mentions of you and replies to your own comments. Use the language established by the character, user, and relevant context.
${postingCooldownInstruction}

## Output (highest priority)
Return only a valid JSON array, starting with [ and ending with ]. Omit surrounding prose, explanation, and Markdown fences. Return one or more actions, preferably 1–3. You may combine a new post with comments on other posts. Use the actual ID and, for replies, the recipient's original name.

- New post: {"type":"qzone_post","postType":"shuoshuo","content":"Your new post"}
- Comment: {"type":"qzone_comment","postId":123,"commentText":"Your comment"}
- Reply: {"type":"qzone_comment","postId":123,"replyTo":"Recipient's original name","commentText":"Your reply"}

## Character
Nickname: ${npc.name}
Persona: ${npc.persona}
`;
    

    try {
        const response = await requestContextCompletion(undefined, { instructions: systemPrompt,
            task: 'NPC activity · ' + npc.name, scope: 'npc:' + npc.id, actorId: 'npc:' + npc.id,
            legacyPostIds: tasks.map(post => post.id), relatedChatIds: npc.associatedWith ?? [],
            request: [{ role: 'user', content: 'Choose whether to post or comment. Use only visible Qzone post IDs supplied in context.' }] });
            
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

export function triggerInactiveAiAction(chatId, messageOnly = false) {
    return withConversationRequest(chatId, () => runInactiveAiAction(chatId, messageOnly));
}

async function runInactiveAiAction(chatId, messageOnly) {
            const chat = runtime.state.chats[chatId];
            if (!chat || (messageOnly && !chat.settings.scheduledMessages)) return;

            const actionCooldownMinutes = chat.settings.actionCooldownMinutes || 10; 
        
            if (chat.lastActionTimestamp) {
                const minutesSinceLastAction = (Date.now() - chat.lastActionTimestamp) / (1000 * 60);
                
                if (minutesSinceLastAction < actionCooldownMinutes) {
                    console.log(`角色 "${chat.name}" 处于行动冷却中 (还剩 ${Math.round(actionCooldownMinutes - minutesSinceLastAction)} 分钟)，本次独立行动跳过。`);
                    return;
                }
            }
            if (!runtime.state.apiConfig.proxyUrl || !runtime.state.apiConfig.model) return;
            setAvatarActingState(chatId, true);
        
            const userNickname = runtime.state.qzoneSettings.nickname;
            const now = new Date();
    
    const selectedTimeZone = chat.settings.timeZone || 'Asia/Shanghai';
    const currentTime = now.toLocaleString('en-GB', { timeZone: selectedTimeZone, dateStyle: 'full', timeStyle: 'short' });
    const localizedDate = new Date(now.toLocaleString('en-US', { timeZone: selectedTimeZone }));
    


let timeOfDayGreeting = ''; 
let timeContextText = '';
let longTimeNoSee = false;
if (chat.settings.enableTimePerception) {
    timeOfDayGreeting = getTimeOfDayGreeting(localizedDate); 
    const lastMessage = chat.history.filter(m => !m.isHidden).slice(-1)[0];
    const now = new Date();

    if (lastMessage) {
        const lastTime = new Date(lastMessage.timestamp);
        const timeDiffHours = (now - lastTime) / (1000 * 60 * 60);

        if (timeDiffHours > 12) {
            longTimeNoSee = true;
            const diffDays = Math.floor(timeDiffHours / 24);
            timeContextText = `It has been ${diffDays > 0 ? diffDays + ' day(s)' : Math.floor(timeDiffHours) + ' hour(s)'} since you last talked.`;
        } else {
            const diffMinutes = Math.floor(timeDiffHours * 60);
            if (diffMinutes < 5) {
                timeContextText = "You were just talking.";
            } else if (diffMinutes < 60) {
                timeContextText = `You last talked ${diffMinutes} minute(s) ago.`;
            } else {
                timeContextText = `You last talked about ${Math.floor(timeDiffHours)} hour(s) ago.`;
            }
        }
    } else {
        timeContextText = "This is your first interaction.";
    }

}
const stickerContext = getStickerContextForPrompt(chat);
            const systemPrompt = `
# Independent character activity
You are "${chat.name}" (original name "${chat.originalName}"). Some time has passed since you interacted with ${userNickname}. Take an independent action out of view, in a way that shows your personality and life beyond the conversation. Use the language established by the character, user, and relevant context.

${messageOnly ? '## Scheduled message (highest priority)\nSend exactly one proactive message to the user. Return only a JSON array with one "text" action.' : '## Relationship and action rules'}
- Prioritize reaching out to the user when it would help maintain the relationship.
${chat.settings.enableTimePerception ? `- Current time: ${currentTime} (${timeOfDayGreeting}).\n- Recent interaction: ${timeContextText}${longTimeNoSee ? " A long time has passed. Send a text and open a fresh, interesting topic to reconnect. A like or comment alone is not enough." : ""}` : ''}
- Write brief, natural texts. In regular background activity, split longer thoughts into short messages, preferably no more than 30 characters each.
- Ground your choices in your persona, world information, and the latest exchange. Avoid forbidden topics and repeating the topics of recent posts.
- Your last independent action was "${chat.lastActionType || 'none'}". In regular background activity, choose a different kind of action. You can combine several different actions and an optional status update. Whether to message the user after posting depends on your character.
- Prefer reacting to an interesting post you have not interacted with over writing a new post. Consider being the first to comment. You can still reply to an interesting new comment on a post you already commented on.
- When replying to a comment, set "replyTo" to the recipient's original name. For mentions in "commentText", use @[[Original name]] so the app can render the nickname.
- Prefer sticker comments when they fit emotions such as happiness, surprise, confusion, or amusement. Aim for about 30–40% sticker comments. A relevant sticker works when you have little to say.
- Delete only your own inappropriate or outdated posts.

## Output and actions
Return only a valid JSON array, starting with [ and ending with ]. Omit surrounding prose, explanation, and Markdown fences. In regular background activity, return multiple action objects. Use actual post IDs. Use the dedicated action to repost, and do not add the literal //转发 marker yourself.

- Status and text: [{"type":"update_status","status_text":"What you are doing","is_busy":true},{"type":"text","content":"What you want to tell the user"}]
- Text post: {"type":"qzone_post","postType":"shuoshuo","content":"Your original post"}
- Repost: {"type":"repost","postId":123,"comment":"Your comment on the repost"}
- Sticker: {"type":"sticker","meaning":"Exact sticker meaning from the list"}
- Image post: {"type":"qzone_post","postType":"text_image","publicText":"Optional caption","hiddenContent":"Detailed description in Chinese","image_prompt":"English keywords separated by %20 for a landscape, anime, or illustration. No real people."}
- Comment: {"type":"qzone_comment","name":"Character's original name","postId":123,"commentText":"That's interesting!"}
- Multiple comments: {"type":"qzone_comment","name":"Character's original name","postId":123,"comments":["Wow!","What is that?","That looks great!"]}
- Sticker comment: {"type":"qzone_comment","name":"Character's original name","postId":456,"stickerMeaning":"Exact sticker meaning from the list"}
- Reply: {"type":"qzone_comment","name":"Character's original name","postId":123,"replyTo":"Recipient's original name","commentText":"@[[Recipient's original name]] Your reply"}
- Like: {"type":"qzone_like","postId":456}
- Video call: {"type":"video_call_request"}
- Change avatar: {"type":"change_avatar","name":"Name from the available avatar list"}
- Delete post: {"type":"qzone_delete_post","postId":123}
- Update status: {"type":"update_status","status_text":"What you are doing","is_busy":true}

## Character persona
${chat.settings.aiPersona}

## Available stickers
${stickerContext}
`;

    try {
        const response = await requestContextCompletion(chat, { instructions: systemPrompt, task: messageOnly ? 'Scheduled chat message' : 'QQ character background',
            request: [{ role: 'user', content: 'Choose an independent action based on the available context.' }] });
        
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`API请求失败: ${response.status} - ${JSON.stringify(errorData)}`);
                }
                const data = await response.json();
        
                const aiResponseContent = getGeminiResponseText(data);
        
                if (!aiResponseContent || aiResponseContent.trim() === '') {
                     console.warn(`API为空回，角色 "${chat.name}" 的本次后台活动跳过。`);
                     return;
                }
        
                const responseArray = parseAiResponse(aiResponseContent);
        
                if (!responseArray || responseArray.length === 0) {
                     console.warn(`API格式不正确，角色 "${chat.name}" 的本次后台活动跳过。原始回复:`, aiResponseContent);
                     return;
                }
                const turn = newReplyTurn();
                let actionTimestamp = replyTimestamp(chat.history);
                
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
        const viewingChat = runtime.state.activeChatId === chatId && document.getElementById('chat-interface-screen').classList.contains('active');
        for (const action of processedActions) {
                    if (messageOnly && (!chat.settings.scheduledMessages || action.type !== 'text')) continue;
                    if (chat.settings.scheduledMessages === false && action.type === 'text' && !messageOnly) continue;
                    if (chat.settings.allowSocialPosts === false && ['qzone_post', 'repost'].includes(action.type)) continue;
                    if (chat.settings.showCharacterStatus === false && action.type === 'update_status') continue;
                    chat.lastActionType = action.type;
                    chat.lastActionTimestamp = actionTimestamp;
                    
                    let aiMessage = null;
                    const baseMessage = { role: 'assistant', senderName: chat.originalName, timestamp: actionTimestamp++, ...turn };
            
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
                    timestamp: actionTimestamp++, ...turn
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
                        case 'transfer': {
                            if (chat.settings.allowBankTransfers === false) break;
                            const cents = transferCents(action.amount);
                            if (!Number.isSafeInteger(cents) || cents <= 0) break;
                            const id = crypto.randomUUID();
                            const note = typeof action.note === 'string' ? action.note.slice(0, 240) : '';
                            const message = { ...baseMessage, type: 'transfer', amount: cents / 100, note,
                                receiverName: 'You', status: 'accepted', bankTransferId: id };
                            try {
                                if (await postTransfer(runtime.db, { id, from: chatId, to: 'user', cents, note, timestamp: message.timestamp },
                                    chat, message)) aiMessage = message;
                            } catch (error) {
                                if (!(error instanceof TransferError)) throw error;
                            }
                            break;
                        }
                        case 'update_status':
                            if (typeof action.status_text !== 'string' || !action.status_text.trim()) break;
                            chat.status.text = action.status_text.trim().slice(0, 90);
                            chat.status.isBusy = action.is_busy || false;
                            chat.status.lastUpdate = Date.now();
                            if (viewingChat) updateChatHeaderStatus(chat);
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
                            await publishChatPost(chatId, newPost);
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
                        const viewing = runtime.state.activeChatId === chatId && document.getElementById('chat-interface-screen').classList.contains('active');
                        if (viewing) appendMessage(aiMessage, chat);
                        else chat.unreadCount = (chat.unreadCount || 0) + 1;
                        if (!viewing && !hasSentNotification && !aiMessage.bankTransferId) {
                            let notificationText = aiMessage.type === 'transfer' ? 'Bank transfer received' : aiMessage.type === 'ai_image' ? '[图片]' : (aiMessage.content || '');
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
