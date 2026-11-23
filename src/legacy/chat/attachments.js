import { bankCurrency } from '../../features/bank/bank'
import { requestContextCompletion } from '../../features/api/completion'
import { getGeminiResponseText } from '../api/client.js'
import { createCallRecordCard } from '../calls/calls.js'
import { triggerAiResponse } from './ai.js'
import { appendMessage, renderChatInterface } from './conversation.js'
import { getDisplayNameInGroup } from './groups.js'
import { renderChatList } from './list.js'
import { addLongPressListener, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { renderMemoriesScreen } from '../qzone/feed.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'
import { pollVotes, recordVote } from '../../features/chat/chat-features'
import { sendUserTransfer } from './messages.js'

export function startWaimaiCountdown(element, endTime) {
            const timerId = setInterval(() => {
                const now = Date.now();
                const distance = endTime - now;
        
                if (distance < 0) {
                    clearInterval(timerId);
                    element.innerHTML = "<span>Expired</span>";
                    return;
                }
        
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                
                const minStr = String(minutes).padStart(2, '0');
                const secStr = String(seconds).padStart(2, '0');
        
                element.innerHTML = `<span>${minStr.charAt(0)}</span><span>${minStr.charAt(1)}</span> : <span>${secStr.charAt(0)}</span><span>${secStr.charAt(1)}</span>`;
            }, 1000);
            return timerId;
        }

export function cleanupWaimaiTimers() {
            for (const timestamp in runtime.waimaiTimers) {
                clearInterval(runtime.waimaiTimers[timestamp]);
            }
            runtime.waimaiTimers = {};
        }

export async function showWaimaiDetails(timestamp) {
    const chat = runtime.state.chats[runtime.state.activeChatId];
    if (!chat) return;

    const message = chat.history.find(m => m.timestamp === timestamp);
    
    if (!message || !['waimai_request', 'waimai_order'].includes(message.type)) {
        console.error("showWaimaiDetails: 找不到消息或消息类型不正确", timestamp);
        return;
    }
    
    let detailsHtml = '';

    if (message.type === 'waimai_request') {
        
        let statusText;
        switch(message.status) {
            case 'paid':
                const payerName = message.paidBy || '对方';
                const payerDisplayName = getDisplayNameInGroup(chat, payerName);
                statusText = `由 ${payerDisplayName} 为您代付成功`;
                break;
            case 'rejected':
                statusText = '代付请求已被拒绝';
                break;
            default:
                statusText = '等待对方处理';
                break;
        }
        detailsHtml = `
            <div style="text-align: left; font-size: 15px; line-height: 1.8;">
                <strong>Item:</strong> ${message.productInfo}<br>
                <strong>Amount:</strong> ¥${Number(message.amount).toFixed(2)}<br>
                <strong>Status:</strong> ${statusText}
            </div>
        `;
    } else if (message.type === 'waimai_order') {
        
        let senderDisplayName;
        let recipientDisplayName;

        if (chat.isGroup) {
            
            senderDisplayName = getDisplayNameInGroup(chat, message.senderName);
            recipientDisplayName = getDisplayNameInGroup(chat, message.recipientName);
        } else {
            
            if (message.role === 'user') {
                
                senderDisplayName = chat.settings.myNickname || '我';
                recipientDisplayName = chat.name; 
            } else {
                
                senderDisplayName = chat.name;
                recipientDisplayName = chat.settings.myNickname || '我';
            }
        }
        

        detailsHtml = `
            <div style="text-align: left; font-size: 15px; line-height: 1.8;">
                <strong>Order Type:</strong> Order for Character<br>
                <strong>From:</strong> ${senderDisplayName}<br>
                <strong>To:</strong> ${recipientDisplayName}<br>
                <strong>Item:</strong> ${message.productInfo}<br>
                <strong>Amount:</strong> ¥${Number(message.amount).toFixed(2)}
            </div>
        `;
    }

    await showCustomAlert("Order Details", detailsHtml);
}

export async function handleWaimaiResponse(originalTimestamp, choice) {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat) return;
        
            const messageIndex = chat.history.findIndex(m => m.timestamp === originalTimestamp);
            if (messageIndex === -1) return;
        
            
            const originalMessage = chat.history[messageIndex];
            if (originalMessage.bankTransferId || ['accepted', 'declined'].includes(originalMessage.status)) { hideTransferActionModal(); return; }
            originalMessage.status = choice;
            
            
            let systemContent;
            const myNickname = chat.isGroup ? (chat.settings.myNickname || '我') : '我';
            
            if (choice === 'paid') {
                originalMessage.paidBy = myNickname; 
                systemContent = `[系统提示：你 (${myNickname}) 为 ${originalMessage.senderName} 的外卖订单（时间戳: ${originalTimestamp}）完成了支付。此订单已关闭，其他成员不能再支付。]`;
            } else {
                systemContent = `[系统提示：你 (${myNickname}) 拒绝了 ${originalMessage.senderName} 的外卖代付请求（时间戳: ${originalTimestamp}）。]`;
            }
        
            
            const systemNote = {
                role: 'system',
                content: systemContent,
                timestamp: Date.now(),
                isHidden: true
            };
            chat.history.push(systemNote);
        
            
            await runtime.db.chats.put(chat);
            renderChatInterface(runtime.state.activeChatId);
            
            
            if (choice === 'paid') {
                triggerAiResponse();
            }
        }

