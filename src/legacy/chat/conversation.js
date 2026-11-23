import { escapeHtml } from '../../runtime/files'
import { characterAvatar } from '../../features/characters/gallery'
import { sharedCardHtml } from '../../features/chat/shared-cards'
import { applyScopedCss } from '../appearance/theme.js'
import { updateBackButtonUnreadCount } from '../backup/backup.js'
import { toggleCallButtons } from '../calls/calls.js'
import { showCharacterProfileModal } from '../character-phone/profile.js'
import { triggerAiResponse, triggerSpectatorGroupAiAction } from './ai.js'
import { cleanupWaimaiTimers, handleUserPat, startWaimaiCountdown } from './attachments.js'
import { applyButtonOrder } from './button-order.js'
import { showMessageActions } from './editor.js'
import { createSystemTimestampElement, formatTimestamp } from '../../features/chat/format'
import { getDisplayNameInGroup, processMentions } from './groups.js'
import { exitSelectionMode, toggleMessageSelection } from './messages.js'
import { addLongPressListener } from '../dialogs/dialogs.js'
import { hideLoader, showLoader } from '../dialogs/dialogs.js'
import { playNotificationSound } from '../home/status.js'
import { applyLyricsBarPosition } from '../music/player.js'
import { parseMarkdown } from '../rendering/markup.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'

