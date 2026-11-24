import { requestContextCompletion, streamingReplyText } from '../../features/api/completion'
import { characterPrompt } from '../../features/characters/characters'
import { withConversationRequest } from '../../features/chat/sessions'
import { escapeHtml } from '../../runtime/files'
import { getGeminiResponseText } from '../api/client.js'
import { stopSilentAudio } from '../calls/audio.js'
import { renderChatInterface, setAvatarActingState } from './conversation.js'
import { renderChatList } from './list.js'
import { showCustomAlert } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'
import { respondToVideoCallRequest } from './ai/calls.js'
import { buildQQReplyInput } from './ai/context.js'
import { applyChatAiResponse } from './ai/response.js'

export { handleSpectatorReroll, triggerGroupAiAction, triggerSpectatorGroupAiAction } from './ai/group.js'
export { handleRegenerateCallResponse } from './ai/calls.js'
export { handlePropelAction } from './ai/nudge.js'

export function triggerAiResponse() {
    return withConversationRequest(runtime.state.activeChatId, triggerAiResponseForConversation);
}

async function triggerAiResponseForConversation() {
    if (!runtime.state.activeChatId) return;
    const chatId = runtime.state.activeChatId;
    const chat = runtime.state.chats[runtime.state.activeChatId];

    setAvatarActingState(chatId, true);
    const chatHeaderTitle = document.getElementById('chat-header-title');
    const typingIndicator = document.getElementById('typing-indicator');

    const chatListItem = document.querySelector(`.chat-list-item[data-chat-id="${chatId}"]`);
    const avatarInList = chatListItem ? chatListItem.querySelector('.avatar') : null;
    if (avatarInList) {
        avatarInList.classList.add('is-acting');
    }

    if (chat.isGroup) {
        if (typingIndicator) {
            typingIndicator.textContent = "Members are typing…";
            typingIndicator.style.display = 'block';
        }
    } else {
        if (chatHeaderTitle) {
            chatHeaderTitle.style.opacity = 0;
            setTimeout(() => {
                chatHeaderTitle.textContent = "Typing…";
                chatHeaderTitle.classList.add('typing-status');
                chatHeaderTitle.style.opacity = 1;
            }, 200);
        }
    }
    try {
        const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
        if (!proxyUrl || !model) {
            alert("Enter a base URL and API key and select a model in API Connections.");
            if (chat.isGroup) {
                if (typingIndicator) typingIndicator.style.display = 'none';
            } else {
                if (chatHeaderTitle && runtime.state.chats[chatId]) {
                    chatHeaderTitle.textContent = runtime.state.chats[chatId].name;
                    chatHeaderTitle.classList.remove('typing-status');
                }
            }
            return;
        }

        const lastMessage = chat.history.slice(-1)[0];
        const isVideoCallRequest = lastMessage?.role === 'system' && (
            lastMessage.type === 'video_call_requested' || lastMessage.content?.includes?.('视频通话请求')
        );

        if (isVideoCallRequest) {
            await respondToVideoCallRequest(chat, chatId);
            return;
        }

        if (!chat.isGroup && chat.relationship?.status === 'pending_ai_approval') {
            console.log(`Requesting a friend decision from "${chat.name}".`);

            const decisionPrompt = `
# Friend request decision
You are "${chat.name}". You previously blocked the user. They sent a new friend request to make amends.

# Information for your decision
- Your persona: ${characterPrompt(chat)}
- The user's reason: "${chat.relationship.applicationReason}"

# Required output
Decide whether to accept and give an in-character reason. Follow the conversation's language for the reason. Return one JSON object and no extra text.

Accept: {"decision": "accept", "reason": "You sound sincere. I'll give us another chance."}
Decline: {"decision": "reject", "reason": "I'm not ready yet. Please give me a little more time."}
`;

            try {

                const response = await requestContextCompletion(chat, {
                    instructions: decisionPrompt, task: 'QQ friend decision',
                    request: [{ role: 'user', content: 'Review the friend request and return your decision.' }]
                });

                if (!response.ok) {
                    throw new Error(`API request failed: ${(await response.json()).error.message}`);
                }
                const data = await response.json();

                const rawContent = getGeminiResponseText(data).replace(/^```json\s*/, '').replace(/```$/, '').trim();
                const decisionObj = JSON.parse(rawContent);

                if (decisionObj.decision === 'accept') {
                    chat.relationship.status = 'friend';
                    const acceptMessage = { role: 'assistant', senderName: chat.name, content: decisionObj.reason, timestamp: Date.now() };
                    chat.history.push(acceptMessage);
                } else {
                    chat.relationship.status = 'blocked_by_ai';
                    const rejectMessage = { role: 'assistant', senderName: chat.name, content: decisionObj.reason, timestamp: Date.now() };
                    chat.history.push(rejectMessage);
                }
                chat.relationship.applicationReason = '';

                await runtime.db.chats.put(chat);
                renderChatInterface(chatId);
                renderChatList();
            } catch (error) {

                chat.relationship.status = 'blocked_by_ai';
                await runtime.db.chats.put(chat);
                await showCustomAlert("Friend Request Failed", `The AI could not process your friend request. Try again later. Error: ${error.message}`);
                renderChatInterface(chatId);
            }
            return;
        }

        const { input, replyToUserTimestamp } = await buildQQReplyInput(chat);
        const streamingPreview = document.getElementById('context-stream-preview');
        let response;
        try {
            response = await requestContextCompletion(chat, input, {
                swipes: !chat.settings.isOfflineMode, onText: text => {
                    if (!streamingPreview || runtime.state.activeChatId !== chatId) return;
                    const preview = streamingReplyText(text);
                    streamingPreview.textContent = preview.slice(-700);
                    streamingPreview.hidden = !preview;
                }
            });
        } finally {
            if (streamingPreview) { streamingPreview.hidden = true; streamingPreview.textContent = ''; }
        }

        if (!response.ok) {
            const body = (await response.text()).trim();
            let detail = body;
            try {
                const errorData = JSON.parse(body);
                if (typeof errorData?.error?.message === 'string') detail = errorData.error.message;
            } catch {}
            throw new Error(`API returned HTTP ${response.status}${detail ? ' - ' + detail.slice(0, 4000) : ''}`);
        }

        await applyChatAiResponse(chat, chatId, await response.json(), replyToUserTimestamp);

    } catch (error) {

        chat.history = chat.history.filter(msg => !msg.isTemporary);

        if (!chat.isGroup && chat.relationship?.status === 'pending_ai_approval') {
            chat.relationship.status = 'blocked_by_ai';
            await showCustomAlert("Friend Request Failed", `The AI could not process your friend request. Try again later. Error: ${error.message}`);
        } else {
            await showCustomAlert(
                "API Request Failed",
                'The AI did not reply. ' + escapeHtml(error.message)
            );
        }

        if (!chat.isGroup && chat.relationship?.status === 'blocked_by_ai') {
            await runtime.db.chats.put(chat);
        }

        runtime.videoCallState.isAwaitingResponse = false;
    } finally {
        setAvatarActingState(chatId, false);

        if (chat.isGroup) {
            if (typingIndicator) {
                typingIndicator.style.display = 'none';
            }
        } else {
            if (chatHeaderTitle && runtime.state.chats[chatId]) {
                chatHeaderTitle.style.opacity = 0;
                setTimeout(() => {
                    chatHeaderTitle.textContent = runtime.state.chats[chatId].name;
                    chatHeaderTitle.classList.remove('typing-status');
                    chatHeaderTitle.style.opacity = 1;
                }, 200);
            }
        }
        renderChatList();
        stopSilentAudio();
    }
}
