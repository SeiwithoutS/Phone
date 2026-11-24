import { recordVote } from '../../../features/chat/chat-features'
import { maySendImages } from '../../../features/api/image-input'
import { getGeminiResponseText } from '../../api/client.js'
import { showIncomingCallModal, startVideoCall } from '../../calls/calls.js'
import { appendMessage, createMessageElement, renderChatInterface, updateChatHeaderStatus } from '../conversation.js'
import { getDisplayNameInGroup, syncCharacterAvatarInGroups, syncCharacterNameInGroups } from '../groups.js'
import { renderChatList } from '../list.js'
import { handleAiGomokuMove } from '../../gomoku/gomoku.js'
import { showNotification } from '../../home/status.js'
import { playSong } from '../../music/player.js'
import { renderQzonePosts } from '../../qzone/feed.js'
import { showScreen } from '../../../app/routes'
import { runtime } from '../../runtime/state.js'
import { isUserMessage, newReplyTurn, replyTimestamp } from '../../../features/chat/reply-turns'
import { alternateReplyBubbles, parseReplyActions, replyBubble } from './reply-bubbles.js'
import { createMarketOrderMessage, createTransferMessage } from './commerce.js'
import { createNovelAiMessage } from './images.js'
import { commentOnPost, likePost, publishAiPost, repostFromChat } from './social.js'