export async function renderChatInterface(chatId) {
            applyButtonOrder();
            cleanupWaimaiTimers();
            const chat = runtime.state.chats[chatId];
            if (!chat) return;

            exitSelectionMode();

            const messagesContainer = document.getElementById('chat-messages');
            const chatInputArea = document.getElementById('chat-input-area');
            const lockOverlay = document.getElementById('chat-lock-overlay');
            const lockContent = document.getElementById('chat-lock-content');

            messagesContainer.dataset.theme = chat.settings.theme || 'default';
            const fontSize = chat.settings.fontSize || 13;
            messagesContainer.style.setProperty('--chat-font-size', `${fontSize}px`);
            applyScopedCss(chat.settings.customCss || '', '#chat-messages', 'custom-bubble-style');

            document.getElementById('chat-header-title').textContent = chat.name;
            const statusContainer = document.getElementById('chat-header-status');
            const statusTextEl = statusContainer.querySelector('.status-text');

            if (chat.isGroup) {
                statusContainer.style.display = 'none';
                document.getElementById('chat-header-title-wrapper').style.justifyContent = 'center';
            } else {
                statusContainer.style.display = 'flex';
                document.getElementById('chat-header-title-wrapper').style.justifyContent = 'flex-start';
                statusTextEl.textContent = chat.status?.text || "Online";
                statusContainer.classList.toggle('busy', chat.status?.isBusy || false);
            }

            const chatScreen = document.getElementById('chat-interface-screen');
            const individualBg = chat.settings.background;
            const globalBg = runtime.state.globalSettings.globalChatBackground;
            const isDarkMode = document.getElementById('phone-screen').classList.contains('dark-mode');
            const defaultColor = isDarkMode ? '#000000' : '#f0f2f5';

            if (individualBg) {
                chatScreen.style.backgroundImage = `url(${individualBg})`;
                chatScreen.style.backgroundColor = 'transparent';
            } else if (globalBg) {
                chatScreen.style.backgroundImage = `url(${globalBg})`;
                chatScreen.style.backgroundColor = 'transparent';
            } else {
                chatScreen.style.backgroundImage = 'none';
                chatScreen.style.backgroundColor = defaultColor;
            }

            
            if (chat.isSpectatorGroup) {
                chatInputArea.style.display = 'none';
                lockOverlay.style.display = 'flex';
                lockContent.innerHTML = `
                    <span class="lock-text">Watching the group chat…</span>
                    <div class="spectator-actions-container">
                        <button id="spectator-reroll-btn" class="lock-action-btn secondary" title="重新生成上一轮对话">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4"></path>
                                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path>
                            </svg>
                        </button>
                        <button id="spectator-propel-btn" class="lock-action-btn">Advance the Story</button>
                        <button id="spectator-edit-btn" class="lock-action-btn secondary" title="导演剪辑室：编辑AI上一轮的响应">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                                <line x1="16" y1="8" x2="2" y2="22"></line>
                                <line x1="17.5" y1="15" x2="9" y2="15"></line>
                            </svg>
                        </button>
                    </div>
                `;
                document.getElementById('spectator-propel-btn').onclick = triggerSpectatorGroupAiAction;
            } else {
                chatInputArea.style.display = 'flex';
                lockOverlay.style.display = 'none';
                lockContent.innerHTML = '';
                if (!chat.isGroup && chat.relationship.status !== 'friend') {
                    lockOverlay.style.display = 'flex';
                    chatInputArea.style.visibility = 'hidden';
                    
                    let lockHtml = '';
                    switch (chat.relationship.status) {
                         case 'blocked_by_user':
                            const isSimulationRunning = runtime.simulationIntervalId !== null;
                            const blockedTimestamp = chat.relationship.blockedTimestamp;
                            const cooldownHours = runtime.state.globalSettings.blockCooldownHours || 1;
                            const cooldownMilliseconds = cooldownHours * 60 * 60 * 1000;
                            const timeSinceBlock = Date.now() - blockedTimestamp;
                            const isCooldownOver = timeSinceBlock > cooldownMilliseconds;
                            const timeRemainingMinutes = Math.max(0, Math.ceil((cooldownMilliseconds - timeSinceBlock) / (1000 * 60)));
            
                            lockHtml = `
                                <span class="lock-text">You blocked “${chat.name}”.</span>
                                <button id="unblock-btn" class="lock-action-btn">Unblock</button>
                                <div style="margin-top: 20px; padding: 10px; border: 1px dashed #ccc; border-radius: 8px; font-size: 11px; text-align: left; color: #666; background: rgba(0,0,0,0.02);">
                                    <strong style="color: #333;">【开发者诊断面板】</strong><br>
                                    - Background activity: ${runtime.state.globalSettings.enableBackgroundActivity ? '<span style="color: green;">On</span>' : '<span style="color: red;">Off</span>'}<br>
                                    - Background timer: ${isSimulationRunning ? '<span style="color: green;">Running</span>' : '<span style="color: red;">Stopped</span>'}<br>
                                    - 当前角色状态: <strong>${chat.relationship.status}</strong><br>
                                    - 需要冷静(小时): <strong>${cooldownHours}</strong><br>
                                    - Cooldown finished: ${isCooldownOver ? "<span style=\"color: green;\">Yes</span>" : `<span style="color: orange;">No (about ${timeRemainingMinutes} min left)</span>`}<br>
                                    - Can check now: ${isCooldownOver && runtime.state.globalSettings.enableBackgroundActivity ? '<span style="color: green;">Waiting for next check</span>' : '<span style="color: red;">No</span>'}
                                </div>
                                <button id="force-apply-check-btn" class="lock-action-btn secondary" style="margin-top: 10px;">Check for Friend Request</button>
                            `;
                            break;
                        case 'blocked_by_ai':
                            lockHtml = `
                                <span class="lock-text">This character blocked you.</span>
                                <button id="apply-friend-btn" class="lock-action-btn">Send Friend Request</button>
                            `;
                            break;
                        case 'pending_user_approval':
                            lockHtml = `
                                <span class="lock-text">“${chat.name}”请求添加你为好友：<br><i>“${chat.relationship.applicationReason}”</i></span>
                                <button id="accept-friend-btn" class="lock-action-btn">Accept</button>
                                <button id="reject-friend-btn" class="lock-action-btn secondary">Decline</button>
                            `;
                            break;
                        case 'pending_ai_approval':
                            lockHtml = `<span class="lock-text">Friend request sent…</span>`;
                            break;
                    }
                    lockContent.innerHTML = lockHtml;
                } else {
                     lockOverlay.style.display = 'none';
                     chatInputArea.style.visibility = 'visible';
                }
            }
            
            messagesContainer.innerHTML = '';
            const history = chat.history;
            runtime.currentRenderedCount = 0;
            const renderWindow = runtime.state.globalSettings.chatRenderWindow || 50;
            const initialMessages = history.slice(-renderWindow);

            
            
            const messagePromises = [];
            let lastTimestamp = 0;

            for (const msg of initialMessages) {
                if (lastTimestamp > 0 && (msg.timestamp - lastTimestamp > 600000)) {
                    
                    messagePromises.push(Promise.resolve(createSystemTimestampElement(msg.timestamp)));
                }
                
                messagePromises.push(createMessageElement(msg, chat, true));
                lastTimestamp = msg.timestamp;
            }

            
            const messageElements = await Promise.all(messagePromises);

            
            const fragment = document.createDocumentFragment();
            messageElements.filter(Boolean).forEach(el => fragment.appendChild(el));
            messagesContainer.appendChild(fragment);
            

            runtime.currentRenderedCount = initialMessages.length;

            const typingIndicator = document.createElement('div');
            typingIndicator.id = 'typing-indicator';
            typingIndicator.style.display = 'none';
            typingIndicator.textContent = "Typing…";
            messagesContainer.appendChild(typingIndicator);

            setTimeout(() => messagesContainer.scrollTop = messagesContainer.scrollHeight, 0);
        }

