import { resolveTimeZone } from '../../../features/chat/location'
import { effectiveReplyRules } from '../../../features/chat/reply-rules'
import { isUserMessage, replyForUser } from '../../../features/chat/reply-turns'
import { latestUserTurn } from '../../../features/context/context'
import { bankCurrency } from '../../../features/bank/bank'
import { photoPromptContent } from '../../../features/api/image-input'
import { formatTimestampForAI, getTimeOfDayGreeting } from '../../../features/chat/format'
import { getDisplayNameInGroup } from '../groups.js'
import { formatGomokuStateForAI } from '../../gomoku/gomoku.js'
import { formatReadingStateForAI } from '../../home/status.js'
import { getGroupStickerContextForPrompt, getStickerContextForPrompt } from '../../stickers/stickers.js'
import { runtime } from '../../runtime/state.js'
import { buildGroupReplyPrompt, buildOfflineReplyPrompt, buildOnlineReplyPrompt } from './prompts.js'

export async function buildQQReplyInput(chat) {
    const rawHistory = chat.history.filter(message => !message.isTemporary);
    const latestUser = rawHistory.findLast(isUserMessage);
    const { systemPrompt, messagesPayload, activitySources } = await buildChatReplyContext({ ...chat, history: rawHistory }, chat.id);
    const turn = latestUserTurn(messagesPayload, Boolean(latestUser && !replyForUser(rawHistory, latestUser)));
    return {
        replyToUserTimestamp: latestUser?.timestamp ?? null,
        input: { instructions: systemPrompt, ...turn, rawHistory, activity: activitySources, task: 'QQ reply' },
    };
}

