import { playSilentAudio } from '../calls/audio.js'
import { triggerAiResponse } from './ai.js'
import { cancelReplyMode } from './attachments.js'
import { appendMessage } from './conversation.js'
import { renderChatList } from './list.js'
import { controls } from '../runtime/state.js'
import { runtime } from '../runtime/state.js'

export function bindChatComposer() {
  controls.chatInput = document.getElementById('chat-input')

document.getElementById('send-btn').addEventListener('click', () => { 
playSilentAudio();
    const content = controls.chatInput.value.trim();
    if (!content || !runtime.state.activeChatId) return;

    const chat = runtime.state.chats[runtime.state.activeChatId];
    const msg = {
        role: 'user',
        content,
        timestamp: Date.now()
    };

    if (runtime.currentReplyContext) {
        msg.quote = runtime.currentReplyContext;
    }

    
    appendMessage(msg, chat);

    
    (async () => {
        chat.history.push(msg);
        await runtime.db.chats.put(chat); 
    renderChatList(); 

    })();

    
    controls.chatInput.value = '';
    controls.chatInput.style.height = 'auto';
    controls.chatInput.focus();
    cancelReplyMode();
});

document.getElementById('wait-reply-btn').addEventListener('click', triggerAiResponse);

controls.chatInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    document.getElementById('send-btn').click();
});
}