export async function applyChatAiResponse(chat, chatId, data, replyToUserTimestamp) {
    const aiResponseContent = getGeminiResponseText(data);

    runtime.lastRawAiResponse = aiResponseContent;
    runtime.lastResponseTimestamps = [];
    chat.history = chat.history.filter(msg => !msg.isTemporary);
    const messagesArray = parseReplyActions(aiResponseContent);
    if (!messagesArray.length) throw new Error('The AI returned an empty reply.');
    const turnFields = newReplyTurn(replyToUserTimestamp);
    const turn = [];
    const record = message => {
        Object.assign(message, turnFields);
        chat.history.push(message);
        turn.push(message);
    };

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

    const lastUserMessage = chat.history.findLast(message => isUserMessage(message) && message.timestamp === replyToUserTimestamp);
    if (maySendImages() && lastUserMessage &&
        Array.isArray(lastUserMessage.content) &&
        lastUserMessage.content[0]?.type === 'image_url' &&
        !lastUserMessage.imageProcessed) {

        const firstTextResponse = messagesArray.find(msg => msg.type === 'text');
        let description;
        if (firstTextResponse && (firstTextResponse.content || firstTextResponse.message)) {
            description = String(firstTextResponse.content || firstTextResponse.message).trim();
        } else {

            description = 'The character received and understood the image.';
        }

        const imageMessageIndex = chat.history.indexOf(lastUserMessage);

        if (imageMessageIndex > -1) {
            console.log(`识图优化：正在将时间戳为 ${lastUserMessage.timestamp} 的图片消息替换为文字描述...`);

            const replacementText = `[System notice: The user previously sent an image. Summary of the character's first response: "${description}"]`;
            chat.history[imageMessageIndex].content = replacementText;

            chat.history[imageMessageIndex].imageProcessed = true;
            chat.history[imageMessageIndex].type = 'text';

        }
    }

    const isViewingThisChat = document.getElementById('chat-interface-screen').classList.contains('active') && runtime.state.activeChatId === chatId;
    let callHasBeenHandled = false;
    let messageTimestamp = replyTimestamp(chat.history);
    let notificationShown = false;

    for (const msgData of consolidatedMessages) {
        const actor = chat.isGroup ? runtime.state.chats[chat.members?.find(member => member.originalName === msgData.name)?.id] : chat;
        if (['qzone_post', 'repost'].includes(msgData.type) && actor?.settings.allowSocialPosts === false) continue;
        if (msgData.type === 'update_status' && actor?.settings.showCharacterStatus === false) continue;
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
                const aiMessage = { role: 'assistant', content: 'The character declined your video call.', timestamp: messageTimestamp++ };
                record(aiMessage);
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
        const baseMessage = { role: 'assistant', senderName: msgData.name || chat.name, timestamp: currentMessageTimestamp, ...turnFields };

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
                        timestamp: messageTimestamp++
                    });
                    if (chat.thoughtsHistory.length > 50) {
                        chat.thoughtsHistory.shift();
                    }

                    const thoughtForMemory = `[Private thoughts from your previous turn]
- Private thought: ${chat.heartfeltVoice}
- Personal notes: ${chat.randomJottings}`;

                    const hiddenThoughtMessage = {
                        role: 'system',
                        type: 'private_thoughts',
                        content: thoughtForMemory,
                        timestamp: messageTimestamp++,
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
                        record(systemMessage);

                        const hiddenMemoryMessage = {
                            role: 'system',
                            content: `[System notice: You changed the user's nickname to "${newNickname}".]`,
                            timestamp: messageTimestamp++,
                            isHidden: true
                        };
                        record(hiddenMemoryMessage);

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
                        record(systemMessage);

                        const hiddenMemoryMessage = {
                            role: 'system',
                            content: `[System notice: You changed your display name to "${newName}". Use your new name naturally.]`,
                            timestamp: messageTimestamp++,
                            isHidden: true
                        };
                        record(hiddenMemoryMessage);

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
                        timestamp: messageTimestamp++
                    };
                    record(systemNotice);

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
                        timestamp: messageTimestamp++
                    };
                    record(systemNotice);

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

            case 'waimai_response': {
                const originalWaimai = chat.history.find(message => message.timestamp === msgData.for_timestamp);
                if (originalWaimai?.type === 'waimai_request' && originalWaimai.status === 'pending' &&
                    (chat.isGroup ? originalWaimai.senderName !== msgData.name : originalWaimai.role === 'user') &&
                    (!originalWaimai.countdownEndTime || originalWaimai.countdownEndTime > Date.now()) &&
                    ['paid', 'rejected'].includes(msgData.status)) {
                    originalWaimai.status = msgData.status;
                    originalWaimai.paidBy = msgData.status === 'paid' ? msgData.name || chat.name : null;
                }
                continue;
            }

            case 'qzone_post':
                await publishAiPost(chat, chatId, actor, msgData, isViewingThisChat);
                continue;
            case 'qzone_comment':
                await commentOnPost(chat, msgData);
                continue;
            case 'qzone_like':
                await likePost(chat, msgData, isViewingThisChat);
                continue;
            case 'repost':
                await repostFromChat(chat, chatId, msgData);
                continue;
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
                    timestamp: messageTimestamp++
                };
                record(patMessage);
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
                if (chat.isGroup || typeof msgData.status_text !== 'string' || !msgData.status_text.trim()) continue;
                chat.status.text = msgData.status_text.trim().slice(0, 90);
                chat.status.isBusy = msgData.is_busy || false;
                chat.status.lastUpdate = Date.now();
                const statusUpdateMessage = {
                    role: 'system',
                    type: 'pat_message',
                    content: `[${chat.name}的状态已更新为: ${msgData.status_text}]`,
                    timestamp: messageTimestamp++
                };
                record(statusUpdateMessage);
                if (isViewingThisChat) {
                    updateChatHeaderStatus(chat);
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
                                timestamp: messageTimestamp++
                            };
                            record(musicChangeMessage);
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
                    timestamp: messageTimestamp++,
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
                        timestamp: messageTimestamp++,
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
                        content: '[System notice: You just blocked the user.]',
                        timestamp: messageTimestamp++,
                        isHidden: true
                    };
                    record(hiddenMessage);
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
                if (pollToVote?.type === 'poll' && !pollToVote.isClosed && pollToVote.options?.includes(msgData.choice)) {
                    const voter = chat.isGroup ? msgData.name : chat.originalName;
                    if (!voter || (chat.isGroup && !chat.members?.some(member => member.originalName === voter))) continue;
                    pollToVote.votes = recordVote(pollToVote.votes, msgData.choice, voter);
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
                if (!chat.isGroup) continue;
                const packetToOpen = chat.history.find(m => m.timestamp === msgData.packet_timestamp);
                if (packetToOpen?.type !== 'red_packet') continue;

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
                            timestamp: messageTimestamp++
                        };
                        record(aiClaimedMessage);

                        let hiddenContentForAI = `[System notice: You (${claimerDisplayName}) claimed ${claimedAmountAI.toFixed(2)} yuan from the red packet.`;
                        if (Object.keys(packetToOpen.claimedBy).length >= packetToOpen.count) {
                            packetToOpen.isFullyClaimed = true;
                            const finishedMessage = {
                                role: 'system',
                                type: 'pat_message',
                                content: `${senderDisplayName} 的红包已被领完`,
                                timestamp: messageTimestamp++
                            };
                            record(finishedMessage);
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
                                hiddenContentForAI += ` The packet is now fully claimed. The luckiest member was ${luckyKingDisplayName}.`;
                            } else {
                                hiddenContentForAI += ' The packet is now fully claimed.';
                            }
                        }
                        hiddenContentForAI += ' Comment in character on this result.]';
                        const hiddenMessageForAI = {
                            role: 'system',
                            content: hiddenContentForAI,
                            timestamp: messageTimestamp++,
                            isHidden: true
                        };
                        record(hiddenMessageForAI);
                    }
                    if (isViewingThisChat) {
                        renderChatInterface(chatId);
                        renderChatList();
                    }
                }
                continue;

            case 'accept_transfer': {
                const originalTransferMsgIndex = chat.history.findIndex(m => m.timestamp === msgData.for_timestamp);
                if (originalTransferMsgIndex > -1 && chat.history[originalTransferMsgIndex].type === 'transfer' && !chat.history[originalTransferMsgIndex].bankTransferId && !['accepted', 'declined'].includes(chat.history[originalTransferMsgIndex].status)) {
                    const originalMsg = chat.history[originalTransferMsgIndex];
                    originalMsg.status = 'accepted';
                }
                continue;
            }

            case 'decline_transfer': {
                const originalTransferMsgIndex = chat.history.findIndex(m => m.timestamp === msgData.for_timestamp);
                if (originalTransferMsgIndex > -1 && chat.history[originalTransferMsgIndex].type === 'transfer' && !chat.history[originalTransferMsgIndex].bankTransferId && !['accepted', 'declined'].includes(chat.history[originalTransferMsgIndex].status)) {
                    const originalMsg = chat.history[originalTransferMsgIndex];
                    originalMsg.status = 'declined';
                    const refundMessage = {
                        role: 'assistant',
                        senderName: chat.name,
                        type: 'transfer',
                        isRefund: true,
                        amount: originalMsg.amount,
                        note: 'Transfer declined',
                        timestamp: messageTimestamp++
                    };
                    record(refundMessage);
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
                    record(systemMessage);

                    if (isViewingThisChat) {
                        appendMessage(systemMessage, chat);
                        document.getElementById('chat-header-title').textContent = chat.name;
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
                        record(systemMessage);

                        if (isViewingThisChat) {
                            appendMessage(systemMessage, chat);
                        }
                    } else {
                        console.warn(`AI 尝试使用一个不存在的群头像: "${avatarName}"`);
                    }
                }
                continue;
            case 'system_message':
                aiMessage = { role: 'system', type: 'pat_message', content: msgData.content, timestamp: messageTimestamp++ };
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
                        content: 'The character recalled a message.',
                        timestamp: tempMessageData.timestamp,
                        recalledData: { originalType: 'text', originalContent: msgData.content }
                    };
                    const msgIndex = chat.history.findIndex(m => m.timestamp === tempMessageData.timestamp);
                    if (msgIndex > -1) {
                        chat.history[msgIndex] = recalledMessage;
                    } else {
                        record(recalledMessage);
                    }
                    const placeholder = await createMessageElement(recalledMessage, chat);
                    if (document.body.contains(bubbleWrapper)) {
                        bubbleWrapper.parentNode.replaceChild(placeholder, bubbleWrapper);
                    }
                }
                continue;
            }

            case 'text':
            case 'quote_reply':
            case 'sticker':
            case 'ai_image':
            case 'voice_message':
            case 'offline_text':
                aiMessage = replyBubble(chat, msgData, baseMessage);
                break;
            case 'store_purchase':
                aiMessage = await createMarketOrderMessage(chat, msgData, baseMessage);
                break;
            case 'transfer':
                aiMessage = await createTransferMessage(chat, actor, msgData, baseMessage);
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
                continue;

            case 'naiimag':
                aiMessage = await createNovelAiMessage(chat, msgData, baseMessage);
                break;

            default:
                console.warn("收到了未知的AI指令类型:", msgData.type);
                break;
        }

        if (aiMessage) {
            record(aiMessage);
            if (!isViewingThisChat) {
                chat.unreadCount = (chat.unreadCount || 0) + 1;
            }
            if (!isViewingThisChat && !notificationShown && !aiMessage.bankTransferId) {
                let notificationText;
                switch (aiMessage.type) {
                    case 'transfer': notificationText = `[Transfer received]`; break;
                    case 'waimai_request': notificationText = `[Delivery payment requested]`; break;
                    case 'ai_image': notificationText = `[Image]`; break;
                    case 'voice_message': notificationText = `[Voice message]`; break;
                    case 'sticker': notificationText = aiMessage.meaning ? `[Sticker: ${aiMessage.meaning}]` : '[表情]'; break;
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
    const alternatives = turn.some(message => message.role === 'assistant') ? (data.eephoneAlternatives ?? []).flatMap(raw => {
        const messages = alternateReplyBubbles(chat, raw, turnFields.replyTurnId, turnFields.replyTurnTime, () => messageTimestamp++);
        return messages.length ? [messages] : [];
    }) : [];
    if (alternatives.length) turn[0].replyVersions = { index: 0, variants: [null, ...alternatives] };
    await runtime.db.chats.put(chat);
    if (alternatives.length && isViewingThisChat && runtime.state.activeChatId === chatId) {
        void renderChatInterface(chatId, true);
    }

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
}
