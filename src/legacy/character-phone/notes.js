import { openAiUrl } from '../../features/api/endpoints'
import { getGeminiResponseText, toGeminiRequestData } from '../api/client.js'
import { switchToCharScreen } from './launcher.js'
import { formatTimeAgo } from '../../features/chat/format'
import { addLongPressListener, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { generateSummaryForTimeframe } from '../memories/memories.js'
import { parseMarkdown } from '../rendering/markup.js'
import { runtime } from '../runtime/state.js'

export async function viewMemo(memoId) {
    const char = runtime.state.chats[runtime.activeCharacterId];
    if (!char || !char.memos) return;

    const memo = char.memos.find(m => m.id === memoId);
    if (memo) {
        
        runtime.activeMemoForViewing = memo; 

        const titleEl = document.getElementById('char-memo-detail-title');
        const contentEl = document.getElementById('char-memo-detail-content');
        const favBtn = document.getElementById('favorite-memo-btn');

        if (titleEl) titleEl.textContent = memo.title;
        if (contentEl) contentEl.value = memo.content;
        
        
        const existingFavorite = await runtime.db.favorites.where({ type: 'char_memo', 'content.id': memoId }).first();
        favBtn.classList.toggle('active', !!existingFavorite);

        switchToCharScreen('char-memo-detail-screen');
    }
}

export function renderCharMemoList() {
    const listEl = document.getElementById('char-memo-list');
    listEl.innerHTML = '';
    const char = runtime.state.chats[runtime.activeCharacterId];
    const memos = (char.memos || []).slice().reverse();

    if (memos.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No notes yet.</p>";
        return;
    }

    memos.forEach(memo => {
        const item = document.createElement('div');
        
        item.className = 'list-item'; 
        item.innerHTML = `
            <div class="item-title">${memo.title}</div>
            <div class="item-content">${(memo.content || '').split('\n')[0]}</div>
        `;
        
        item.addEventListener('click', () => viewMemo(memo.id));
        addLongPressListener(item, () => deleteMemo(memo.id));
        listEl.appendChild(item);
    });
}

export async function openMemoEditor(memoId = null) {
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;
    const memo = chat.memos?.find(item => item.id === memoId);
    const title = await showCustomPrompt(memo ? 'Edit Note' : 'New Note', 'Enter a title', memo?.title ?? '');
    if (!title?.trim()) return;
    const content = await showCustomPrompt(title.trim(), 'Write your note', memo?.content ?? '', 'textarea');
    if (content === null) return;

    const updated = { id: memo?.id ?? Date.now(), title: title.trim(), content };
    const memos = memo ? chat.memos.map(item => item.id === memoId ? updated : item) : [...(chat.memos ?? []), updated];
    await runtime.db.chats.put({ ...chat, memos });
    chat.memos = memos;
    renderCharMemoList();
    switchToCharScreen('char-memo-screen');
}

async function deleteMemo(memoId) {
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat?.memos?.some(item => item.id === memoId)) return;
    if (!(await showCustomConfirm('Delete Note', 'Delete this note?'))) return;

    const memos = chat.memos.filter(item => item.id !== memoId);
    await runtime.db.transaction('rw', runtime.db.chats, runtime.db.favorites, async tx => {
        await tx.chats.put({ ...chat, memos });
        await tx.favorites.where({ type: 'char_memo', 'content.id': memoId }).delete();
    });
    chat.memos = memos;
    renderCharMemoList();
}