export async function loadMoreMessages() {
    if (runtime.isLoadingMoreMessages) return;
    runtime.isLoadingMoreMessages = true;

    const messagesContainer = document.getElementById('chat-messages');
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) {
        runtime.isLoadingMoreMessages = false;
        return;
    }

    showLoader(messagesContainer, 'top'); 
    const oldScrollHeight = messagesContainer.scrollHeight;

    
    await new Promise(resolve => setTimeout(resolve, 500));

    const totalMessages = chat.history.length;
    const renderWindow = runtime.state.globalSettings.chatRenderWindow || 50;
    const nextSliceStart = totalMessages - runtime.currentRenderedCount - renderWindow;
    const nextSliceEnd = totalMessages - runtime.currentRenderedCount;
    const messagesToPrepend = chat.history.slice(Math.max(0, nextSliceStart), nextSliceEnd);


    
    const firstVisibleMessage = messagesContainer.querySelector('.message-wrapper[data-timestamp]');
    let nextMessageTimestamp = firstVisibleMessage ? parseInt(firstVisibleMessage.dataset.timestamp) : 0;

    
    for (const msg of messagesToPrepend.reverse()) {
        
        
        if (nextMessageTimestamp > 0 && (nextMessageTimestamp - msg.timestamp > 600000)) { 
            
            const timestampEl = createSystemTimestampElement(nextMessageTimestamp);
            
            messagesContainer.prepend(timestampEl);
        }
        
        
        await prependMessage(msg, chat);
        
        
        nextMessageTimestamp = msg.timestamp;
    }

    runtime.currentRenderedCount += messagesToPrepend.length;

    
    const newScrollHeight = messagesContainer.scrollHeight;
    messagesContainer.scrollTop = newScrollHeight - oldScrollHeight;

    hideLoader(messagesContainer); 
    runtime.isLoadingMoreMessages = false;
}

export function scrollToOriginalMessage(originalTimestamp) {
    const selector = `.message-bubble[data-timestamp="${originalTimestamp}"]`;
    const originalMessageBubble = document.querySelector(selector);

    if (originalMessageBubble) {
        originalMessageBubble.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        originalMessageBubble.classList.add('highlighted');
        setTimeout(() => {
            if (document.body.contains(originalMessageBubble)) {
                originalMessageBubble.classList.remove('highlighted');
            }
        }, 1500); 

    } else {
        
        alert("The original message may have been deleted or may be earlier in the chat.");
    }
}

