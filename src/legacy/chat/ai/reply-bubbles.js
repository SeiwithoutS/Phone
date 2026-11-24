import { parseAiResponse } from '../../api/client.js'
import { findStickerForChat } from '../../stickers/stickers.js'

export function parseReplyActions(raw) {
    return typeof raw === 'string' && raw.trim() ? parseAiResponse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')).filter(action =>
        action && typeof action === 'object' && typeof action.type === 'string') : [];
}

export function replyBubble(chat, action, baseMessage) {
    const text = action.content || action.message;
    switch (action.type) {
        case 'text':
            if (typeof text !== 'string' || !text.trim()) return null;
            if (chat.settings.enableTts !== false && text.trim().startsWith('[V]')) {
                return { ...baseMessage, type: 'voice_message', content: text.trim().slice(3).trim() };
            }
            return { ...baseMessage, content: text };
        case 'offline_text':
            if (![action.content, action.dialogue, action.description].some(value => typeof value === 'string' && value.trim())) return null;
            return { ...baseMessage, type: 'offline_text', content: action.content, dialogue: action.dialogue, description: action.description };
        case 'quote_reply': {
            if (typeof action.reply_content !== 'string' || !action.reply_content.trim()) return null;
            const original = chat.history.find(message => message.timestamp === action.target_timestamp);
            return {
                ...baseMessage, content: action.reply_content,
                ...(original && { quote: {
                    timestamp: original.timestamp,
                    senderName: original.senderName || (original.role === 'user' ? (chat.settings.myNickname || 'You') : chat.name),
                    content: String(original.content || '').slice(0, 50)
                } })
            };
        }
        case 'voice_message':
            return typeof text === 'string' && text.trim() ? { ...baseMessage, type: 'voice_message', content: text } : null;
        case 'sticker': {
            const sticker = action.meaning && findStickerForChat(chat, action.meaning, action.name);
            if (sticker) return { ...baseMessage, type: 'sticker', content: sticker.url, meaning: sticker.name };
            if (action.meaning) return { ...baseMessage, type: 'text', content: `[Sticker: ${action.meaning}]` };
            return action.url ? { ...baseMessage, type: 'sticker', content: action.url, meaning: 'Unknown sticker' } : null;
        }
        case 'ai_image':
            return typeof action.description === 'string' && action.description.trim()
                ? { ...baseMessage, type: 'ai_image', content: action.description, image_prompt: action.image_prompt } : null;
        default:
            return null;
    }
}

export function alternateReplyBubbles(chat, raw, turnId, time, nextTimestamp, isOpening = false) {
    const bubbles = parseReplyActions(raw).flatMap(action => {
        if (chat.isGroup && !chat.members?.some(member => member.originalName === action.name)) return [];
        const bubble = replyBubble(chat, action, {
            role: 'assistant', senderName: action.name || chat.name, timestamp: nextTimestamp(),
            replyTurnId: turnId, replyTurnTime: time,
        });
        return bubble ? [bubble] : [];
    });
    if (isOpening && bubbles[0]) bubbles[0].isOpening = true;
    return bubbles;
}