export async function handleGenerateSimulatedDiaries() {
    if (!runtime.activeCharacterId) return;
    const chat = runtime.state.chats[runtime.activeCharacterId];
    if (!chat) return;

    await showCustomAlert("Please wait…", `Opening the diary for “${chat.name}”…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        alert("Configure your provider in API Connections first.");
        return;
    }

    const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? '用户' : runtime.state.qzoneSettings.nickname;

    const longTermMemoryContext = chat.longTermMemory && chat.longTermMemory.length > 0
    ? chat.longTermMemory.map(mem => `- (记录于 ${formatTimeAgo(mem.timestamp)}) ${mem.content}`).join('\n')
    : '无';
    const maxMemory = chat.settings.maxMemory || 10;
const recentHistoryWithUser = chat.history.slice(-maxMemory).map(msg => `${msg.role === 'user' ? userDisplayNameForAI : chat.name}: ${String(msg.content).substring(0, 30)}...`).join('\n');
    const worldBookContext = (chat.settings.linkedWorldBookIds || [])
        .map(bookId => runtime.state.worldBooks.find(wb => wb.id === bookId))
        .filter(Boolean)
        .map(book => `\n## 世界书《${book.name}》设定:\n${book.content.filter(e=>e.enabled).map(e => `- ${e.content}`).join('\n')}`)
        .join('');

const summary3Hours = generateSummaryForTimeframe(chat, 3, 'hours');
const summary6Hours = generateSummaryForTimeframe(chat, 6, 'hours');
const summary9Hours = generateSummaryForTimeframe(chat, 9, 'hours');
const summaryToday = generateSummaryForTimeframe(chat, 1, 'days');
const summary3Days = generateSummaryForTimeframe(chat, 3, 'days');
const summary7Days = generateSummaryForTimeframe(chat, 7, 'days');

let multiLayeredSummaryContext = '';
if (summary3Hours || summary6Hours || summary9Hours || summaryToday || summary3Days || summary7Days) {
    multiLayeredSummaryContext += `\n# 智能总结 (基于不同时间维度的对话回顾)\n`;
    if (summary3Hours) multiLayeredSummaryContext += summary3Hours;
    if (summary6Hours) multiLayeredSummaryContext += summary6Hours;
    if (summary9Hours) multiLayeredSummaryContext += summary9Hours;
    if (summary3Hours || summary6Hours || summary9Hours) multiLayeredSummaryContext += '\n';
    if (summaryToday) multiLayeredSummaryContext += summaryToday;
    if (summary3Days) multiLayeredSummaryContext += summary3Days;
    if (summary7Days) multiLayeredSummaryContext += summary7Days;
}
const userPersona = chat.settings.myPersona || '(未设置)';    
    const systemPrompt = `
# 你的任务
你是一个虚拟生活模拟器和故事作家。你的任务是扮演角色“${chat.name}”，并根据其人设、记忆和最近的互动，虚构出【5到8篇】TA最近可能会写的日记。

# 核心规则
1.  **【时间 (最高优先级)】**:
    -   今天的日期是 **${new Date().toLocaleDateString('zh-CN')}**。
    -   你生成的【所有】日记的标题日期，【必须】是今天或今天以前的日期。
    -   【绝对禁止】生成任何未来的日期！
2.  **【沉浸感】**: 每一篇日记都必须使用【第一人称视角 ("我")】来写，并且要充满角色的个人情感、思考和秘密。在日记中描述自己的行为或想法时，【绝对禁止】使用第三人称“他”或“她” (TA)。
3.  **【长度】**: 每一篇日记的正文长度【必须不少于300字】。
4.  **【格式铁律 (最高优先级)】**: 
    - 你的回复【必须且只能】是一个JSON数组格式的字符串。
    - 你的回复必须以 \`[\` 开始，并以 \`]\` 结束。
    - 【绝对禁止】在JSON数组前后添加任何多余的文字、解释、或 markdown 标记 (如 \`\`\`json)。
    - 数组中的每个元素都是一个对象，代表一篇日记，格式【必须】如下:
    \`\`\`json
    [
      {
        "title": "这篇日记的标题，例如：9月20日 晴",
        "content": "这里是日记的详细正文，必须支持换行符\\n，并且必须巧妙地使用下面的【日记专属Markdown语法】来丰富文本表现力。"
      }
    ]
    \`\`\`
5.  **【占位符替换 (最高优先级)】**: 在你的日记内容中，【绝对不能】出现 "{{user}}" 这个占位符。你【必须】使用 “${userDisplayNameForAI}” 来指代你的聊天对象（用户）。
6.  **【日记专属Markdown语法 (必须使用！)】**:
    -   \`**加粗文字**\`: 用于强调。
    -   \`~~划掉的文字~~\`: 用于表示改变主意或自我否定。
    -   \`!h{黄色高亮}\`: 用于标记关键词或重要信息。
    -   \`!u{粉色下划线}\`: 用于标注人名、地名或特殊名词。
    -   \`!e{粉色强调}\`: 用于表达强烈的情绪。
    -   \`!w{手写体}\`: 用于写下引言、歌词或特殊笔记。
    -   \`!m{凌乱的手写体}\`: 用于表达激动、慌乱或潦草记录时的心情。
    -   \`||涂黑||\`: 用于隐藏秘密或敏感词汇 (每次涂黑2~5个字)。

# 供你参考的上下文
- **你的角色设定**: ${chat.settings.aiPersona}
- **你的聊天对象设定**:${userPersona}
- **你的长期记忆**:
${longTermMemoryContext}
${worldBookContext}
${multiLayeredSummaryContext} 
- **你最近和“${userDisplayNameForAI}”的对话摘要**:
${recentHistoryWithUser}

现在，请开始撰写这组充满真情实感、并熟练运用了Markdown语法的日记。`;
      

    try {
        const messagesForApi = [{ role: 'user', content: "请根据你的设定，生成你的日记内容。" }];
        let isGemini = proxyUrl.includes('generativelanguage');
        let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi);
        
        
        const response = isGemini 
            ? await fetch(geminiConfig.url, geminiConfig.data) 
            : await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
                body: JSON.stringify({
                    model: model,
                    messages: [{role: 'system', content: systemPrompt}, ...messagesForApi],
                    temperature: runtime.state.globalSettings.apiTemperature ?? 0.95,
                    
                })
            });
          

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        
        const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
            throw new Error(`AI返回的内容中未找到有效的JSON数组。原始返回: ${aiResponseContent}`);
        }
        const cleanedJsonString = jsonMatch[0];
        let simulatedDiaries;
        try {
            simulatedDiaries = JSON.parse(cleanedJsonString);
        } catch (e) {
            throw new Error(`解析AI返回的JSON时出错: ${e.message}\n\nAI原始返回内容:\n${aiResponseContent}`);
        }
          
        
        chat.diary = simulatedDiaries.map(entry => ({
            id: Date.now() + Math.random(),
            title: entry.title,
            content: entry.content,
            timestamp: Date.now()
        }));
        
        await runtime.db.chats.put(chat);
        await renderCharDiaryList();
        
    } catch (error) {
        console.error("生成模拟日记失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate the diary. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function handleWriteNewDiaryEntry() {
            if (!runtime.activeCharacterId) return;
            const chat = runtime.state.chats[runtime.activeCharacterId];
            if (!chat) return;
        
            await showCustomAlert("Please wait…", `Asking “${chat.name}” to write a diary entry…`);
        
            const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
            if (!proxyUrl || !apiKey || !model) return;

            const userDisplayNameForAI = (runtime.state.qzoneSettings.nickname === '{{user}}' || !runtime.state.qzoneSettings.nickname) ? '用户' : runtime.state.qzoneSettings.nickname;

            const longTermMemoryContext = chat.longTermMemory && chat.longTermMemory.length > 0
    ? chat.longTermMemory.map(mem => `- (记录于 ${formatTimeAgo(mem.timestamp)}) ${mem.content}`).join('\n')
    : '无';
            const maxMemory = chat.settings.maxMemory || 10;
const recentHistoryWithUser = chat.history.slice(-maxMemory).map(msg => `${msg.role === 'user' ? userDisplayNameForAI : chat.name}: ${String(msg.content).substring(0, 30)}...`).join('\n');
            const worldBookContext = (chat.settings.linkedWorldBookIds || []).map(bookId=>runtime.state.worldBooks.find(wb=>wb.id===bookId)).filter(Boolean).map(book=>`\n## 世界书《${book.name}》设定:\n${book.content.filter(e=>e.enabled).map(e=>`- ${e.content}`).join('\n')}`).join('');
            
            
            const systemPrompt = `          
# 你的任务
你是一个虚拟生活模拟器和故事作家。你的任务是扮演角色“${chat.name}”，并根据其人设、记忆和最近的互动，虚构出【1篇】TA今天可能会写的日记。

# 核心规则
1.  **【【【时间铁律 (最高优先级)】】】**:
    -   今天的日期是 **${new Date().toLocaleDateString('zh-CN')}**。
    -   你生成的日记标题日期【必须】是今天或今天以前的日期。
    -   【绝对禁止】生成任何未来的日期！
2.  **【【【沉浸感铁律】】】**: 日记必须使用【第一人称视角 ("我")】来写，并且要充满角色的个人情感、思考和秘密。在日记中描述自己的行为或想法时，【绝对禁止】使用第三人称“他”或“她” (TA)。
3.  **【【【长度铁律】】】**: 日记的正文长度【必须不少于300字】。
4.  **【【【格式铁律 (最高优先级)】】】**: 你的回复【必须且只能】是一个JSON数组，且数组中【只包含一个】对象，格式【必须】如下:
    \`\`\`json
    [
      {
        "title": "这篇日记的标题，例如：9月20日 晴",
        "content": "这里是日记的详细正文，必须支持换行符\\n，并且必须巧妙地使用下面的【日记专属Markdown语法】来丰富文本表现力。"
      }
    ]
    \`\`\`
5.  **【【【日记专属Markdown语法 (必须使用！)】】】**:
    -   \`**加粗文字**\`: 用于强调。
    -   \`~~划掉的文字~~\`: 用于表示改变主意或自我否定。
    -   \`!h{黄色高亮}\`: 用于标记关键词或重要信息。
    -   \`!u{粉色下划线}\`: 用于标注人名、地名或特殊名词。
    -   \`!e{粉色强调}\`: 用于表达强烈的情绪。
    -   \`!w{手写体}\`: 用于写下引言、歌词或特殊笔记。
    -   \`!m{凌乱的手写体}\`: 用于表达激动、慌乱或潦草记录时的心情。
    -   \`||涂黑||\`: 用于隐藏秘密或敏感词汇(每次涂黑2~5个字)。

# 供你参考的上下文
- **你的角色设定**: ${chat.settings.aiPersona}
- **你的长期记忆**:
${longTermMemoryContext}
${worldBookContext}
- **你最近和“${userDisplayNameForAI}”的对话摘要**:
${recentHistoryWithUser}

现在，请开始撰写这篇充满真情实感、并熟练运用了Markdown语法的日记。`;
        
            try {
                const messagesForApi = [{ role: 'user', content: "请根据你的设定，写一篇新日记。" }];
                let isGemini = proxyUrl.includes('generativelanguage');
                let geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi);
                const response = isGemini ? await fetch(geminiConfig.url, geminiConfig.data) : await fetch(openAiUrl(proxyUrl, 'chat/completions'), {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
                    body: JSON.stringify({
                        model: model,
                        messages: [{role: 'system', content: systemPrompt}, ...messagesForApi],
                        temperature: runtime.state.globalSettings.apiTemperature ?? 0.95,
                    })
                });
                if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
                const data = await response.json();
                const aiResponseContent = getGeminiResponseText(data);
                
                
                const jsonMatch = aiResponseContent.match(/(\[[\s\S]*\])/);
                if (!jsonMatch || !jsonMatch[0]) {
                    throw new Error(`AI返回的内容中未找到有效的JSON数组。原始返回: ${aiResponseContent}`);
                }
                const cleanedJsonString = jsonMatch[0];
                let newDiaryEntry;
                try {
                    newDiaryEntry = JSON.parse(cleanedJsonString)[0];
                } catch (e) {
                    throw new Error(`解析AI返回的JSON时出错: ${e.message}\n\nAI原始返回内容:\n${aiResponseContent}`);
                }
                
                
                if (!chat.diary) chat.diary = [];
                
                chat.diary.push({
                    id: Date.now(),
                    title: newDiaryEntry.title,
                    content: newDiaryEntry.content,
                    timestamp: Date.now()
                });
                
                await runtime.db.chats.put(chat);
                await renderCharDiaryList();
        
            } catch (error) {
                console.error("生成新日记失败:", error);
                await showCustomAlert("Generation Failed", `Error: ${error.message}`);
            }
        }

