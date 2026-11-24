import { resolveTimeZone } from '../../../features/chat/location'
import { newReplyTurn, replyTimestamp } from '../../../features/chat/reply-turns'
import { requestContextCompletion } from '../../../features/api/completion'
import { characterPrompt } from '../../../features/characters/characters'
import { withConversationRequest } from '../../../features/chat/sessions'
import { getGeminiResponseText, parseAiResponse } from '../../api/client.js'
import { appendMessage, setAvatarActingState } from '../conversation.js'
import { getTimeOfDayGreeting } from '../../../features/chat/format'
import { renderChatList } from '../list.js'
import { showCustomAlert } from '../../dialogs/dialogs.js'
import { formatGomokuStateForAI } from '../../gomoku/gomoku.js'
import { getStickerContextForPrompt } from '../../stickers/stickers.js'
import { runtime } from '../../runtime/state.js'

export function handlePropelAction() {
    return withConversationRequest(runtime.state.activeChatId, handlePropelActionForConversation);
}

async function handlePropelActionForConversation() {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return;

    setAvatarActingState(chat.id, true);
    const chatHeaderTitle = document.getElementById('chat-header-title');
    if (!chat.isGroup) {
        chatHeaderTitle.style.opacity = 0;
        setTimeout(() => {
            chatHeaderTitle.textContent = "Typing…";
            chatHeaderTitle.classList.add('typing-status');
            chatHeaderTitle.style.opacity = 1;
        }, 200);
    }

    try {
        const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
        if (!proxyUrl || !model) {
            throw new Error('Set up your API connection first.');
        }

        const now = new Date();
        const zone = resolveTimeZone(chat.settings.characterLocation, chat.settings.timeZone).zone;
        const currentTime = now.toLocaleString('en-GB', { timeZone: zone, dateStyle: 'full', timeStyle: 'short' });
        const timeOfDayGreeting = getTimeOfDayGreeting(now, zone);
        const myNickname = chat.settings.myNickname || '我';

        let musicContext = '';
        if (runtime.musicState.isActive && runtime.musicState.activeChatId === chat.id) {
            const currentTrack = runtime.musicState.currentIndex > -1 ? runtime.musicState.playlist[runtime.musicState.currentIndex] : null;
            musicContext = `\n\n# Current music context\n(The same details apply as in a regular reply.)`;
        }
        const gomokuContext = formatGomokuStateForAI(runtime.gomokuState[chat.id]);
        let nameHistoryContext = '';
        if (chat.nameHistory && chat.nameHistory.length > 0) {
            nameHistoryContext = `\n- **Your previous names**: [${chat.nameHistory.join(', ')}]. These names refer to you wherever they appear in the history.`;
        }
        let userProfileContext = '';
        const userQzoneNickname = runtime.state.qzoneSettings.nickname || '用户';
        userProfileContext += `- The user's Qzone nickname is "${userQzoneNickname}".\n`;
        const commonGroups = Object.values(runtime.state.chats).filter(group => group.isGroup && group.members.some(m => m.id === chat.id));
        if (commonGroups.length > 0) {
            userProfileContext += '- These are the user’s nicknames in groups you share:\n';
            commonGroups.forEach(group => {
                const myNicknameInGroup = group.settings.myNickname || userQzoneNickname;
                userProfileContext += `  - In "${group.name}", the user goes by "${myNicknameInGroup}".\n`;
            });
        }
        userProfileContext += 'These names refer to your chat partner in system notices, post comments, and any included memories from group chats.';
        const stickerContext = getStickerContextForPrompt(chat);

        const systemPrompt = `
# Your role in the chat
You are "${chat.originalName}", chatting naturally with the user online. Keep your choices faithful to your character. Follow the conversation's language and any language preference in the personas.

# Required output format (highest priority)
Return a JSON array. Every object must have a "type" field.

# How to continue the conversation
- Write 3–8 short messages and vary the number from turn to turn. Keep the interaction online and do not develop an offline storyline.
${chat.settings.enableTimePerception ? `- Let the current time (${currentTime}, ${timeOfDayGreeting}) come through naturally.` : ''}
- Use actions when they suit the chat. You can update your status, change your avatar, save a memory, make plans, or interact socially. Use \`block_user\` only if the relationship breaks down.
- End the array with "update_thoughts". In "heartfelt_voice", write one sentence capturing the character's most private thought right now. In "random_jottings", write at least 50 characters of in-character reflection.
- When using a sticker, pick the exact meaning that best matches the character's mood and the situation. Vary your choices.

# Your character persona
Follow this persona and the long-term memories provided.
${characterPrompt(chat)}

# Relationship and identity
- Your original name is "${chat.originalName}". Use it in an action's "name" field.
- The user's display name for you is "${chat.name}". You can suggest changing it.
- Your nickname for the user is "${myNickname}". You can change it.
${userProfileContext}
${nameHistoryContext}
# Available stickers
${stickerContext}
# Avatar libraries
- Your avatars
  ${chat.settings.aiAvatarLibrary && chat.settings.aiAvatarLibrary.length > 0 ? chat.settings.aiAvatarLibrary.map(avatar => `- ${avatar.name}`).join('\n') : '- (empty)'}
- The user's avatars
  ${chat.settings.myAvatarLibrary && chat.settings.myAvatarLibrary.length > 0 ? chat.settings.myAvatarLibrary.map(avatar => `- ${avatar.name}`).join('\n') : '- (empty)'}

# Available actions
Use the actual timestamp when quoting a message or responding to a pending transfer or delivery payment request.

### Chat
- **Text** \`{"type": "text", "content": "Hi there!"}\`
- **Sticker** \`{"type": "sticker", "meaning": "Exact meaning from the list"}\`
- **Image** \`{"type": "ai_image", "description": "Detailed description in Chinese"}\`
- **Voice message** \`{"type": "voice_message", "content": "Spoken words"}\`
- **Quote a message** \`{"type": "quote_reply", "target_timestamp": 1700000000000, "reply_content": "Your reply"}\`

### Social and relationship actions
- **Pat the user** \`{"type": "pat_user", "suffix": "Optional suffix"}\`
- **Share a link** \`{"type": "share_link", "title": "Title", "description": "Summary", "source_name": "Source", "content": "Full text"}\`
- **Share location** \`{"type": "location_share", "content": "Place name"}\`
- **Change your display name** \`{"type": "change_remark_name", "new_name": "New name"}\`
- **Change the user's nickname** \`{"type": "change_user_nickname", "new_name": "New nickname"}\`
- **Change your avatar** \`{"type": "change_avatar", "name": "Name from your avatar library"}\`
- **Change the user's avatar** \`{"type": "change_user_avatar", "name": "Name from the user's avatar library"}\`
- **Respond to a friend request** \`{"type": "friend_request_response", "decision": "accept"}\`. Use "reject" to decline.
- **Block the user** \`{"type": "block_user"}\`

### Other actions
- **Save a memory** \`{"type": "create_memory", "description": "Describe the meaningful event."}\`
- **Create a countdown for a plan** \`{"type": "create_countdown", "title": "Title of the plan", "date": "YYYY-MM-DDTHH:mm:ss"}\`
- **Change the song** \`{"type": "change_music", "song_name": "Song from the playlist"}\`
- **Send a transfer** \`{"type": "transfer", "amount": 5.20, "note": "Reason"}\`
- **Respond to a transfer** \`{"type": "accept_transfer", "for_timestamp": 1700000000000}\` or \`{"type": "decline_transfer", "for_timestamp": 1700000000000}\`
- **Request payment for delivery** \`{"type": "waimai_request", "productInfo": "Item", "amount": 25}\` when you want the user to pay for your order.
- **Respond to a delivery payment request** \`{"type": "waimai_response", "status": "paid", "for_timestamp": 1700000000000}\`. Use "rejected" to decline.
- **Start a video call** \`{"type": "video_call_request"}\`
- **Respond to a video call** \`{"type": "video_call_response", "decision": "accept"}\`. Use "reject" to decline.

# The user's persona
${chat.settings.myPersona}

Continue the conversation using the rules and history provided.
`;

        const response = await requestContextCompletion(chat, {
            instructions: systemPrompt, activity: [musicContext],
            task: 'QQ nudge', request: [{ role: 'user', content: 'The user nudged you. React in character.' }]
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API request failed: ${errorData.error.message}`);
        }

        const data = await response.json();

        const aiResponseContent = getGeminiResponseText(data);

        const messagesArray = parseAiResponse(aiResponseContent);
        const processedActions = [];
        for (const action of messagesArray) {
            if (action.type === 'text' && typeof action.content === 'string' && action.content.includes('\n')) {
                const lines = action.content.split(/\n+/).filter(line => line.trim());
                lines.forEach(line => {
                    processedActions.push({ ...action, content: line });
                });
            } else {
                processedActions.push(action);
            }
        }

        const turn = newReplyTurn();
        let messageTimestamp = replyTimestamp(chat.history);
        for (const msgData of processedActions) {
            const aiMessage = {
                role: 'assistant',
                senderName: chat.originalName,
                timestamp: messageTimestamp++,
                ...turn,
                content: msgData.content || msgData.message,
                type: msgData.type || 'text',

            };
            if (msgData.type === 'update_thoughts') {
                if (!chat.isGroup) {
                    if (msgData.heartfelt_voice) chat.heartfeltVoice = String(msgData.heartfelt_voice);
                    if (msgData.random_jottings) chat.randomJottings = String(msgData.random_jottings);
                }
                continue;
            }
            chat.history.push(aiMessage);
            appendMessage(aiMessage, chat);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 800));
        }

        await runtime.db.chats.put(chat);
        renderChatList();

    } catch (error) {
        console.error("Could not advance the conversation:", error);
        await showCustomAlert("Operation Failed", `Could not advance the story: ${error.message}`);
    } finally {

        setAvatarActingState(chat.id, false);
        if (!chat.isGroup && document.getElementById('chat-header-title')) {
            const titleEl = document.getElementById('chat-header-title');
            titleEl.style.opacity = 0;
            setTimeout(() => {
                titleEl.textContent = chat.name;
                titleEl.classList.remove('typing-status');
                titleEl.style.opacity = 1;
            }, 200);
        }
    }
}