export async function createMessageElement(msg, chat) {
        
            
            if (msg.type === 'recalled_message') {
                const wrapper = document.createElement('div');
                wrapper.className = 'message-wrapper system-pat';
                wrapper.dataset.timestamp = msg.timestamp; 
                const bubble = document.createElement('div');
                bubble.className = 'message-bubble recalled-message-placeholder';
                bubble.dataset.timestamp = msg.timestamp; 
                bubble.textContent = msg.content;
                wrapper.appendChild(bubble);
                addLongPressListener(wrapper, () => showMessageActions(msg.timestamp));
                wrapper.addEventListener('click', () => { 
                    if (runtime.isSelectionMode) {
                        toggleMessageSelection(msg.timestamp);
                    }
                });
                return wrapper;
            }
            else if (msg.type === 'post_deleted_notice') {
                const wrapper = document.createElement('div');
                wrapper.className = 'message-wrapper system-pat';
                wrapper.dataset.timestamp = msg.timestamp; 
                const bubble = document.createElement('div');
                bubble.className = 'message-bubble post-deleted-placeholder'; 
                bubble.dataset.postId = msg.postId;
                bubble.textContent = msg.content;
                wrapper.appendChild(bubble);
                addLongPressListener(wrapper, () => showMessageActions(msg.timestamp));
                wrapper.addEventListener('click', () => { 
                    if (runtime.isSelectionMode) {
                        toggleMessageSelection(msg.timestamp);
                    }
                });
                return wrapper;
            }
        
            if (msg.isHidden) {
                return null;
            }
        
            if (msg.type === 'pat_message') {
                const wrapper = document.createElement('div');
                wrapper.className = 'message-wrapper system-pat'; 
                const bubble = document.createElement('div');
                bubble.className = 'message-bubble system-bubble'; 
                bubble.dataset.timestamp = msg.timestamp;
                bubble.textContent = msg.content;
                wrapper.appendChild(bubble);
                addLongPressListener(wrapper, () => showMessageActions(msg.timestamp));
                wrapper.addEventListener('click', () => { if (runtime.isSelectionMode) toggleMessageSelection(msg.timestamp); });
                return wrapper;
            }
        
            
            const isUser = msg.role === 'user';
            const myNickname = chat.settings.myNickname || '我';
            const wrapper = document.createElement('div');
            wrapper.className = `message-wrapper ${isUser ? 'user' : 'ai'}`;
        
            if (chat.isGroup && !isUser) {
                const member = chat.members.find(m => m.originalName === msg.senderName);
                const senderNameDiv = document.createElement('div');
                senderNameDiv.className = 'sender-name';
                senderNameDiv.textContent = member ? member.groupNickname : (msg.senderName || 'Unknown member');
                wrapper.appendChild(senderNameDiv);
            }
        
            const bubble = document.createElement('div');
            bubble.className = `message-bubble ${isUser ? 'user' : 'ai'}`;
            bubble.dataset.timestamp = msg.timestamp;
        
            const timestampEl = document.createElement('span');
            timestampEl.className = 'timestamp';
            timestampEl.textContent = formatTimestamp(msg.timestamp);
        
            let avatarSrc, avatarFrameSrc = '', rotatingCharacter;
            if (isUser) {
                avatarSrc = chat.settings.myAvatar || (chat.isGroup ? runtime.defaultMyGroupAvatar : runtime.defaultAvatar);
                avatarFrameSrc = chat.settings.myAvatarFrame || '';
            } else {
                if (chat.isGroup) {
                    const member = chat.members.find(m => m.originalName === msg.senderName);
                    if (member) {
                        const characterProfile = runtime.state.chats[member.id];
                        rotatingCharacter = characterProfile?.settings.avatarGallery?.mode !== 'off' && characterProfile?.settings.avatarGallery
                            ? characterProfile : undefined;
                        avatarSrc = rotatingCharacter ? characterAvatar(rotatingCharacter) :
                            member.avatar || (characterProfile ? characterProfile.settings.aiAvatar : runtime.defaultGroupMemberAvatar);
                        avatarFrameSrc = member.avatarFrame || (characterProfile ? characterProfile.settings.aiAvatarFrame : '');
                    } else {
                        avatarSrc = runtime.defaultGroupMemberAvatar;
                        avatarFrameSrc = '';
                    }
                } else {
                    rotatingCharacter = chat;
                    avatarSrc = characterAvatar(chat);
                    avatarFrameSrc = chat.settings.aiAvatarFrame || '';
                }
            }
        
            const avatarTag = rotatingCharacter ? ` data-qq-character-avatar="${escapeHtml(String(rotatingCharacter.id))}"` : '';
            let avatarHtml;
            if (avatarFrameSrc) {
                avatarHtml = `<div class="avatar-with-frame"><img src="${escapeHtml(String(avatarSrc || runtime.defaultAvatar))}" class="avatar-img"${avatarTag}><img src="${escapeHtml(String(avatarFrameSrc))}" class="avatar-frame"></div>`;
            } else {
                avatarHtml = `<img src="${escapeHtml(String(avatarSrc || runtime.defaultAvatar))}" class="avatar"${avatarTag}>`;
            }
            const hasFrameClass = avatarFrameSrc ? 'has-frame' : '';
            const avatarGroupHtml = `<div class="avatar-group ${hasFrameClass}">${avatarHtml}</div>`;
            
            let contentHtml;
            let quoteHtml = '';
            if (msg.quote) {
                const quotedSenderDisplayName = getDisplayNameInGroup(chat, msg.quote.senderName);
                const fullQuotedContent = escapeHtml(String(msg.quote.content || '')).replace(/\n/g, '<br>');
                quoteHtml = `
                    <div class="quoted-message" data-original-timestamp="${msg.quote.timestamp}" style="cursor: pointer;">
                        <div class="quoted-sender">Replying to ${quotedSenderDisplayName}:</div>
                        <div class="quoted-content">${fullQuotedContent}</div>
                    </div>
                `;
            }
            
            
            
            
        
            let rawContent = msg.content; 

            if (msg.isOpening) {
                contentHtml = parseMarkdown(escapeHtml(String(rawContent))).replace(/\n/g, '<br>');
            } else if (typeof rawContent === 'string' && rawContent.trim().startsWith('<') && rawContent.trim().endsWith('>')) {
                contentHtml = rawContent;
                bubble.classList.add('is-raw-html'); 
            } else if (msg.type === 'offline_text' || msg.type === 'share_link' || msg.type === 'share_card' || msg.type === 'location_share' || msg.type === 'ai_image' || msg.type === 'user_photo' || msg.type === 'voice_message' || msg.type === 'transfer' || msg.type === 'waimai_request'|| msg.type === 'waimai_order'  || msg.type === 'red_packet' || msg.type === 'poll' || msg.type === 'gift' || msg.type === 'realimag' || msg.type === 'naiimag') {
                
               if (msg.type === 'offline_text') {
                    
                    const combinedText = msg.content || `${msg.dialogue || ''} ${msg.description || ''}`.trim();

                    
                    const regex = /(「.*?」|“.*?”)/g;
                    const parts = combinedText.split(regex).filter(part => part); 

                    
                    contentHtml = parts.map(part => {
                        
                        if (part.startsWith('「') || part.startsWith('“')) {
                            return `<span class="offline-dialogue">${parseMarkdown(part)}</span>`;
                        } else {
                            
                            return `<span class="offline-description">${parseMarkdown(part.trim()).replace(/\n/g, '<br>')}</span>`;
                        }
                    }).join(''); 
                }
                else if (msg.type === 'share_link' || msg.type === 'share_card') {
                    bubble.classList.add('is-link-share', 'is-card-like');
                    contentHtml = sharedCardHtml(msg);
                } else if (msg.type === 'location_share') {
                    bubble.classList.add('is-location-share', 'is-card-like');
                        let finalImageUrl;
    
    
    if (msg.imageUrl) {
        finalImageUrl = msg.imageUrl;
    } 
    
    else if (runtime.state.globalSettings.enableAiDrawing && msg.image_prompt) {
        finalImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(msg.image_prompt)}`;
    } 
    
    else {
        finalImageUrl = 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1756262526935_qdqqd_4uque3.jpeg'; 
    }
    
    const mapAreaStyle = `style="background-image: url('${finalImageUrl}');"`;
                    contentHtml = `<div class="location-share-card"><div class="card-text-area"><div class="card-text-primary">${msg.content}</div><div class="card-text-secondary">Shared Location</div></div><div class="card-map-area" ${mapAreaStyle}><div class="card-pin-icon"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 11.5C11.1716 11.5 10.5 10.8284 10.5 10C10.5 9.17157 11.1716 8.5 12 8.5C12.8284 8.5 13.5 9.17157 13.5 10C13.5 10.8284 12.8284 11.5 12 11.5Z"></path><path d="M12 2C7.92134 2 4.5 5.42134 4.5 9.5C4.5 14.5312 11.2188 21.4375 11.5938 21.8125C11.7954 22.014 12.2046 22.014 12.4062 21.8125C12.7812 21.4375 19.5 14.5312 19.5 9.5C19.5 5.42134 16.0787 2 12 2ZM12 12.5C10.6193 12.5 9.5 11.3807 9.5 10C9.5 8.61929 10.6193 7.5 12 7.5C13.3807 7.5 14.5 8.61929 14.5 10C14.5 11.3807 13.3807 12.5 12 12.5Z"></path></svg></div></div></div>`;
                } else if (msg.type === 'user_photo' || msg.type === 'ai_image') {
                    bubble.classList.add('is-ai-image', 'is-card-like');
                    const altText = msg.type === 'user_photo' ? "用户描述的照片" : "AI生成的图片";
                    
                    
                    const imageUrl = runtime.state.globalSettings.enableAiDrawing && msg.image_prompt 
                        ? `https://image.pollinations.ai/prompt/${msg.image_prompt}` 
                        : 'https://i.postimg.cc/KYr2qRCK/1.jpg'; 

                    
                    contentHtml = `<img src="${imageUrl}" class="ai-generated-image" alt="${altText}" data-description="${msg.content}">`;
                } else if (msg.type === 'naiimag') {
                    // NovelAI图片渲染（复用realimag样式）
                    bubble.classList.add('is-realimag', 'is-card-like');
                    contentHtml = `<img src="${msg.imageUrl}" class="realimag-image" alt="NovelAI图片分享" loading="lazy" onerror="this.src='https://i.postimg.cc/KYr2qRCK/1.jpg'; this.alt='图片加载失败';" title="${msg.fullPrompt || msg.prompt || 'NovelAI生成'}">`;
                } else if (msg.type === 'voice_message') {
    bubble.classList.add('is-voice-message', 'is-card-like');
    const duration = Math.max(1, Math.round((msg.content || '').length / 5));
    const durationFormatted = `0:${String(duration).padStart(2, '0')}''`;
    const waveformHTML = '<div></div><div></div><div></div><div></div><div></div>';

    if (isUser) {
        
        contentHtml = `
            <div class="voice-message-body" data-text="${encodeURIComponent(msg.content)}">
                <div class="voice-waveform">${waveformHTML}</div>
                <span class="voice-duration">${durationFormatted}</span>
            </div>
            <div class="voice-transcript"></div>
        `;
    } else {
        
        
        
        const canPlayTTS = !chat.isGroup && chat.settings.enableTts !== false;
        
        
        const voiceId = chat.settings.minimaxVoiceId || 'female-shaonv-jingpin';
        
        
        const voiceIdAttribute = canPlayTTS ? `data-voice-id="${voiceId}"` : '';

        contentHtml = `
            <div class="voice-message-body" data-text="${encodeURIComponent(msg.content)}" ${voiceIdAttribute}>
                <div class="voice-waveform">${waveformHTML}</div>
                <div class="loading-spinner"></div>
                <span class="voice-duration">${durationFormatted}</span>
            </div>
            <div class="voice-transcript"></div>
        `;
    }
}else if (msg.type === 'transfer') {
                    bubble.classList.add('is-transfer', 'is-card-like');
                     let titleText, noteText;
                    const myNickname = chat.isGroup ? (chat.settings.myNickname || '我') : '我';
                    const senderDisplayName = getDisplayNameInGroup(chat, msg.senderName);
                    const receiverDisplayName = getDisplayNameInGroup(chat, msg.receiverName || chat.name);
                    if (isUser) { 
                        if (msg.isRefund) { titleText = `退款给 ${receiverDisplayName}`; noteText = '已拒收对方转账'; } 
                        else { titleText = `转账给 ${receiverDisplayName}`; if (msg.status === 'accepted') noteText = '对方已收款'; else if (msg.status === 'declined') noteText = '对方已拒收'; else noteText = msg.note || '等待对方处理...'; }
                    } else {
                        if (msg.isRefund) { titleText = `退款来自 ${senderDisplayName}`; noteText = '转账已被拒收'; } 
                        else if (msg.receiverName === myNickname) { titleText = `转账给 ${myNickname}`; if (msg.status === 'accepted') noteText = '你已收款'; else if (msg.status === 'declined') noteText = '你已拒收'; else { bubble.style.cursor = 'pointer'; bubble.dataset.status = 'pending'; noteText = msg.note || '点击处理'; } } 
                        else { titleText = `转账: ${senderDisplayName} → ${receiverDisplayName}`; noteText = msg.note || '群聊内转账'; }
                    }
                    const heartIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="vertical-align: middle;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`;
                    contentHtml = `<div class="transfer-card"><div class="transfer-title">${heartIcon} ${titleText}</div><div class="transfer-amount">¥ ${Number(msg.amount).toFixed(2)}</div><div class="transfer-note">${noteText}</div></div>`;
                } else if (msg.type === 'waimai_request') {
                    bubble.classList.add('is-waimai-request', 'is-card-like');
                     if (msg.status === 'paid' || msg.status === 'rejected') bubble.classList.add(`status-${msg.status}`);
                    const senderDisplayName = getDisplayNameInGroup(chat, msg.senderName);
                    const requestTitle = `来自 ${senderDisplayName} 的代付请求`;
                    let actionButtonsHtml = '';
                    if (msg.status === 'pending' && !isUser) { actionButtonsHtml = `<div class="waimai-user-actions"><button class="waimai-decline-btn" data-choice="rejected">Decline</button><button class="waimai-pay-btn" data-choice="paid">Pay for Order</button></div>`; }
                    contentHtml = `<div class="waimai-card"><div class="waimai-header"><img src="https://files.catbox.moe/mq179k.png" class="icon" alt="Meituan Icon"><div class="title-group"><span class="brand">Meituan Delivery</span><span class="separator">|</span><span>Food Delivery</span></div></div><div class="waimai-catchphrase">Send a meal to someone.</div><div class="waimai-main"><div class="request-title">${requestTitle}</div><div class="payment-box"><div class="payment-label">Amount Due</div><div class="amount">¥${Number(msg.amount).toFixed(2)}</div><div class="countdown-label">Time Left<div class="countdown-timer" id="waimai-timer-${msg.timestamp}"></div></div></div><button class="waimai-details-btn">View Details</button></div>${actionButtonsHtml}</div>`;
                       setTimeout(() => {
        if (msg.status === 'pending') {
            const timerElement = document.getElementById(`waimai-timer-${msg.timestamp}`);
            if (timerElement) {
                const timerId = startWaimaiCountdown(timerElement, msg.countdownEndTime);
                
                runtime.waimaiTimers[msg.timestamp] = timerId;
            }
        }
    }, 0);
                } else if (msg.type === 'waimai_order') {
                bubble.classList.add('is-waimai-request', 'is-card-like'); 
                const senderDisplayName = getDisplayNameInGroup(chat, msg.senderName);
                
                let recipientDisplayName = '你';
                if (chat.isGroup) {
                    
                    recipientDisplayName = getDisplayNameInGroup(chat, msg.recipientName);
                }

    contentHtml = `
        <div class="waimai-card">
            <div class="waimai-header">
                <img src="https://files.catbox.moe/mq179k.png" class="icon" alt="Meituan Icon">
                <div class="title-group"><span class="brand">Meituan Delivery</span><span class="separator">|</span><span>Food Delivery</span></div>
            </div>
            <div class="waimai-main">
                <div class="request-title" style="margin-bottom: 12px;">${senderDisplayName} 已为${recipientDisplayName}下单，请慢用～</div>
                <div class="payment-box">
                    <div class="payment-label" style="font-size: 18px; font-weight: 600;">${msg.productInfo}</div>
                    <div class="amount" style="margin-top: 8px;">¥${Number(msg.amount).toFixed(2)}</div>
                </div>
                <button class="waimai-details-btn">View Order</button>
            </div>
        </div>
    `;
}else if (msg.type === 'red_packet') {
                     bubble.classList.add('is-red-packet', 'is-card-like');
                    const myOriginalName = runtime.state.qzoneSettings.nickname || '{{user}}';
                    const isFinished = msg.isFullyClaimed; const hasClaimed = msg.claimedBy && msg.claimedBy[myOriginalName];
                    let cardClass = '', claimedInfoHtml = '', typeText = '拼手气红包';
                    if (isFinished) { cardClass = 'opened'; } if (msg.packetType === 'direct') { const receiverDisplayName = getDisplayNameInGroup(chat, msg.receiverName); typeText = `专属红包: 给 ${receiverDisplayName}`; if (Object.keys(msg.claimedBy || {}).length > 0) cardClass = 'opened'; }
                    if (hasClaimed) { const myClaimedAmount = msg.claimedBy[myOriginalName] || 0; claimedInfoHtml = `<div class="rp-claimed-info">You claimed ¥${myClaimedAmount.toFixed(2)}</div>`; } 
                    else if (isFinished) { claimedInfoHtml = `<div class="rp-claimed-info">All envelopes claimed</div>`; } 
                    else if (msg.packetType === 'direct' && Object.keys(msg.claimedBy || {}).length > 0) { const receiverDisplayName = getDisplayNameInGroup(chat, msg.receiverName); claimedInfoHtml = `<div class="rp-claimed-info">Claimed by ${receiverDisplayName}</div>`; }
                    contentHtml = `<div class="red-packet-card ${cardClass}"><div class="rp-header"><img src="https://files.catbox.moe/lo9xhc.png" class="rp-icon"><span class="rp-greeting">${msg.greeting || '恭喜发财，大吉大利！'}</span></div><div class="rp-type">${typeText}</div>${claimedInfoHtml}</div>`;
                } else if (msg.type === 'poll') {
                    bubble.classList.add('is-poll', 'is-card-like');
                    const pollQuestionText = msg.question || msg.content || '(无标题投票)';
                    let totalVotes = 0; const voteCounts = {}; for (const option in msg.votes) { const count = msg.votes[option].length; voteCounts[option] = count; totalVotes += count; }
                    const myOriginalName = runtime.state.qzoneSettings.nickname || '{{user}}'; let myVote = null; for (const option in msg.votes) { if (msg.votes[option].includes(myOriginalName)) { myVote = option; break; } }
                    let optionsHtml = '<div class="poll-options-list">'; msg.options.forEach(optionText => { const count = voteCounts[optionText] || 0; const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0; const isVotedByMe = myVote === optionText; optionsHtml += `<div class="poll-option-item ${isVotedByMe ? 'voted' : ''}" data-option="${optionText}"><div class="poll-option-bar" style="width: ${percentage}%;"></div><div class="poll-option-content"><span class="poll-option-text">${optionText}</span><span class="poll-option-votes">${count} 票</span></div></div>`; }); optionsHtml += '</div>';
                    let footerHtml = msg.isClosed ? `<div class="poll-footer"><span class="poll-total-votes">${totalVotes} votes</span><button class="poll-action-btn">View Results</button></div>` : `<div class="poll-footer"><span class="poll-total-votes">${totalVotes} votes</span><button class="poll-action-btn">End Poll</button></div>`;
                    contentHtml = `<div class="poll-card ${msg.isClosed ? 'closed' : ''}" data-poll-timestamp="${msg.timestamp}"><div class="poll-question">${pollQuestionText}</div>${optionsHtml}${footerHtml}</div>`;
                } else if (msg.type === 'gift') {
                    bubble.classList.add('is-gift', 'is-card-like');
                     let headerText; const myNicknameForGift = chat.settings.myNickname || '我';
                    if (chat.isGroup) {
                        if (msg.recipients && msg.recipients.length > 0) {
                            const recipientDisplayNames = msg.recipients.map(originalName => getDisplayNameInGroup(chat, originalName));
                            if (recipientDisplayNames.length === 1) { headerText = `送给 ${recipientDisplayNames[0]} 的礼物`; } else { headerText = `送给 ${recipientDisplayNames.slice(0, 2).join('、')}等人的礼物`; }
                        } else { headerText = `送给大家的礼物`; }
                    } else {
                        if (isUser) { headerText = `送给 ${chat.name} 的礼物`; } 
                        else { const recipientDisplayName = chat.settings.myNickname || '你'; headerText = `送给 ${recipientDisplayName} 的礼物`; }
                    }
                    const previewItems = msg.items.slice(0, 3); let previewHtml = ''; previewItems.forEach(item => { previewHtml += `<div class="gift-preview-item"><img src="${item.imageUrl}" class="gift-preview-img"><span class="gift-preview-name">${item.name}</span><span class="gift-preview-quantity">x${item.quantity}</span></div>`; });
                    let moreItemsText = ''; if (msg.items.length > 3) { moreItemsText = ` 等${msg.items.length}件商品`; }
                    contentHtml = `<div class="gift-card"><div class="gift-header"><svg class="gift-header-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18a4 4 0 0 0-7.64 0H8a4 4 0 0 0-4 4v2h20V10a4 4 0 0 0-4-4zM8 4a2 2 0 1 1-2 2a2 2 0 0 1 2-2zm12 0a2 2 0 1 1-2 2a2 2 0 0 1 2-2zM4 14v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6H4z"></path></svg><span class="gift-header-text">${headerText}</span></div><div class="gift-items-preview">${previewHtml}</div><div class="gift-footer">${msg.items.length} items${moreItemsText} · View</div></div>`;
                }
            } else {
                const content = String(rawContent);
                if (Array.isArray(msg.content) && msg.content[0]?.type === 'image_url') {
                    contentHtml = `<img src="${msg.content[0].image_url.url}" class="chat-image">`;
                } else if (runtime.STICKER_REGEX.test(content)) {
                    bubble.classList.add('is-sticker', 'is-card-like');
                    contentHtml = `<img src="${content}" alt="${msg.meaning || 'Sticker'}" class="sticker-image">`;
                } else {
                    contentHtml = parseMarkdown(processMentions(content, chat)).replace(/\n/g, '<br>');
                }
            }
        
            
            bubble.innerHTML = `
                ${avatarGroupHtml}
                <div class="content">
                    ${quoteHtml}
                    ${contentHtml}
                </div>
            `;
            
            wrapper.appendChild(bubble);
            wrapper.appendChild(timestampEl);
            
            addLongPressListener(wrapper, () => showMessageActions(msg.timestamp));
            wrapper.addEventListener('click', () => { if (runtime.isSelectionMode) toggleMessageSelection(msg.timestamp); });
        
            if (!isUser) {
                const avatarGroupEl = wrapper.querySelector('.avatar-group'); 
                if (avatarGroupEl) {
                    avatarGroupEl.style.cursor = 'pointer';
                    if (!chat.isGroup) {
                        avatarGroupEl.addEventListener('click', (e) => { e.stopPropagation(); showCharacterProfileModal(chat.id); });
                    } else {
                        avatarGroupEl.addEventListener('dblclick', (e) => { e.stopPropagation(); handleUserPat(chat.id, msg.senderName); });
                    }
                }
            }
            return wrapper;
        }