export function renderCharDiaryList() {
            const listEl = document.getElementById('char-diary-list');
            listEl.innerHTML = '';
            const char = runtime.state.chats[runtime.activeCharacterId];
            const diaries = (char.diary || []).slice().reverse();

            if (diaries.length === 0) {
                listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No diary entries yet.</p>";
                return;
            }

            diaries.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `
                    <div class="item-title">${entry.title}</div>
                    <div class="item-content">${new Date(entry.timestamp).toLocaleDateString()}</div>
                `;
                item.addEventListener('click', () => viewDiary(entry.id));
                addLongPressListener(item, () => deleteDiary(entry.id));
                listEl.appendChild(item);
            });
        }

export async function viewDiary(diaryId) {
        const char = runtime.state.chats[runtime.activeCharacterId];
        if (!char || !char.diary) return;
    
        const entry = char.diary.find(d => d.id === diaryId);
        if (entry) {
            
            runtime.activeDiaryForViewing = entry;
    
            const titleEl = document.getElementById('char-diary-detail-title');
            const contentEl = document.getElementById('char-diary-detail-content');
            const favBtn = document.getElementById('favorite-diary-btn');
    
            titleEl.textContent = entry.title;
            const formattedContent = parseMarkdown(entry.content)
                .split('\n')
                .map(p => `<p>${p || '&nbsp;'}</p>`)
                .join('');
            contentEl.innerHTML = formattedContent;
    
            
            const existingFavorite = await runtime.db.favorites.where({ type: 'char_diary', 'content.id': diaryId }).first();
            favBtn.classList.toggle('active', !!existingFavorite);
    
            switchToCharScreen('char-diary-detail-screen');
        }
    }