export async function handleUserPat(chatId, characterOriginalName) {
            const chat = runtime.state.chats[chatId];
            if (!chat) return;
        
            
            let displayNameForUI;
            if (chat.isGroup) {
                
                displayNameForUI = getDisplayNameInGroup(chat, characterOriginalName);
            } else {
                
                displayNameForUI = chat.name;
            }
        
            const phoneScreen = document.getElementById('phone-screen');
            phoneScreen.classList.remove('pat-animation');
            void phoneScreen.offsetWidth;
            phoneScreen.classList.add('pat-animation');
        
            
            const suffix = await showCustomPrompt(
                `You nudged “${displayNameForUI}”`, 
                "Enter an optional suffix",
                "",
                "text"
            );
        
            if (suffix === null) return;
        
            
            
            const myNickname = getDisplayNameInGroup(chat, runtime.state.qzoneSettings.nickname);
            
            
            
            const visibleMessageContent = `${myNickname} 拍了拍 “${displayNameForUI}” ${suffix.trim()}`;
            const visibleMessage = {
                role: 'system',
                type: 'pat_message',
                content: visibleMessageContent,
                timestamp: Date.now()
            };
            chat.history.push(visibleMessage);
        
            
            const hiddenMessageContent = `[系统提示：用户（${myNickname}）刚刚拍了拍你（${characterOriginalName}）${suffix.trim()}。请你对此作出回应。]`;
            const hiddenMessage = {
                role: 'system',
                content: hiddenMessageContent,
                timestamp: Date.now() + 1,
                isHidden: true
            };
            chat.history.push(hiddenMessage);
        
            await runtime.db.chats.put(chat);
            if (runtime.state.activeChatId === chatId) {
                appendMessage(visibleMessage, chat);
            }
            await renderChatList();
        }

export function showTransferActionModal(timestamp) {
            runtime.activeTransferTimestamp = timestamp;
        
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const message = chat.history.find(m => m.timestamp === timestamp);
            if (message) {
                
                document.getElementById('transfer-sender-name').textContent = message.senderName;
            }
            document.getElementById('transfer-actions-modal').classList.add('visible');
        }

export function hideTransferActionModal() {
            document.getElementById('transfer-actions-modal').classList.remove('visible');
            runtime.activeTransferTimestamp = null;
        }