export async function prependMessage(msg, chat) { 
            const messagesContainer = document.getElementById('chat-messages'); 
            const messageEl = await createMessageElement(msg, chat); 
        
            
            if (!messageEl) return;
        
            const loadMoreBtn = document.getElementById('load-more-btn'); 
            if (loadMoreBtn) { 
                messagesContainer.insertBefore(messageEl, loadMoreBtn.nextSibling); 
            } else { 
                messagesContainer.prepend(messageEl); 
            } 
        }

export async function appendMessage(msg, chat, isInitialLoad = false) {
            const messagesContainer = document.getElementById('chat-messages');
            const typingIndicator = document.getElementById('typing-indicator');

const lastMessage = chat.history.filter(m => !m.isHidden).pop();


if (lastMessage && (msg.timestamp - lastMessage.timestamp > 600000)) { 
    const timestampEl = createSystemTimestampElement(msg.timestamp);
    messagesContainer.insertBefore(timestampEl, typingIndicator);
}

            const messageEl = await createMessageElement(msg, chat);
            if (!messageEl) return;
    
    
    if (msg.role === 'assistant' && !isInitialLoad) {
        playNotificationSound();
    }
    
            if (!isInitialLoad) {
                messageEl.classList.add('animate-in');
            }
          
            messagesContainer.insertBefore(messageEl, typingIndicator);
            
            if (!isInitialLoad) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                runtime.currentRenderedCount++;
            }
        }