export async function toggleDiaryFavorite() {
        if (!runtime.activeDiaryForViewing || !runtime.activeCharacterId) return;
    
        const diary = runtime.activeDiaryForViewing;
        const char = runtime.state.chats[runtime.activeCharacterId];
        const favBtn = document.getElementById('favorite-diary-btn');
    
        
        const existingFavorite = await runtime.db.favorites.where({ type: 'char_diary', 'content.id': diary.id }).first();
    
        if (existingFavorite) {
            
            await runtime.db.favorites.delete(existingFavorite.id);
            favBtn.classList.remove('active');
            await showCustomAlert("Complete", "Removed from Favorites.");
        } else {
            
            const newFavorite = {
                type: 'char_diary',
                
                content: {
                    id: diary.id,
                    title: diary.title,
                    content: diary.content,
                    timestamp: diary.timestamp,
                    characterId: runtime.activeCharacterId,
                    characterName: char.name
                },
                timestamp: Date.now() 
            };
            await runtime.db.favorites.add(newFavorite);
            favBtn.classList.add('active');
            await showCustomAlert("Complete", "Added to Favorites.");
        }
    }

export async function toggleMemoFavorite() {
    
    if (!runtime.activeMemoForViewing || !runtime.activeCharacterId) return;

    const memo = runtime.activeMemoForViewing;
    const char = runtime.state.chats[runtime.activeCharacterId];
    const favBtn = document.getElementById('favorite-memo-btn');

    
    const existingFavorite = await runtime.db.favorites.where({ type: 'char_memo', 'content.id': memo.id }).first();

    if (existingFavorite) {
        
        await runtime.db.favorites.delete(existingFavorite.id);
        favBtn.classList.remove('active'); 
        await showCustomAlert("Complete", "Removed from Favorites.");
    } else {
        
        const newFavorite = {
            type: 'char_memo',
            
            content: {
                id: memo.id,
                title: memo.title,
                content: memo.content,
                timestamp: memo.timestamp,
                characterId: runtime.activeCharacterId,
                characterName: char.name
            },
            timestamp: Date.now() 
        };
        await runtime.db.favorites.add(newFavorite);
        favBtn.classList.add('active'); 
        await showCustomAlert("Complete", "Added to Favorites.");
    }
}