export async function buildChatReplyContext(chat, chatId, { alternate = false } = {}) {
    let callTranscriptContext = '';
    const now = new Date();

    const selectedTimeZone = resolveTimeZone(chat.isGroup ? '' : chat.settings.characterLocation, chat.settings.timeZone).zone;

    const currentTime = now.toLocaleString('en-GB', { timeZone: selectedTimeZone, dateStyle: 'full', timeStyle: 'short' });

    const timeOfDayGreeting = getTimeOfDayGreeting(now, selectedTimeZone);
    let systemPrompt, messagesPayload;
    const lastHiddenMessage = chat.history.filter(m => m.isHidden).pop();
    if (lastHiddenMessage?.type === 'video_call_ended' || lastHiddenMessage?.content?.includes?.('视频通话刚刚结束')) {
        const lastCallRecord = await runtime.db.callRecords
            .orderBy('timestamp')
            .filter(record => record.chatId === chatId)
            .reverse()
            .first();

        if (lastCallRecord && lastCallRecord.transcript) {
            console.log("Adding the latest call transcript to the prompt.");
            const transcriptText = lastCallRecord.transcript.map(h => {
                const sender = h.role === 'user' ? (chat.settings.myNickname || '我') : h.senderName;
                return `${sender}: ${h.content}`;
            }).join('\n');

            callTranscriptContext = `
# Latest call transcript (highest-priority reference)
You just ended a video call with the user. Use the full transcript below and make your next reply directly relevant to the call.
---
${transcriptText}
---
`;
        }
    }

    const gomokuContext = formatGomokuStateForAI(runtime.gomokuState[chatId]);

    let musicContext = '';
    if (runtime.musicState.isActive && runtime.musicState.activeChatId === chatId) {
        const currentTrack = runtime.musicState.currentIndex > -1 ? runtime.musicState.playlist[runtime.musicState.currentIndex] : null;
        const playlistInfo = runtime.musicState.playlist.map(t => `"${t.name}"`).join(', ');

        let lyricsContext = "";

        if (currentTrack && runtime.musicState.parsedLyrics && runtime.musicState.parsedLyrics.length > 0 && runtime.musicState.currentLyricIndex > -1) {
            const currentLine = runtime.musicState.parsedLyrics[runtime.musicState.currentLyricIndex];

            const upcomingLines = runtime.musicState.parsedLyrics.slice(runtime.musicState.currentLyricIndex + 1, runtime.musicState.currentLyricIndex + 3);

            lyricsContext += `- **Current lyric**: "${currentLine.text}"\n`;
            if (upcomingLines.length > 0) {
                lyricsContext += `- **Upcoming lyrics**: ${upcomingLines.map(line => `"${line.text}"`).join(' / ')}\n`;
            }
        }

        musicContext = `\n\n# Music playing during the chat
        -   You and the user are listening to music together.
        -   **Now playing**: ${currentTrack ? `《${currentTrack.name}》 - ${currentTrack.artist}` : 'None'}
        -   **Playlist**: [${playlistInfo}]
        ${lyricsContext}
        ${alternate ? '' : '-   Use "change_music" to play a song from the playlist when it suits the conversation or the mood.'}
        `;
    }

    const historySlice = chat.history.filter(message => !message.isTemporary);
    const activitySources = [callTranscriptContext, musicContext, formatReadingStateForAI(chatId), gomokuContext];
    if (chat.isGroup) {

        let timeContextText = '';
        let longTimeNoSee = false;

        if (chat.settings.enableTimePerception) {
            const lastMessage = historySlice.slice(-1)[0];

            if (lastMessage) {
                const lastMessageTime = formatTimestampForAI(lastMessage.timestamp, selectedTimeZone);
                timeContextText = `The last message was sent at ${lastMessageTime}.`;

                const timeDiffHours = (Date.now() - lastMessage.timestamp) / (1000 * 60 * 60);
                if (timeDiffHours > 3) {
                    longTimeNoSee = true;
                    const diffDays = Math.floor(timeDiffHours / 24);
                    timeContextText += ` The group has been quiet for ${diffDays > 0 ? diffDays + ' day(s)' : Math.floor(timeDiffHours) + ' hour(s)'}.`;
                }
            } else {
                timeContextText = "This is the first message in the group.";
            }
        }

        const allProducts = alternate ? [] : await runtime.db.shoppingProducts.toArray();
        let shoppingContext = "";
        if (allProducts.length > 0) {
            shoppingContext = "\n\n# Your shop (gifts for group members)\n";
            allProducts.forEach(product => {
                shoppingContext += `- (ID: ${product.id}) Item: ${product.name}, price: ¥${product.price.toFixed(2)}\n`;
            });
        }
        let membersWithContacts = chat.members.map(member => {
            const memberChat = runtime.state.chats[member.id];
            let contactsText = "No mutual friends";
            if (memberChat && memberChat.groupId) {
                const friendChats = Object.values(runtime.state.chats).filter(c =>
                    !c.isGroup && c.id !== member.id && c.groupId === memberChat.groupId
                );
                if (friendChats.length > 0) {
                    contactsText = `Friends: ${friendChats.map(f => f.name).join(', ')}`;
                }
            }
            return `- **${member.groupNickname}** (original name: ${member.originalName}): ${member.persona} [Social background: ${contactsText}]`;
        }).join('\n');

        const myNickname = chat.settings.myNickname || '我';
        const myOriginalName = runtime.state.qzoneSettings.nickname || '{{user}}';

        let announcementContext = '';
        const pinnedAnnouncements = (chat.announcements || []).filter(a => a.isPinned);
        if (pinnedAnnouncements.length > 0) {
            announcementContext += '\n# Group announcements (highest priority)\nFollow the announcements below even if they conflict with a character persona.\n';
            pinnedAnnouncements.forEach(anno => {
                const originalMessage = chat.history.find(m => m.timestamp === anno.messageTimestamp);
                if (originalMessage) {
                    let contentText = String(originalMessage.content || '');
                    if (originalMessage.type === 'ai_image') {
                        contentText = `[Image description: ${contentText}]`;
                    }
                    announcementContext += `- "${contentText}" (posted by ${anno.publisher})\n`;
                }
            });
            announcementContext += '---\n';
        }
        const memberNames = chat.members.map(m => m.originalName);
        const forbiddenNamesContext = `# Group naming rule\nNever rename the group to the exact name of any member on this list: [${memberNames.join(', ')}]`;

        let groupAvatarLibraryContext = '# Available group avatars\n';
        if (chat.settings.groupAvatarLibrary && chat.settings.groupAvatarLibrary.length > 0) {
            groupAvatarLibraryContext += chat.settings.groupAvatarLibrary.map(avatar => `- ${avatar.name}`).join('\n');
        } else {
            groupAvatarLibraryContext += '- (No group avatars are available.)';
        }
        activitySources.push(shoppingContext);

        const stickerContext = getGroupStickerContextForPrompt(chat);
        systemPrompt = buildGroupReplyPrompt(chat, { myNickname, myOriginalName, currentTime, longTimeNoSee, timeContextText, membersWithContacts, groupAvatarLibraryContext, stickerContext, forbiddenNamesContext, alternate });

        messagesPayload = historySlice.map(msg => {
            const sender = msg.role === 'user' ? myNickname : msg.senderName;
            const role = msg.role === 'ai' ? 'assistant' : msg.role;
            let prefix = `${sender}`;

            if (msg.quote) {
                const quotedContent = String(msg.quote.content || '').substring(0, 50);

                prefix += ` (Replying to ${msg.quote.senderName}: "${quotedContent}...")`;
            }
            prefix += ': ';

            let content;
            if (msg.type === 'user_photo') content = `[${sender} sent an image with this description: '${msg.content}']`;
            else if (msg.type === 'ai_image') content = `[${sender} shared an image with this description: '${msg.content}']`;
            else if (msg.type === 'naiimag') content = `[${sender} shared a NovelAI image. Prompt: ${msg.prompt}]`;
            else if (msg.type === 'voice_message') content = `[${sender} sent a voice message: '${msg.content}']`;
            else if (msg.type === 'transfer') content = `[${msg.senderName} transferred ${msg.amount} yuan to ${msg.receiverName}. Note: ${msg.note}]`;
            else if (msg.type === 'location_share') {
                content = `[${sender} shared their location: '${msg.content}']`;

            }
            else if (msg.type === 'repost') {
                const repostComment = msg.repostComment ? `with the comment "${msg.repostComment}"` : '';

                let originalAuthorName = 'the original author';
                const originalAuthorId = msg.originalPost.authorId;
                if (originalAuthorId === 'user') {
                    originalAuthorName = runtime.state.qzoneSettings.nickname;
                } else if (runtime.state.chats[originalAuthorId]) {
                    originalAuthorName = runtime.state.chats[originalAuthorId].name;
                }

                let originalContentSummary;
                const originalPost = msg.originalPost;
                if (originalPost.type === 'text_image') {
                    originalContentSummary = `[Text and image] ${originalPost.publicText || ''} (image description: “${(originalPost.hiddenContent || '').substring(0, 40)}...”)`;
                } else if (originalPost.type === 'image_post') {
                    originalContentSummary = `[Image] ${originalPost.publicText || ''} (image description: “${(originalPost.imageDescription || '').substring(0, 40)}...”)`;
                } else {
                    originalContentSummary = `“${(originalPost.content || '').substring(0, 40)}...”`;
                }

                content = `[${sender} reposted @${originalAuthorName}'s post ${repostComment}. Original post: ${originalContentSummary}]`;
            }
            else if (msg.type === 'waimai_request') {
                if (msg.status === 'paid') {
                    content = `[System notice: ${msg.paidBy} paid ${msg.amount} yuan for ${sender}'s delivery. The order is complete.]`;
                } else {
                    content = `[${sender} requested payment of ${msg.amount} yuan for a delivery of "${msg.productInfo}" (timestamp: ${msg.timestamp}).]`;
                }
            }
            else if (msg.type === 'red_packet') {
                const packetSenderName = msg.senderName === myNickname ? `User (${myNickname})` : msg.senderName;
                let instructionText;
                if (msg.packetType === 'direct') {
                    instructionText = `[System notice: ${packetSenderName} sent a direct red packet to "${msg.receiverName}" (timestamp: ${msg.timestamp}). Only "${msg.receiverName}" can claim it with 'open_red_packet'.]`;
                } else {
                    instructionText = `[System notice: ${packetSenderName} sent a lucky red packet (timestamp: ${msg.timestamp}) with the greeting "${msg.greeting}". It still has unclaimed shares. Any member can use 'open_red_packet' to claim one.]`;
                }
                content = instructionText;
            }
            else if (msg.type === 'gift') {
                const sender = msg.role === 'user' ? myNickname : getDisplayNameInGroup(chat, msg.senderName);
                const itemsSummary = msg.items.map(item => `${item.name} x${item.quantity}`).join(', ');

                let recipientSummary = '';
                if (msg.recipients && msg.recipients.length > 0) {
                    const recipientDisplayNames = msg.recipients.map(originalName => getDisplayNameInGroup(chat, originalName)).join(', ');
                    recipientSummary = `gave a gift to ${recipientDisplayNames}`;
                } else {
                    recipientSummary = "gave a gift to everyone";
                }

                content = `[System notice: ${sender} ${recipientSummary}. Gift: ${itemsSummary}]`;
                return { role, content: content };
            }

            else if (msg.type === 'poll') {
                const whoVoted = Object.values(msg.votes || {}).flat().join(', ') || 'no one yet';
                content = `[System notice: ${msg.senderName} started a poll (timestamp: ${msg.timestamp}). Question: "${msg.question}". Options: [${msg.options.join(', ')}]. Already voted: ${whoVoted}. Use 'vote' to take part.]`;
            }
            else if (msg.meaning) content = `${sender}: [sent a sticker with the meaning '${msg.meaning}']`;
            else if (Array.isArray(msg.content)) return { role, content: photoPromptContent(prefix, msg.imageDescription, msg.content) };
            else content = `${prefix}${msg.content}`;
            return { role, content };
        }).filter(Boolean);

    } else {
        const isOfflineMode = chat.settings.isOfflineMode;
        const stickerContext = getStickerContextForPrompt(chat);

        let latestThoughtContext = '';

        if (!alternate && chat.settings.injectLatestThought && chat.heartfeltVoice && !isOfflineMode) {
            latestThoughtContext = `
# Private thoughts from your previous turn
- Private thought: ${chat.heartfeltVoice}
- Personal notes: ${chat.randomJottings}
`;
        }

        const allProducts = alternate ? [] : await runtime.db.shoppingProducts.toArray();
        let shoppingContext = "";
        if (allProducts.length > 0) {
            shoppingContext = "\n\n# Your shop (gifts for the user)\n";
            allProducts.forEach(product => {
                shoppingContext += `- (ID: ${product.id}) Item: ${product.name}, price: ¥${product.price.toFixed(2)}\n`;
            });
        }
        if (isOfflineMode) {
            const minLength = chat.settings.offlineMinLength || 100;
            const maxLength = chat.settings.offlineMaxLength || 300;
            const myNickname = chat.settings.myNickname || '我';

            systemPrompt = buildOfflineReplyPrompt(chat, { currentTime, timeOfDayGreeting, minLength, maxLength });
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
                        return { role: 'user', content: photoPromptContent(prefix, msg.imageDescription, msg.content) };
                    }

                    if (msg.quote) {

                        const quotedContent = String(msg.quote.content || '').substring(0, 50);

                        contentStr += `(Replying to ${msg.quote.senderName}: "${quotedContent}..."): ${msg.content}`;
                    } else {

                        contentStr += msg.content;
                    }
                    if (msg.type === 'user_photo') return { role: 'user', content: `${prefix}[You sent an image for the character to interpret. Description: '${msg.content}']` };
                    if (msg.type === 'voice_message') return { role: 'user', content: `${prefix}[You sent a voice message: '${msg.content}']` };
                    if (msg.type === 'transfer') return { role: 'user', content: `${prefix}[System notice: You sent ${msg.amount} yuan (timestamp: ${msg.timestamp}). Note: ${msg.note}. ${msg.bankTransferId ? "The transfer is complete." : "It is waiting for a response."}]` };
                    if (msg.type === 'waimai_request') return { role: 'user', content: `${prefix}[System notice: You asked someone to pay ${msg.amount} yuan for a delivery of "${msg.productInfo}" (timestamp: ${msg.timestamp}).]` };
                    else if (msg.type === 'gift') {
                        const itemsSummary = msg.items.map(item => `${item.name} x${item.quantity}`).join(', ');
                        let recipientSummary = chat.isGroup ? `gave a gift to ${msg.recipients.map(name => getDisplayNameInGroup(chat, name)).join(', ')}` : `gave a gift to ${chat.name}`;
                        return { role: 'user', content: `${prefix}[System notice: You ${recipientSummary}. Gift: ${itemsSummary}]` };
                    }
                    if (msg.meaning) return { role: 'user', content: `${prefix}[You sent a sticker with the meaning '${msg.meaning}']` };
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
                nameHistoryContext = `\n- **Your previous names**: [${chat.nameHistory.join(', ')}]. These names refer to you wherever they appear in the history.`;
            }

            let userProfileContext = '';
            const userQzoneNickname = runtime.state.qzoneSettings.nickname || '用户';
            userProfileContext += `- The user’s Qzone nickname is "${userQzoneNickname}".\n`;

            const allChats = Object.values(runtime.state.chats);
            const commonGroups = allChats.filter(group =>
                group.isGroup && group.members.some(m => m.id === chat.id)
            );

            if (commonGroups.length > 0) {
                userProfileContext += '- These are the user’s nicknames in groups you share:\n';
                commonGroups.forEach(group => {
                    const myNicknameInGroup = group.settings.myNickname || userQzoneNickname;
                    userProfileContext += `  - In "${group.name}", the user goes by "${myNicknameInGroup}".\n`;
                });
            }
            userProfileContext += 'These names refer to your chat partner in system notices, post comments, and any included memories from group chats.';

            let contactsList = '';
            const friendChats = allChats.filter(c =>
                !c.isGroup &&
                c.id !== chat.id &&
                c.groupId === chat.groupId &&
                chat.groupId !== null
            );

            if (friendChats.length > 0) {
                contactsList += '\n# Your contacts\nThese nicknames refer to the friends below when they appear in the feed.\n';
                friendChats.forEach(friend => {
                    contactsList += `- **Nickname: ${friend.name}** (original name: ${friend.originalName})\n`;
                });
            }

            const myNickname = chat.settings.myNickname || '我';

            let timeContext = '';
            let longTimeNoSee = false;

            if (chat.settings.enableTimePerception) {
                const lastUserMsg = historySlice.findLast(msg => msg.role === 'user' && !msg.isHidden);
                const lastAiMsg = historySlice.findLast(msg => msg.role === 'assistant' && !msg.isHidden);

                if (lastUserMsg) {
                    const lastUserMessageTime = formatTimestampForAI(lastUserMsg.timestamp, selectedTimeZone);
                    if (lastAiMsg) {
                        const lastAiMessageTime = formatTimestampForAI(lastAiMsg.timestamp, selectedTimeZone);
                        timeContext = `- **Conversation timing.** You last sent a message at ${lastAiMessageTime}. The user replied at ${lastUserMessageTime}.`;

                        const timeDiffHours = (lastUserMsg.timestamp - lastAiMsg.timestamp) / (1000 * 60 * 60);
                        if (timeDiffHours > 3) {
                            longTimeNoSee = true;
                            const diffDays = Math.floor(timeDiffHours / 24);
                            timeContext += ` There has been a gap of **${diffDays > 0 ? diffDays + ' day(s)' : Math.floor(timeDiffHours) + ' hour(s)'}** since you last spoke.
- **Acknowledge the gap first.** Do not pick up the previous topic, such as yesterday's meal.
- **Start a fresh topic** that suits the time of day (${timeOfDayGreeting}). You can greet the user with surprise ("Wow, long time no see!"), ask how they have been, or share a recent update.
- Use the earlier conversation to recall what happened. Do not reply directly to those earlier messages.`;
                        }
                    } else {
                        timeContext = `- **Conversation timing.** This is your first conversation. The user's first message was sent at ${lastUserMessageTime}.`;
                    }
                } else {
                    timeContext = "- **Conversation timing.** No usable history yet.";
                }
            }
            activitySources.push(latestThoughtContext, shoppingContext);
            systemPrompt = buildOnlineReplyPrompt(chat, { currentTime, timeOfDayGreeting, timeContext, myNickname, userProfileContext, nameHistoryContext, stickerContext, contactsList,
                alternate, rules: effectiveReplyRules(runtime.db, chat.id) });

            messagesPayload = historySlice.map(msg => {

                if (msg.type === 'app_action_status' || (msg.isHidden && msg.role === 'system')) {

                    return { role: 'system', content: msg.content };
                }

                else if (msg.isHidden) {
                    return null;
                }

                if (msg.bankTransferId && msg.type === 'transfer') {
                    const direction = msg.role === 'user' ? 'User paid the character' : 'Character paid the user';
                    return {
                        role: msg.role, content: '[Bank: ' + direction + ' ' + msg.amount + ' ' + bankCurrency(runtime.db) +
                            '. Transfer completed. Note: ' + (msg.note || '') + ']'
                    };
                }

                if (msg.type === 'market_order') {
                    return {
                        role: msg.role, content: '[Marketplace: Order confirmed for ' + (msg.orderRecipient || 'the listed recipient') +
                            '. Items: ' + msg.content + '. Paid ' + Number(msg.orderTotal) / 100 + ' ' + bankCurrency(runtime.db) + '.]'
                    };
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
                        return { role: 'user', content: photoPromptContent(prefix, msg.imageDescription, msg.content) };
                    }

                    if (msg.quote) {

                        const quotedContent = String(msg.quote.content || '').substring(0, 50);

                        contentStr += `(Replying to ${msg.quote.senderName}: "${quotedContent}..."): ${msg.content}`;
                    } else {

                        contentStr += msg.content;
                    }
                    if (msg.type === 'user_photo') return { role: 'user', content: `${prefix}[You sent an image for the character to interpret. Description: '${msg.content}']` };
                    if (msg.type === 'voice_message') return { role: 'user', content: `${prefix}[You sent a voice message: '${msg.content}']` };
                    if (msg.type === 'transfer') return { role: 'user', content: `${prefix}[System notice: You sent ${msg.amount} yuan (timestamp: ${msg.timestamp}). Note: ${msg.note}. ${msg.bankTransferId ? "The transfer is complete." : "It is waiting for a response."}]` };
                    if (msg.type === 'waimai_request') return { role: 'user', content: `${prefix}[System notice: You asked someone to pay ${msg.amount} yuan for a delivery of "${msg.productInfo}" (timestamp: ${msg.timestamp}).]` };
                    else if (msg.type === 'gift') {
                        const itemsSummary = msg.items.map(item => `${item.name} x${item.quantity}`).join(', ');
                        let recipientSummary = chat.isGroup ? `gave a gift to ${msg.recipients.map(name => getDisplayNameInGroup(chat, name)).join(', ')}` : `gave a gift to ${chat.name}`;
                        return { role: 'user', content: `${prefix}[System notice: You ${recipientSummary}. Gift: ${itemsSummary}]` };
                    }
                    if (msg.meaning) return { role: 'user', content: `${prefix}[You sent a sticker with the meaning '${msg.meaning}']` };
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
                const friendRequestInstruction = {
                    role: 'user',
                    content: `
        [Important system instruction]
        The user sent you a friend request with this reason: "${chat.relationship.applicationReason}".
        Use the most recent exchange above for reference.
        Respond in character with friend_request_response. Set decision to 'accept' or 'reject'.
        `
                };
                messagesPayload.push(friendRequestInstruction);
            }
        }
    }
    return { systemPrompt, messagesPayload, activitySources };
}