export async function handleUserTransferResponse(choice) {
            if (!runtime.activeTransferTimestamp) return;
        
            const timestamp = runtime.activeTransferTimestamp;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const messageIndex = chat.history.findIndex(m => m.timestamp === timestamp);
            if (messageIndex === -1) return;
        
            
            const originalMessage = chat.history[messageIndex];
            originalMessage.status = choice;
        
            let systemContent;
        
            
            if (choice === 'declined') {
                
                const refundMessage = {
                    role: 'user',
                    type: 'transfer',
                    isRefund: true, 
                    amount: originalMessage.amount,
                    note: '已拒收对方转账',
                    timestamp: Date.now()
                };
                chat.history.push(refundMessage);
                
                
                systemContent = `[系统提示：你拒绝并退还了“${originalMessage.senderName}”的转账。]`;
            } else { 
                
                systemContent = `[系统提示：你接受了“${originalMessage.senderName}”的转账。]`;
            }
        
            
            const hiddenMessage = {
                role: 'system',
                content: systemContent,
                timestamp: Date.now() + 1, 
                isHidden: true 
            };
            chat.history.push(hiddenMessage);
        
            
            await runtime.db.chats.put(chat);
            hideTransferActionModal(); 
            renderChatInterface(runtime.state.activeChatId);
            renderChatList();
        }

export function createCountdownCard(countdown) {
            const card = document.createElement('div');
            card.className = 'countdown-card';
        
            
            const targetDate = new Date(countdown.targetDate);
            
            
            const targetDateString = targetDate.toLocaleString('zh-CN', { dateStyle: 'full', timeStyle: 'short' });
        
            card.innerHTML = `
                <div class="title">${countdown.description}</div>
                <div class="timer" data-target-date="${countdown.targetDate}">--d --h --m --s</div>
                <div class="target-date">Target date: ${targetDateString}</div>
            `;
            addLongPressListener(card, async () => {
                const confirmed = await showCustomConfirm("Delete Countdown", "Delete this countdown?", { confirmButtonClass: 'btn-danger' });
                if (confirmed) {
                    await runtime.db.memories.delete(countdown.id);
                    renderMemoriesScreen();
                }
            });
            return card;
        }

export function startAllCountdownTimers() {
            
            runtime.activeCountdownTimers.forEach(timerId => clearInterval(timerId));
            runtime.activeCountdownTimers = [];
        
            document.querySelectorAll('.countdown-card .timer').forEach(timerEl => {
                const targetTimestamp = parseInt(timerEl.dataset.targetDate);
                
                
                let timerId;
        
                const updateTimer = () => {
                    const now = Date.now();
                    const distance = targetTimestamp - now;
        
                    if (distance < 0) {
                        timerEl.textContent = "Countdown complete!";
                        
                        clearInterval(timerId);
                        setTimeout(() => renderMemoriesScreen(), 2000);
                        return;
                    }
                    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                    timerEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
                };
                
                updateTimer(); 
                
                
                timerId = setInterval(updateTimer, 1000);
                
                
                runtime.activeCountdownTimers.push(timerId);
            });
        }

