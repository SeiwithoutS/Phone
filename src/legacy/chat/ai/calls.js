import { requestContextCompletion } from '../../../features/api/completion'
import { characterPrompt } from '../../../features/characters/characters'
import { getGeminiResponseText, parseAiResponse } from '../../api/client.js'
import { showCallMessageActions, startVideoCall, triggerAiInCallAction } from '../../calls/calls.js'
import { renderChatInterface, setAvatarActingState } from '../conversation.js'
import { addLongPressListener } from '../../dialogs/dialogs.js'
import { showScreen } from '../../../app/routes'
import { runtime } from '../../runtime/state.js'

export async function respondToVideoCallRequest(chat, chatId) {
    console.log(`Requesting a call decision from "${chat.name}".`);

    let callDecisionPrompt;
    if (chat.isGroup) {
        callDecisionPrompt = `
# Group video call decision
The user just started a group video call. Decide separately for every AI member, using their persona and relationship with the user.

# Required output
Return a JSON array with one decision object for every character. Use their original name and choose "join" or "decline".
[{"type": "group_call_response", "name": "Member A's original name", "decision": "join"}, {"type": "group_call_response", "name": "Member B's original name", "decision": "decline"}]

# Group members and personas
${chat.members.map(m => `- ${m.groupNickname} (original name: ${m.originalName}): ${m.persona}`).join('\n')}

Decide now for every member.
`;
    } else {
        callDecisionPrompt = `
# Video call decision
The user just called you. Decide whether to accept based on your character's persona.

# Character persona
${characterPrompt(chat)}

# Required output
Return exactly one of these JSON arrays with no surrounding text.

Accept: [{"type": "video_call_response", "decision": "accept"}]
Decline: [{"type": "video_call_response", "decision": "reject"}]

Decide now.
`;
    }

    try {
        const response = await requestContextCompletion(chat, {
            instructions: callDecisionPrompt, task: 'QQ call decision',
            request: [{ role: 'user', content: 'Decide whether to accept this call.' }]
        }, { temperature: 0.7 });

        if (!response.ok) throw new Error(`API request failed: ${(await response.json()).error.message}`);

        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        const responseArray = parseAiResponse(aiResponseContent);

        let callHasBeenHandled = false;
        for (const msgData of responseArray) {
            if (msgData.type === 'video_call_response') {
                runtime.videoCallState.isAwaitingResponse = false;
                if (msgData.decision === 'accept') {
                    startVideoCall();
                } else {
                    const aiMessage = { role: 'assistant', content: 'The character declined your video call.', timestamp: Date.now() };
                    chat.history.push(aiMessage);
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

    } catch (error) {
        console.error("The call decision request failed:", error);
        const fallbackResponse = chat.isGroup ?
            chat.members.map(m => ({ type: "group_call_response", name: m.originalName, decision: "decline" })) :
            [{ type: "video_call_response", decision: "reject" }];

        if (chat.isGroup) {
            runtime.videoCallState.isAwaitingResponse = false;
            runtime.videoCallState.participants = [];
            alert("Nobody answered the group call.");
            showScreen('chat-interface-screen');
        } else {
            const aiMessage = { role: 'assistant', content: 'The character declined your video call.', timestamp: Date.now() };
            chat.history.push(aiMessage);
            await runtime.db.chats.put(chat);
            showScreen('chat-interface-screen');
            renderChatInterface(chatId);
        }
    } finally {

        setAvatarActingState(chatId, false);
        return;
    }
}

export async function handleRegenerateCallResponse() {
    if (!runtime.videoCallState.isActive) return;

    const lastUserSpeechIndex = runtime.videoCallState.callHistory.findLastIndex(msg => msg.role === 'user');

    if (lastUserSpeechIndex === -1) {
        alert("Speak in the call before regenerating a reply.");
        return;
    }

    runtime.videoCallState.callHistory.splice(lastUserSpeechIndex + 1);

    const callFeed = document.getElementById('video-call-main');
    callFeed.innerHTML = '';
    runtime.videoCallState.callHistory.forEach(msg => {

        const bubble = document.createElement('div');
        bubble.className = `call-message-bubble ${msg.role}-speech`;
        bubble.dataset.timestamp = msg.timestamp;
        if (msg.role === 'user') {
            bubble.textContent = msg.content;
        } else {
            bubble.innerHTML = msg.content;
        }
        addLongPressListener(bubble, () => showCallMessageActions(msg.timestamp));
        callFeed.appendChild(bubble);
    });
    callFeed.scrollTop = callFeed.scrollHeight;

    triggerAiInCallAction(null);
}