export async function openChat(chatId) {
            runtime.state.activeChatId = chatId;
            const chat = runtime.state.chats[chatId];
            if (!chat) return;
        
            if (chat.unreadCount > 0) {
                chat.unreadCount = 0;
                await runtime.db.chats.put(chat);
            }
            applyLyricsBarPosition(chat); 
            renderChatInterface(chatId);
            showScreen('chat-interface-screen');
            window.updateListenTogetherIconProxy(runtime.state.activeChatId);
            
            
            const isGroup = chat.isGroup || false;
            
            
            toggleCallButtons(isGroup);
            
            
            document.getElementById('show-announcement-board-btn').style.display = isGroup ? 'flex' : 'none';
            
            
            const patBtn = document.getElementById('pat-btn');
            if (patBtn) {
                patBtn.style.display = isGroup ? 'none' : 'flex';
            }
        const propelBtn = document.getElementById('propel-btn');       
            
            
            const shoppingBtn = document.getElementById('open-shopping-btn');
            const gomokuBtn = document.getElementById('gomoku-btn');

        if (shoppingBtn && gomokuBtn && propelBtn) {
            shoppingBtn.style.display = 'flex';
            gomokuBtn.style.display = isGroup ? 'none' : 'flex';


            
            propelBtn.style.display = isGroup ? 'none' : 'flex';
        }
            
updateBackButtonUnreadCount(); 
            
            if (!chat.isGroup && chat.relationship?.status === 'pending_ai_approval') {
                console.log(`检测到好友申请待处理状态，为角色 "${chat.name}" 自动触发AI响应...`);
                triggerAiResponse();
            }
            
            document.getElementById('send-poll-btn').style.display = isGroup ? 'flex' : 'none';
        }

export function setAvatarActingState(chatId, isActing) {
            const action = isActing ? 'add' : 'remove';
            const classListAction = (element) => {
                if (element) {
                    element.classList[action]('is-acting');
                }
            };
        
            
            const listAvatar = document.querySelector(`.chat-list-item[data-chat-id="${chatId}"] .avatar`);
            classListAction(listAvatar);
        
            
            const qzoneAvatars = document.querySelectorAll(`.post-avatar[data-author-id="${chatId}"]`);
            qzoneAvatars.forEach(classListAction);
        
            
            const callAvatar = document.querySelector(`.participant-avatar[data-participant-id="${chatId}"]`);
            classListAction(callAvatar);
        
            
        }