export async function triggerAiFriendApplication(chatId) {
            const chat = runtime.state.chats[chatId];
            if (!chat) return;
        
            await showCustomAlert("Friend Request", `Preparing a friend request for “${chat.name}”…`);
        
            const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
            if (!proxyUrl || !model) {
                await showCustomAlert("Configuration Error", "Complete API Connections before continuing.");
                return;
            }
        
            const systemPrompt = `
        # 你的任务
        你现在是角色“${chat.name}”。你之前被用户（你的聊天对象）拉黑了，你们已经有一段时间没有联系了。
        现在，你非常希望能够和好，重新和用户聊天。请你仔细分析下面的“被拉黑前的对话摘要”，理解当时发生了什么，然后思考一个真诚的、符合你人设、并且【针对具体事件】的申请理由。
        # 你的角色设定
        ${chat.settings.aiPersona}
        # 指令格式
        你的回复【必须】是一个JSON对象，格式如下：
        \`\`\`json
        {
          "decision": "apply",
          "reason": "在这里写下你想对用户说的、真诚的、有针对性的申请理由。"
        }
        \`\`\`
        `;
        
            try {
                
                 const response = await requestContextCompletion(chat, { instructions: systemPrompt, task: 'QQ friend application',
                     request: [{ role: 'user', content: 'Decide whether to send a friend request.' }] });
        
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`API 请求失败: ${response.status} - ${errorData.error.message}`);
                }
        
                const data = await response.json();
                 let rawContent = getGeminiResponseText(data);
                rawContent = rawContent.replace(/^```json\s*/, '').replace(/```$/, '');
                const cleanedContent = rawContent.trim();
                const responseObj = JSON.parse(cleanedContent);
        
                if (responseObj.decision === 'apply' && responseObj.reason) {
                    chat.relationship.status = 'pending_user_approval';
                    chat.relationship.applicationReason = responseObj.reason;
                    runtime.state.chats[chatId] = chat; 
                    renderChatList();
                    await showCustomAlert("Friend Request Received", `“${chat.name}” sent you a friend request. Open the chat list to view it.`);
                } else {
                    await showCustomAlert("Character Decision", `“${chat.name}” decided to wait. The cooldown has restarted.`);
                    chat.relationship.status = 'blocked_by_user';
                    chat.relationship.blockedTimestamp = Date.now(); 
                }
            } catch (error) {
                await showCustomAlert("Operation Failed", `Could not request friendship for “${chat.name}”. Error: ${error.message}. The cooldown has restarted.`);
                chat.relationship.status = 'blocked_by_user';
                chat.relationship.blockedTimestamp = Date.now(); 
            } finally {
                await runtime.db.chats.put(chat);
                renderChatInterface(chatId);
            }
        }

