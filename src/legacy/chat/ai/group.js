import { resolveTimeZone } from '../../../features/chat/location'
import { regenerateReply } from '../../../features/chat/replies'
import { newReplyTurn, replyTimestamp } from '../../../features/chat/reply-turns'
import { withConversationRequest } from '../../../features/chat/sessions'
import { requestContextCompletion } from '../../../features/api/completion'
import { getGeminiResponseText, parseAiResponse } from '../../api/client.js'
import { appendMessage, setAvatarActingState } from '../conversation.js'
import { getDisplayNameInGroup } from '../groups.js'
import { renderChatList } from '../list.js'
import { showCustomAlert } from '../../dialogs/dialogs.js'
import { showNotification } from '../../home/status.js'
import { updateUnreadIndicator } from '../../qzone/feed.js'
import { findStickerForChat, getGroupStickerContextForPrompt } from '../../stickers/stickers.js'
import { runtime } from '../../runtime/state.js'

export function triggerSpectatorGroupAiAction() {
    const chatId = runtime.state.activeChatId;
    return withConversationRequest(chatId, () => generateSpectatorTurn(chatId));
}

async function generateSpectatorTurn(chatId) {
    const chat = runtime.state.chats[chatId];
    runtime.lastRawAiResponse = '';
    runtime.lastResponseTimestamps = [];
    const propelBtn = document.getElementById('spectator-propel-btn');
    if (propelBtn) {
        propelBtn.disabled = true;
        propelBtn.textContent = "Thinking…";
    }
    setAvatarActingState(chatId, true);

    try {
        const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
        if (!proxyUrl || !model) {
            throw new Error('Set up your API connection to generate a reply.');
        }

        const membersList = chat.members.map(m => `- **${m.groupNickname}** (original name: ${m.originalName}): ${m.persona}`).join('\n');
        const stickerContext = getGroupStickerContextForPrompt(chat);
        const systemPrompt = `
# Your role as the group chat writer
Write a lively, natural conversation for the members of "${chat.name}". The user is watching and does not participate. You portray every member listed below.

# Required output format (highest priority)
Return a JSON array. Every object must include "type" and "name". Use each speaker's original name in "name".

# Character interaction
- Have members respond to, build on, or disagree with each other's messages. Keep the exchange connected.
- Stay in character. Never reveal that you are an AI, a model, or a writer.
- Use stickers, voice messages, and pictures when they fit. Choose one exact sticker meaning from the list for each sticker. Match the character's mood and vary your choices.
- Follow the language already used in the group and any language preferences in the personas.

# Available actions
- **Text** \`{"type": "text", "name": "Original name", "content": "Hi there!"}\`
- **Sticker** \`{"type": "sticker", "name": "Original name", "meaning": "Exact meaning from the list"}\`
- **Image** \`{"type": "ai_image", "name": "Original name", "description": "Detailed description in Chinese", "image_prompt": "English keywords for a landscape, anime, or illustration. No real people."}\`
- **Voice message** \`{"type": "voice_message", "name": "Original name", "content": "Spoken words"}\`
- **Quote a message** \`{"type": "quote_reply", "name": "Original name", "target_timestamp": 1700000000000, "reply_content": "Your reply"}\`. Use the timestamp of the actual message.

# Group members and personas
${membersList}
# Available stickers
Use only the exact meanings listed here.
${stickerContext}

Continue the group's conversation using the information and actions above.
`;

        const response = await requestContextCompletion(chat, {
            instructions: systemPrompt, task: 'QQ group spectator',
            request: [{ role: 'user', content: 'Continue the group conversation now.' }]
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
            throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        runtime.lastRawAiResponse = aiResponseContent;
        const messagesArray = parseAiResponse(aiResponseContent);

        const turn = newReplyTurn();
        let messageTimestamp = replyTimestamp(chat.history);
        for (const msgData of messagesArray) {

            if (!msgData || !msgData.type || !msgData.name) continue;

            let aiMessage = null;
            const currentMessageTimestamp = messageTimestamp++;
            runtime.lastResponseTimestamps.push(currentMessageTimestamp);
            const baseMessage = { role: 'assistant', senderName: msgData.name, timestamp: currentMessageTimestamp, ...turn };

            switch (msgData.type) {
                case 'text':
                    aiMessage = { ...baseMessage, content: msgData.content };
                    break;
                case 'sticker':
                    if (msgData.meaning) {
                        const sticker = findStickerForChat(chat, msgData.meaning, msgData.name);
                        if (sticker) {
                            aiMessage = { ...baseMessage, type: 'sticker', content: sticker.url, meaning: sticker.name };
                        } else {
                            console.warn(`Spectator reply used an unknown sticker: "${msgData.meaning}"`);
                            aiMessage = { ...baseMessage, type: 'text', content: `[Sticker: ${msgData.meaning}]` };
                        }
                    } else {
                        console.warn("A spectator sticker action was missing 'meaning'.", msgData);
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
                    console.warn("Unknown spectator action:", msgData.type);
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
        console.error("Could not advance the spectator conversation:", error);
        await showCustomAlert("Operation Failed", `Could not advance the story: ${error.message}`);
    } finally {
        if (propelBtn) {
            propelBtn.disabled = false;
            propelBtn.textContent = "Advance the Story";
        }
        setAvatarActingState(chatId, false);
    }
}

export function triggerGroupAiAction(chatId) {
    return withConversationRequest(chatId, () => runGroupAiAction(chatId));
}

async function runGroupAiAction(chatId) {
    const chat = runtime.state.chats[chatId];
    if (!chat || !chat.isGroup) return;

    const groupActionCooldownMinutes = chat.settings.actionCooldownMinutes || 10;

    if (chat.lastActionTimestamp) {
        const minutesSinceLastAction = (Date.now() - chat.lastActionTimestamp) / (1000 * 60);

        if (minutesSinceLastAction < groupActionCooldownMinutes) {
            console.log(`Group "${chat.name}" is still in its activity cooldown.`);
            return;
        }
    }

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !model) return;

    const myNickname = chat.settings.myNickname || '我';
    const now = new Date();

    let systemPrompt;

    const recentHistory = chat.history.filter(m => !m.isHidden).slice(-5);
    const unclaimedPacket = recentHistory.find(m => m.type === 'red_packet' && !m.isFullyClaimed);

    if (unclaimedPacket) {
        const senderDisplayName = getDisplayNameInGroup(chat, unclaimedPacket.senderName);
        console.log(`Requesting red-packet actions for "${chat.name}".`);

        systemPrompt = `
# Immediate task (highest priority)
"${senderDisplayName}" sent a red packet that still has unclaimed shares. Its timestamp is ${unclaimedPacket.timestamp}.

Choose one or more characters who would try to claim the packet. Have each chosen character act now. Return a JSON array with one object for each attempt. Use each character's original name.

[{"type": "open_red_packet", "name": "Original name", "packet_timestamp": ${unclaimedPacket.timestamp}}]
`;
    } else {

        let timeContextText = '';

        const selectedTimeZone = resolveTimeZone(chat.isGroup ? '' : chat.settings.characterLocation, chat.settings.timeZone).zone;
        const currentTime = now.toLocaleString('en-GB', { timeZone: selectedTimeZone, dateStyle: 'full', timeStyle: 'short' });

        if (chat.settings.enableTimePerception) {
            const lastMessage = chat.history.filter(m => !m.isHidden).slice(-1)[0];
            if (lastMessage) {
                const lastTime = new Date(lastMessage.timestamp);
                const diffMinutes = (now - lastTime) / (1000 * 60);
                if (diffMinutes > 60) {
                    timeContextText = `The group has been quiet for about ${Math.round(diffMinutes / 60)} hour(s).`;
                } else {
                    timeContextText = `Someone last spoke ${Math.floor(diffMinutes)} minute(s) ago.`;
                }
            } else {
                timeContextText = "The group has no messages yet.";
            }
        }
        const membersList = chat.members.map(m => `- **${m.groupNickname}** (original name: ${m.originalName}): ${m.persona}`).join('\n');

        const stickerContext = getGroupStickerContextForPrompt(chat);
        systemPrompt = `
# Your role in the group chat
Restart the conversation in "${chat.name}". Choose one or more members to start talking based on their personalities, world information, memories, recent posts, and the current situation.
${chat.settings.enableTimePerception ? `Current time: ${currentTime}.` : ''}
${timeContextText}

# Interaction
- When several characters speak, have each respond to, challenge, or build on what came before. A question followed by an answer or a joke followed by a comeback can give the conversation a natural rhythm. Avoid unrelated monologues.
- Keep each character in their persona. Follow the group's language and any language preferences expressed by the characters.
- Pick one exact sticker meaning from the list. Match it to the mood and vary your choices.

# Required output format
Return a JSON array of one or more actions. Each action's "name" must be the acting character's original name. Never write a message with "${myNickname}" as its "name".

# Available actions
- **Text** \`{"type": "text", "name": "Original name", "content": "Message text"}\`
- **Sticker** \`{"type": "sticker", "name": "Original name", "meaning": "Exact meaning from the list"}\`
- **Image** \`{"type": "ai_image", "name": "Original name", "description": "Detailed description in Chinese", "image_prompt": "English keywords separated by %20 for a landscape, anime, or illustration. No real people."}\`
- **Poll** \`{"type": "poll", "name": "Original name", "question": "Your question", "options": "Option A\\nOption B"}\`
- **Start a group call** \`{"type": "group_call_request", "name": "Original name"}\`
- **Quote a message** \`{"type": "quote_reply", "name": "Original name", "target_timestamp": 1700000000000, "reply_content": "Your reply"}\`. Use the actual timestamp to reply to a specific message from any member, including the user or another character. The app displays that message above the reply.

# Group members and personas
${membersList}
# Available stickers
${stickerContext}
# The user's persona
- **${myNickname}**: ${chat.settings.myPersona}

Start the next exchange and bring the group chat back to life.
`;
    }
    try {
        const response = await requestContextCompletion(chat, {
            instructions: systemPrompt, task: 'QQ group activity',
            request: [{ role: 'user', content: 'Choose the next action for this group.' }]
        });

        if (!response.ok) throw new Error((await response.json()).error.message);

        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        const responseArray = parseAiResponse(aiResponseContent);

        if (!responseArray || responseArray.length === 0) {
            console.warn(`Group "${chat.name}" returned no valid background actions.`);
            return;
        }

        const turn = newReplyTurn();
        let actionTimestamp = replyTimestamp(chat.history);

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
        for (const action of processedActions) {
            if (!action || !action.type || !action.name) continue;

            const senderDisplayName = getDisplayNameInGroup(chat, action.name);
            let visibleSystemMessage = null;

            let aiMessage = null;
            const baseMessage = { role: 'assistant', senderName: action.name, timestamp: actionTimestamp++, ...turn };

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
                            content: `${senderDisplayName} claimed part of ${getDisplayNameInGroup(chat, packetToOpen.senderName)}'s red packet`,
                            timestamp: actionTimestamp++, ...turn
                        });

                        let hiddenContentForAI = `[System notice: You (${senderDisplayName}) claimed ${claimedAmountAI.toFixed(2)} yuan from the red packet.`;
                        if (Object.keys(packetToOpen.claimedBy).length >= packetToOpen.count) {
                            packetToOpen.isFullyClaimed = true;

                            chat.history.push({
                                role: 'system',
                                type: 'pat_message',
                                content: `${getDisplayNameInGroup(chat, packetToOpen.senderName)}'s red packet has been fully claimed`,
                                timestamp: actionTimestamp++, ...turn
                            });

                            let luckyKing = { name: '', amount: -1 };
                            Object.entries(packetToOpen.claimedBy).forEach(([name, amount]) => {
                                if (amount > luckyKing.amount) {
                                    luckyKing = { name, amount };
                                }
                            });
                            if (luckyKing.name) {
                                const luckyKingDisplayName = getDisplayNameInGroup(chat, luckyKing.name);
                                hiddenContentForAI += ` The packet is now fully claimed. The luckiest member was ${luckyKingDisplayName}.`;
                            }
                        }
                        hiddenContentForAI += ' Comment in character on this result.]';
                        chat.history.push({
                            role: 'system',
                            content: hiddenContentForAI,
                            timestamp: actionTimestamp++, ...turn,
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
                        const sticker = findStickerForChat(chat, action.meaning, action.name);
                        if (sticker) {
                            aiMessage = { ...baseMessage, type: 'sticker', content: sticker.url, meaning: sticker.name };
                        } else {
                            console.warn(`The group background reply used an unknown sticker: "${action.meaning}"`);
                            aiMessage = { ...baseMessage, type: 'text', content: `[Sticker: ${action.meaning}]` };
                        }
                    } else {
                        console.warn("A group background sticker action was missing 'meaning'.", action);
                        aiMessage = { ...baseMessage, type: 'sticker', content: action.url, meaning: 'Unknown sticker' };
                    }
                    break;
                case 'qzone_post':
                    const newPost = { type: action.postType || 'shuoshuo', content: action.content, timestamp: Date.now(), authorId: runtime.state.chats[Object.keys(runtime.state.chats).find(key => runtime.state.chats[key].originalName === action.name)]?.id || action.name, authorOriginalName: action.name, visibleGroupIds: null };
                    await runtime.db.qzonePosts.add(newPost);
                    updateUnreadIndicator(runtime.unreadPostsCount + 1);
                    visibleSystemMessage = { content: `[${senderDisplayName} published a post]` };
                    break;
                case 'qzone_comment':
                    const postToComment = await runtime.db.qzonePosts.get(parseInt(action.postId));
                    if (postToComment) {
                        if (!postToComment.comments) postToComment.comments = [];
                        postToComment.comments.push({ commenterName: action.name, text: action.commentText, timestamp: Date.now() });
                        await runtime.db.qzonePosts.update(postToComment.id, { comments: postToComment.comments });
                        updateUnreadIndicator(runtime.unreadPostsCount + 1);
                        visibleSystemMessage = { content: `[${senderDisplayName} commented on a post]` };
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
                            visibleSystemMessage = { content: `[${senderDisplayName} liked a post]` };
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
                    timestamp: actionTimestamp++, ...turn
                });
            }
            else if (aiMessage) {
                chat.history.push(aiMessage);
                if (!notificationSender) {
                    notificationSender = senderDisplayName;
                    notificationContent = aiMessage.type === 'ai_image' ? '[Image]' : (aiMessage.content || `[${aiMessage.type}]`);
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
        console.error(`Background activity failed for group "${chat.name}":`, error);
    } finally {
        renderChatList();
    }
}

export async function handleSpectatorReroll() {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat?.history.some(message => message.role === 'assistant' || message.role === 'ai')) {
        alert('There is no AI reply to regenerate.');
        return;
    }
    try {
        await regenerateReply(chat);
    } catch (error) {
        await showCustomAlert('Could not regenerate this turn', error.message);
    }
}