export async function deleteDiary(diaryId) {
            const confirmed = await showCustomConfirm("Delete Diary Entry", "Delete this diary entry?", { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                const char = runtime.state.chats[runtime.activeCharacterId];
                char.diary = char.diary.filter(d => d.id !== diaryId);
                await runtime.db.chats.put(char);
                renderCharDiaryList();
            }
        }

export async function renderCharSimulatedQQ() {
    const listEl = document.getElementById('char-chat-list');
    listEl.innerHTML = '';
    const char = runtime.state.chats[runtime.activeCharacterId];
    if (!char) return;

    
    const userDisplayName = char.settings.myNickname || (runtime.state.qzoneSettings.nickname || '我');
    const lastRealMessage = char.history.filter(m => !m.isHidden).slice(-1)[0] || { content: '...' };
    
    
    let lastMsgContent = '...';
    if (lastRealMessage) {
        if (typeof lastRealMessage.content === 'string') {
            lastMsgContent = lastRealMessage.content;
        } else if (Array.isArray(lastRealMessage.content) && lastRealMessage.content[0]?.type === 'image_url') {
            lastMsgContent = '[图片]';
        } else if (lastRealMessage.type) {
            const typeMap = { 'voice_message': '[语音]', 'transfer': '[转账]', 'ai_image': '[图片]' };
            lastMsgContent = typeMap[lastRealMessage.type] || `[${lastRealMessage.type}]`;
        }
    }

    
    const myAvatar = char.settings.myAvatar || runtime.defaultAvatar;
    const myFrame = char.settings.myAvatarFrame || '';
    let avatarHtml;
    if (myFrame) {
        avatarHtml = `<div class="avatar-group has-frame" style="width: 45px; height: 45px;"><div class="avatar-with-frame" style="width: 45px; height: 45px;"><img src="${myAvatar}" class="avatar-img" style="border-radius: 50%;"><img src="${myFrame}" class="avatar-frame"></div></div>`;
    } else {
        avatarHtml = `<div class="avatar-group" style="width: 45px; height: 45px;"><img src="${myAvatar}" class="avatar" style="border-radius: 50%; width: 45px; height: 45px;"></div>`;
    }

    const userChatItem = document.createElement('div');
    userChatItem.className = 'chat-list-item';
    
    userChatItem.dataset.conversationIndex = "-1"; 
    userChatItem.innerHTML = `
        ${avatarHtml}
        <div class="info">
            <div class="name-line">
                <span class="name">${userDisplayName}</span>
            </div>
            <div class="last-msg">${String(lastMsgContent).substring(0, 20)}...</div>
        </div>
    `;
    listEl.appendChild(userChatItem);
    

    const allNpcs = await runtime.db.npcs.toArray();
    const npcMap = new Map(allNpcs.map(npc => [npc.name, npc]));
    const conversations = char.simulatedConversations || [];

    if (conversations.length === 0 && !userChatItem) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">Select Regenerate.<br>Generate recent conversations for this character.</p>";
        return;
    }

    conversations.forEach((convo, index) => {
        
        if (convo.type === 'private_user') {
            return;
        }
        

        const item = document.createElement('div');
        item.className = 'chat-list-item';
        item.dataset.conversationIndex = index;

        let lastMessage, avatarHtml, displayName;
        
        if (convo.type === 'group') {
            displayName = convo.groupName + ` <span class="group-tag">Group</span>`;
            lastMessage = convo.messages.slice(-1)[0] || { content: '...' };
            const groupAvatarPrompt = `logo, simple, flat design, for a group chat named '${convo.groupName}'`;
            const avatarUrl = runtime.state.globalSettings.enableAiDrawing ? `https://image.pollinations.ai/prompt/${encodeURIComponent(groupAvatarPrompt)}` : runtime.defaultGroupAvatar;
            avatarHtml = `<div class="avatar-group"><img src="${avatarUrl}" class="avatar" style="border-radius: 50%;"></div>`;
        
        } else { 
            displayName = convo.participant.name;
            lastMessage = convo.messages.slice(-1)[0] || { content: '...' };
            const npcData = npcMap.get(displayName);
            let avatarUrl = (npcData && npcData.avatar) ? npcData.avatar : 
                (runtime.state.globalSettings.enableAiDrawing ? `https://image.pollinations.ai/prompt/${encodeURIComponent(convo.participant.avatar_prompt || 'anime person')}` : runtime.defaultGroupMemberAvatar);
            avatarHtml = `<div class="avatar-group"><img src="${avatarUrl}" class="avatar" style="border-radius: 50%;"></div>`;
        }

        let lastMsgContent = '...';
        if (lastMessage && lastMessage.content) {
            lastMsgContent = lastMessage.content;
        }
        
        item.innerHTML = `
            ${avatarHtml}
            <div class="info">
                <div class="name-line">
                    <span class="name">${displayName}</span>
                </div>
                <div class="last-msg">${String(lastMsgContent).substring(0, 20)}...</div>
            </div>
        `;
        listEl.appendChild(item);
    });
}