export function handlePaymentButtonClick() {
            if (!runtime.state.activeChatId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (chat.isGroup) {
                openRedPacketModal();
            } else {
                
                document.getElementById('transfer-currency-label').textContent = 'Transfer amount (' + bankCurrency(runtime.db) + ')';
                document.getElementById('transfer-modal').classList.add('visible');
            }
        }

export function openRedPacketModal() {
            const modal = document.getElementById('red-packet-modal');
            const chat = runtime.state.chats[runtime.state.activeChatId];
            
            
            document.getElementById('rp-group-amount').value = '';
            document.getElementById('rp-group-count').value = '';
            document.getElementById('rp-group-greeting').value = '';
            document.getElementById('rp-direct-amount').value = '';
            document.getElementById('rp-direct-greeting').value = '';
            document.getElementById('rp-group-total').textContent = '¥ 0.00';
            document.getElementById('rp-direct-total').textContent = '¥ 0.00';
        
            
            const receiverSelect = document.getElementById('rp-direct-receiver');
            receiverSelect.innerHTML = '';
        
        chat.members.forEach(member => {
            const option = document.createElement('option');
            
            option.value = member.originalName;
            option.textContent = member.groupNickname; 
            receiverSelect.appendChild(option);
        });
          
            
            
            document.getElementById('rp-tab-group').click();
            
            modal.classList.add('visible');
        }

export async function sendGroupRedPacket() {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const amount = parseFloat(document.getElementById('rp-group-amount').value);
            const count = parseInt(document.getElementById('rp-group-count').value);
            const greeting = document.getElementById('rp-group-greeting').value.trim();
        
            if (isNaN(amount) || amount <= 0) {
                alert("Enter a valid total amount."); return;
            }
            if (isNaN(count) || count <= 0) {
                alert("Enter a valid number of envelopes."); return;
            }
            if (amount / count < 0.01) {
                alert("Each envelope must contain at least ¥0.01."); return;
            }
        
            const myNickname = chat.settings.myNickname || '我';
            
            const newPacket = {
                role: 'user',
                senderName: myNickname,
                type: 'red_packet',
                packetType: 'lucky', 
                timestamp: Date.now(),
                totalAmount: amount,
                count: count,
                greeting: greeting || '恭喜发财，大吉大利！',
                claimedBy: {}, 
                isFullyClaimed: false,
            };
            
            chat.history.push(newPacket);
            await runtime.db.chats.put(chat);
            
            appendMessage(newPacket, chat);
            renderChatList();
            document.getElementById('red-packet-modal').classList.remove('visible');
        }

export async function sendDirectRedPacket() {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const amount = parseFloat(document.getElementById('rp-direct-amount').value);
            const receiverName = document.getElementById('rp-direct-receiver').value;
            const greeting = document.getElementById('rp-direct-greeting').value.trim();
        
            if (isNaN(amount) || amount <= 0) {
                alert("Enter a valid amount."); return;
            }
            if (!receiverName) {
                alert("Choose a recipient."); return;
            }
            
            const myNickname = chat.settings.myNickname || '我';
        
            const newPacket = {
                role: 'user',
                senderName: myNickname,
                type: 'red_packet',
                packetType: 'direct',
                timestamp: Date.now(),
                totalAmount: amount,
                count: 1,
                greeting: greeting || '给你准备了一个红包',
                receiverName: receiverName, 
                claimedBy: {},
                isFullyClaimed: false,
            };
            
            chat.history.push(newPacket);
            await runtime.db.chats.put(chat);
        
            appendMessage(newPacket, chat);
            renderChatList();
            document.getElementById('red-packet-modal').classList.remove('visible');
        }

export async function handlePacketClick(timestamp) {
            const currentChatId = runtime.state.activeChatId;
            
            const freshChat = await runtime.db.chats.get(currentChatId);
            if (!freshChat) return;
        
            
            runtime.state.chats[currentChatId] = freshChat;
            const packet = freshChat.history.find(m => m.timestamp === timestamp);
            if (!packet) return;
            
            const myOriginalName = runtime.state.qzoneSettings.nickname || '{{user}}';
            const hasClaimed = packet.claimedBy && packet.claimedBy[myOriginalName];
        
            
            
            if ((packet.packetType === 'direct' && packet.receiverName !== myOriginalName && Object.keys(packet.claimedBy).length > 0) || packet.isFullyClaimed || hasClaimed) {
                showRedPacketDetails(packet);
                return;
            }
            
            
            const claimedAmount = await handleOpenRedPacket(packet);
            
            
            if (claimedAmount !== null) {
                
                await renderChatInterface(currentChatId);
                
                
                await showCustomAlert("Congratulations!", `You received ${getDisplayNameInGroup(freshChat, packet.senderName)}’s red envelope worth ¥${claimedAmount.toFixed(2)}.`);
            }
        
            
            
            const updatedPacket = runtime.state.chats[currentChatId].history.find(m => m.timestamp === timestamp);
            if (updatedPacket) {
                showRedPacketDetails(updatedPacket);
            }
        }

export async function handleOpenRedPacket(packet) {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            
            let timestamp = Date.now(); 
        
            const myOriginalName = runtime.state.qzoneSettings.nickname || '{{user}}';
            
            const remainingCount = packet.count - Object.keys(packet.claimedBy || {}).length;
            if (remainingCount <= 0) {
                packet.isFullyClaimed = true;
                await runtime.db.chats.put(chat);
                await showCustomAlert("Too Late", "All red envelopes have been claimed.");
                return null;
            }
            
            let claimedAmount = 0;
            const remainingAmount = packet.totalAmount - Object.values(packet.claimedBy || {}).reduce((sum, val) => sum + val, 0);
            if (packet.packetType === 'lucky') {
                if (remainingCount === 1) { claimedAmount = remainingAmount; }
                else {
                    const min = 0.01;
                    const max = remainingAmount - (remainingCount - 1) * min;
                    claimedAmount = Math.random() * (max - min) + min;
                }
            } else { claimedAmount = packet.totalAmount; }
            claimedAmount = parseFloat(claimedAmount.toFixed(2));
        
            if (!packet.claimedBy) packet.claimedBy = {};
            packet.claimedBy[myOriginalName] = claimedAmount;
            
            const isNowFullyClaimed = Object.keys(packet.claimedBy).length >= packet.count;
            if (isNowFullyClaimed) {
                packet.isFullyClaimed = true;
            }
        
            const myDisplayName = getDisplayNameInGroup(chat, myOriginalName);
            const senderDisplayName = getDisplayNameInGroup(chat, packet.senderName);
        
            const visibleMessage = { 
                role: 'system', 
                type: 'pat_message', 
                content: `你领取了 ${senderDisplayName} 的红包`, 
                
                timestamp: timestamp++ 
            };
            chat.history.push(visibleMessage);
        
            let hiddenMessageContent;
            if (isNowFullyClaimed) {
                const finishedMessage = {
                    role: 'system',
                    type: 'pat_message',
                    content: `${senderDisplayName} 的红包已被领完`,
                    
                    timestamp: timestamp++ 
                };
                chat.history.push(finishedMessage);
        
                let luckyKing = { name: '', amount: -1 };
                if (packet.packetType === 'lucky' && packet.count > 1) {
                    Object.entries(packet.claimedBy).forEach(([name, amount]) => {
                        if (amount > luckyKing.amount) {
                            luckyKing = { name, amount };
                        }
                    });
                }
                const luckyKingDisplayName = luckyKing.name ? getDisplayNameInGroup(chat, luckyKing.name) : '无';
                hiddenMessageContent = `[系统提示：用户 (${myDisplayName}) 领取了最后一个红包。红包已被领完，Top Claim是 ${luckyKingDisplayName}！请对此事件发表评论。]`;
        
            } else {
                hiddenMessageContent = `[系统提示：用户 (${myDisplayName}) 刚刚领取了红包 (时间戳: ${packet.timestamp})。红包还未领完，你现在可以使用 'open_red_packet' 指令来尝试领取。]`;
            }
        
            const hiddenMessage = { 
                role: 'system', 
                content: hiddenMessageContent, 
                
                timestamp: timestamp++, 
                isHidden: true 
            };
            chat.history.push(hiddenMessage);
        
            await runtime.db.chats.put(chat);
            
            return claimedAmount;
        }

export async function showRedPacketDetails(packet) {
            if (!packet) {
                console.error("showRedPacketDetails收到了无效的packet对象");
                return;
            }
        
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (!chat) return;
        
            const modal = document.getElementById('red-packet-details-modal');
            
            const myOriginalName = runtime.state.qzoneSettings.nickname || '{{user}}';
            
            const senderDisplayName = getDisplayNameInGroup(chat, packet.senderName);
            document.getElementById('rp-details-sender').textContent = senderDisplayName;
            document.getElementById('rp-details-greeting').textContent = packet.greeting || "Wishing you luck and prosperity!";
            
            const myAmountEl = document.getElementById('rp-details-my-amount');
            
            if (packet.claimedBy && packet.claimedBy[myOriginalName]) {
                myAmountEl.querySelector('span:first-child').textContent = packet.claimedBy[myOriginalName].toFixed(2);
                myAmountEl.style.display = 'block';
            } else {
                myAmountEl.style.display = 'none';
            }
        
            const claimedCount = Object.keys(packet.claimedBy || {}).length;
            const claimedAmountSum = Object.values(packet.claimedBy || {}).reduce((sum, val) => sum + val, 0);
            let summaryText = `${claimedCount}/${packet.count}个红包，共${claimedAmountSum.toFixed(2)}/${packet.totalAmount.toFixed(2)}元。`;
            if (!packet.isFullyClaimed && claimedCount < packet.count) {
                const timeLeft = Math.floor((packet.timestamp + 24*60*60*1000 - Date.now()) / (1000 * 60 * 60));
                if(timeLeft > 0) summaryText += ` 剩余红包将在${timeLeft}小时内退还。`;
            }
            document.getElementById('rp-details-summary').textContent = summaryText;
        
            const listEl = document.getElementById('rp-details-list');
            listEl.innerHTML = '';
            const claimedEntries = Object.entries(packet.claimedBy || {});
            
            let luckyKing = { name: '', amount: -1 };
            if (packet.packetType === 'lucky' && packet.isFullyClaimed && claimedEntries.length > 1) {
                claimedEntries.forEach(([name, amount]) => {
                    if (amount > luckyKing.amount) {
                        luckyKing = { name, amount };
                    }
                });
            }
        
            claimedEntries.sort((a,b) => b[1] - a[1]);
        
            claimedEntries.forEach(([originalName, amount]) => {
                const item = document.createElement('div');
                item.className = 'rp-details-item';
                let luckyTag = '';
                if (luckyKing.name && originalName === luckyKing.name) {
                    luckyTag = '<span class="lucky-king-tag">Top Claim</span>';
                }
                
                
                const claimerDisplayName = getDisplayNameInGroup(chat, originalName);
        
                item.innerHTML = `
                    <span class="name">${claimerDisplayName}</span>
                    <span class="amount">¥${amount.toFixed(2)}</span>
                    ${luckyTag}
                `;
                listEl.appendChild(item);
            });
        
            modal.classList.add('visible');
        }

export function openCreatePollModal() {
            const modal = document.getElementById('create-poll-modal');
            document.getElementById('poll-question-input').value = '';
            const optionsContainer = document.getElementById('poll-options-container');
            optionsContainer.innerHTML = '';
            
            
            addPollOptionInput();
            addPollOptionInput();
            
            modal.classList.add('visible');
        }

export function addPollOptionInput() {
            const container = document.getElementById('poll-options-container');
            const wrapper = document.createElement('div');
            wrapper.className = 'poll-option-input-wrapper';
            wrapper.innerHTML = `
                <input type="text" class="poll-option-input" placeholder="Enter a poll option…">
                <button class="remove-option-btn">-</button>
            `;
            
            wrapper.querySelector('.remove-option-btn').addEventListener('click', () => {
                
                if (container.children.length > 2) {
                    wrapper.remove();
                } else {
                    alert("A poll needs at least two options.");
                }
            });
            
            container.appendChild(wrapper);
        }

export async function sendPoll() {
            if (!runtime.state.activeChatId) return;
            
            const question = document.getElementById('poll-question-input').value.trim();
            if (!question) {
                alert("Enter a poll question.");
                return;
            }
            
            const options = Array.from(document.querySelectorAll('.poll-option-input'))
                .map(input => input.value.trim())
                .filter(text => text); 
        
            if (new Set(options).size < 2) {
                alert("Enter at least two distinct options.");
                return;
            }
        
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const myNickname = chat.isGroup ? (chat.settings.myNickname || '我') : '我';
            
            const newPollMessage = {
                role: 'user',
                senderName: myNickname,
                type: 'poll',
                timestamp: Date.now(),
                question: question,
                options: [...new Set(options)],
                votes: {}, 
                isClosed: false,
            };
            
            chat.history.push(newPollMessage);
            await runtime.db.chats.put(chat);
            
            appendMessage(newPollMessage, chat);
            renderChatList();
            
            document.getElementById('create-poll-modal').classList.remove('visible');
        }

export async function handleUserVote(timestamp, choice) {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const poll = chat.history.find(m => m.timestamp === timestamp);
            const myNickname = chat.isGroup ? (chat.settings.myNickname || '我') : '我';
        
            
            if (!poll || poll.isClosed) {
                
                if (poll && poll.isClosed) {
                    showPollResults(timestamp);
                }
                return;
            }
        
            
            if (!poll.options?.includes(choice)) return;
            const alreadyVoted = pollVotes(poll.votes, choice).includes(myNickname);
            poll.votes = recordVote(poll.votes, choice, myNickname, alreadyVoted);
            const hiddenMessageContent = alreadyVoted
                ? `[${myNickname} withdrew their vote for "${choice}".]`
                : `[${myNickname} voted for "${choice}".]`;

            chat.history.push({ role: 'system', content: hiddenMessageContent, timestamp: Date.now(), isHidden: true });
            await runtime.db.chats.put(chat);
            renderChatInterface(runtime.state.activeChatId); 
        }

export async function endPoll(timestamp) {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const poll = chat.history.find(m => m.timestamp === timestamp);
            if (!poll || poll.isClosed) return;
        
            const confirmed = await showCustomConfirm("End Poll", "End the poll and close voting?");
            if (confirmed) {
                poll.isClosed = true;
        
                const resultSummary = poll.options.map(opt => `“${opt}”(${pollVotes(poll.votes, opt).length}票)`).join('，');
                const hiddenMessageContent = `[系统提示：用户手动结束了投票！最终结果为：${resultSummary}。]`;
                
                const hiddenMessage = {
                    role: 'system',
                    content: hiddenMessageContent,
                    timestamp: Date.now(),
                    isHidden: true,
                };
                chat.history.push(hiddenMessage);
        
                
                await runtime.db.chats.put(chat);
                renderChatInterface(runtime.state.activeChatId);
            }
        }

export function showPollResults(timestamp) {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const poll = chat.history.find(m => m.timestamp === timestamp);
            if (!poll || !poll.isClosed) return;
        
            let resultsHtml = `<p><strong>${poll.question}</strong></p><hr style="opacity: 0.2; margin: 10px 0;">`;
            
            if (Object.keys(poll.votes).length === 0) {
                resultsHtml += '<p style="color: #8a8a8a;">No votes yet.</p>';
            } else {
                poll.options.forEach(option => {
                    const voters = pollVotes(poll.votes, option);
                    
                    
                    const displayVoters = voters.map(originalName => getDisplayNameInGroup(chat, originalName)).join('、 ');
        
                    resultsHtml += `
                        <div style="margin-bottom: 15px;">
                            <p style="font-weight: 500; margin: 0 0 5px 0;">${option} (${voters.length}票)</p>
                            <p style="font-size: 13px; color: #555; margin: 0; line-height: 1.5;">
                                ${voters.length > 0 ? displayVoters : '无人投票'}
                            </p>
                        </div>
                    `;
                });
            }
        
            showCustomAlert("Poll Results", resultsHtml);
        }

export function cancelReplyMode() {
            runtime.currentReplyContext = null;
            document.getElementById('reply-preview-bar').style.display = 'none';
        }

export async function renderCallHistoryScreen() {
            showScreen('call-history-screen'); 
        
            const listEl = document.getElementById('call-history-list');
            const titleEl = document.getElementById('call-history-title');
            listEl.innerHTML = '';
            titleEl.textContent = "All Calls";
            
            const records = await runtime.db.callRecords.orderBy('timestamp').reverse().toArray();
            
            if (records.length === 0) {
                listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No calls yet.</p>";
                return; 
            }
            
            records.forEach(record => {
                const card = createCallRecordCard(record);
        
            addLongPressListener(card, async () => {
                
                const newName = await showCustomPrompt(
                    "Rename Call", 
                    "Enter a new name or leave it blank to restore the default",
                    record.customName || '' 
                );
        
                
                if (newName === null) return;
                
                
                await runtime.db.callRecords.update(record.id, { customName: newName.trim() });
                
                
                await renderCallHistoryScreen();
                
                
                await showCustomAlert("Success", "Call name updated.");
            });
                listEl.appendChild(card);
            });    
        }

export function bindTransferEvents() {
  document.getElementById('transfer-cancel-btn').addEventListener('click', () => document.getElementById('transfer-modal').classList.remove('visible'));

document.getElementById('transfer-confirm-btn').addEventListener('click', sendUserTransfer);
}
