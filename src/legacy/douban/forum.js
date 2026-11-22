import { runtime } from '../runtime/state.js'
import { openAiUrl } from '../../features/api/endpoints'
import { getGeminiResponseText, toGeminiRequestData } from '../api/client.js'
import { formatTimeAgo } from '../../features/chat/format'
import { hideCustomModal, showCustomAlert } from '../dialogs/dialogs.js'
import { showScreen } from '../../app/routes'

export async function renderDoubanScreen() {
    const listEl = document.getElementById('douban-posts-list');
    listEl.innerHTML = '';
    
    const posts = await runtime.db.doubanPosts.orderBy('timestamp').reverse().toArray();

    if (posts.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No posts yet.<br>Use Regenerate Posts to get started.</p>";
        return;
    }

    posts.forEach(post => {
        let avatarUrl;
        
   
        const authorChatByOriginalName = post.authorOriginalName 
            ? Object.values(runtime.state.chats).find(c => !c.isGroup && c.name === post.authorOriginalName) 
            : null;

        if (authorChatByOriginalName) {
        
            avatarUrl = authorChatByOriginalName.settings.aiAvatar;
        } else {
          
            const authorChatByName = Object.values(runtime.state.chats).find(c => !c.isGroup && c.name === post.authorName);
            if (authorChatByName) {
                avatarUrl = authorChatByName.settings.aiAvatar;
            } else if (post.authorAvatarPrompt) {
              
                avatarUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(post.authorAvatarPrompt)}`;
            } else {
              
                avatarUrl = runtime.defaultAvatar;
            }
        }
     

        const itemEl = document.createElement('div');
        itemEl.className = 'douban-post-item';
        itemEl.onclick = () => openDoubanPostDetail(post.id);

        itemEl.innerHTML = `
            <div class="douban-post-header">
                <img src="${avatarUrl}" class="douban-post-avatar">
                <div class="douban-author-info">
                    <div class="douban-author-name">${post.authorName}</div>
                    <div class="douban-group-name">From ${post.groupName}</div>
                </div>
            </div>
            <div class="douban-post-title">${post.postTitle}</div>
            <div class="douban-post-content">${post.content.replace(/\n/g, '<br>')}</div>
            <div class="douban-post-footer">
                 <div class="douban-post-actions">
                    <span><svg viewBox="0 0 1024 1024"><path d="M170.666667 170.666667h128v682.666666h-128zM426.666667 170.666667h170.666666v682.666666h-170.666666zM725.333333 170.666667h128v682.666666h-128z"></path></svg> ${post.likesCount}</span>
                    <span><svg viewBox="0 0 1024 1024"><path d="M853.333333 85.333333H170.666667c-46.933333 0-85.333333 38.4-85.333334 85.333334v512c0 46.933333 38.4 85.333333 85.333334 85.333333h512l170.666667 170.666667V170.666667c0-46.933333-38.4-85.333333-85.333334-85.333334z m-42.666666 554.666667H170.666667V170.666667h640v469.333333zM256 384h512v85.333333H256V384z m0-170.666667h512v85.333334H256v-85.333334z"></path></svg> ${post.commentsCount}</span>
                </div>
                <span class="douban-post-timestamp">${formatTimeAgo(post.timestamp)}</span>
            </div>
        `;
        listEl.appendChild(itemEl);
    });
}

export async function handleGenerateDoubanPosts() {
    const activeCharacterIds = runtime.state.globalSettings.doubanActiveCharacterIds || [];

    if (activeCharacterIds.length === 0) {
        await showCustomAlert("Select Characters", "Choose at least one character to participate in Douban.");
        return;
    }

    await showCustomAlert("Please wait…", `Generating Douban posts for ${activeCharacterIds.length} characters…`);

    const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
        alert("Configure your provider in API Connections first.");
        return;
    }

    const allLinkedBookIds = new Set();
    activeCharacterIds.forEach(charId => {
        const c = runtime.state.chats[charId];
        if (c && c.settings.linkedWorldBookIds) {
            c.settings.linkedWorldBookIds.forEach(bookId => allLinkedBookIds.add(bookId));
        }
    });

    let sharedWorldBookContext = '';
    if (allLinkedBookIds.size > 0) {
        sharedWorldBookContext += '\n\n# 统一世界观设定 (以下设定适用于所有参与角色)\n';
        allLinkedBookIds.forEach(bookId => {
            const book = runtime.state.worldBooks.find(wb => wb.id === bookId);
            if (book) {
                const enabledEntries = book.content
                    .filter(e => e.enabled !== false)
                    .map(e => `- ${e.content}`)
                    .join('\n');
                if (enabledEntries) {
                    sharedWorldBookContext += `\n## 来自《${book.name}》:\n${enabledEntries}`;
                }
            }
        });
    }
    
    const doubanWorldBook = runtime.state.worldBooks.find(wb => wb.name === '豆瓣设定');
    let doubanSettingContext = '';
    let npcCharacters = [];
    if (doubanWorldBook) {
        doubanWorldBook.content.forEach(entry => {
            if (entry.comment.includes('小组风格')) {
                doubanSettingContext += `\n# 豆瓣社区风格设定 (来自世界书)\n${entry.content}`;
            }
            if (entry.comment.includes('NPC人设')) {
                const lines = entry.content.split('\n');
                lines.forEach(line => {
                    const match = line.match(/- \*\*昵称\*\*:\s*(.*?)\s*\*\*人设\*\*:\s*(.*)/);
                    if (match) {
                        npcCharacters.push({ name: match[1].trim(), persona: match[2].trim() });
                    }
                });
            }
        });
    }
    
    const userNickname = runtime.state.qzoneSettings.nickname || '我';
    const userPersona = activeCharacterIds.length > 0 && runtime.state.chats[activeCharacterIds[0]] 
        ? runtime.state.chats[activeCharacterIds[0]].settings.myPersona 
        : '(未设置)';

    let charactersContext = '';
    activeCharacterIds.forEach(charId => {
        const c = runtime.state.chats[charId];
        if (c) {
            const longTermMemory = c.longTermMemory && c.longTermMemory.length > 0 ? c.longTermMemory.map(m => m.content).join('; ') : '无';
            const recentHistory = c.history.slice(-10).map(msg => 
                `${msg.role === 'user' ? userNickname : c.name}: ${String(msg.content).substring(0, 30)}...`
            ).join('\n');

            charactersContext += `
<character>
  <name>${c.name}</name>
  <persona>${c.settings.aiPersona}</persona>
  <memory>${longTermMemory}</memory>
  <recent_dialogue_with_user>${recentHistory}</recent_dialogue_with_user>
</character>
`;
        }
    });
    npcCharacters.forEach(npc => {
        charactersContext += `
<character>
  <name>${npc.name}</name>
  <persona>${npc.persona}</persona>
</character>
`;
    });
    
    const now = new Date();
    const currentTimeString = now.toLocaleString('zh-CN', { dateStyle: 'full', timeStyle: 'short' });
    const minPosts = runtime.state.globalSettings.doubanMinPosts || 12;
    const maxPosts = runtime.state.globalSettings.doubanMaxPosts || 20;
    const systemPrompt = `
# 你的任务
你是一个虚拟社区内容生成器。你的任务是根据下面提供的【统一角色列表】，虚构出【${minPosts}到${maxPosts}篇】他们最近可能会在各种豆瓣小组中发布的帖子和评论。

# 核心规则
1.  **【时间感知】**:
    -   你【必须】意识到当前是 **${currentTimeString}**。
    -   你的帖子和评论内容【必须】自然地体现出对【当前真实时间】的感知。
2.  **【禁止扮演用户 (最最最高优先级！！！)】**:
    -   用户的昵称是“${userNickname}”。
    -   你【绝对不能】生成 authorName 或 commenter 字段为 “${userNickname}” 的帖子或评论。你的任务是扮演【除了用户以外】的所有角色。
3.  **【身份 (最高优先级！)】**: 
    -   \`authorName\`: 你可以为主要角色起一个符合情景的、临时的【发帖昵称】，也可以直接使用他们的本名。
    -   \`authorOriginalName\`: 如果发帖者是【主要角色】，你【必须】在这里填上TA在角色列表里的【原始备注名】，这是程序的“身份证”。
    -   如果发帖者是【路人NPC】，则【省略】\`authorOriginalName\` 字段。
4.  **【作者平衡】**: 帖子的作者【必须】从下面的 \`<character>\` 列表中【均匀地、多样化地】选择。你【必须】确保帖子列表中【至少有 70% 的帖子是由路人NPC发布的】，以营造一个真实的社区氛围。
    - "comments": 一个包含【7到12条】评论的数组。评论者可以是路人，也可以是角色列表中的其他角色，以体现互动性。
5.  **【角色扮演】**: 帖子的作者和内容【必须】深度结合该角色的<persona>, <memory>, 和 <worldview>。
6.  **【“豆瓣味”内容风格指南】**: 帖子风格必须多样化且充满生活气息！你需要生成包括但不限于：情感树洞、生活吐槽、吃瓜八卦、兴趣分享、无用良品等各种类型的帖子。
7.  **【头像生成 (最高优先级！)】**:
    -   为每一个【首次出现】的路人NPC（无论是发帖还是评论），你都【必须】为其添加一个 \`avatar_prompt\` 字段。
    -   这个字段的内容是用于生成该NPC头像的、简洁的【英文】关键词。
    -   不同的NPC【必须】有不同的头像指令，以确保他们的头像是独一无二的。
8.  **【头像一致性 (至关重要！)】**:
    -   如果一个路人NPC在同一个帖子中多次出现（例如，既是发帖人又是评论者，或多次评论），你【必须】为TA的所有出现都使用【完全相同】的 \`avatar_prompt\`。这至关重要！
9.  **【格式 (最高优先级)】**: 
    - 你的回复【必须且只能】是一个JSON数组格式的字符串。
    - 你的回复必须以 \`[\` 开始，并以 \`]\` 结束。
    - 【绝对禁止】在JSON数组前后添加任何多余的文字、解释、或 markdown 标记 (如 \`\`\`json)。
    - 数组中的每个元素都是一篇帖子，格式【必须】如下:
    \`\`\`json
    [
      {
        "groupName": "一个生动有趣的小组名称",
        "postTitle": "一个引人-注目的帖子标题",
        "authorName": "发帖角色的【备注名】",
        "authorOriginalName": "(仅当发帖者是主要角色时【必须】提供) TA的原始备注名",
        "authorAvatarPrompt": "(仅当发帖者是路人NPC时【必须】提供) 一段用于生成该NPC头像的【英文】关键词。风格为 anime style, simple background",
        "content": "帖子的详细正文，必须支持换行符\\n。",
        "likesCount": 152,
        "commentsCount": 38,
        "comments": [
            { "commenter": "路人甲", "text": "这是一个路人评论。", "avatar_prompt": "cute cat avatar, simple, flat" },
            { "commenter": "另一个角色名", "commenterOriginalName": "(如果评论者是主要角色，必须提供其本名)", "text": "这是一个来自其他角色的互动评论。" }
        ]
      }
    ]
    \`\`\`
    - **comments**: 
        -   评论者可以是路人，也可以是角色列表中的其他角色。评论区【必须】体现出互动性。
        -   【评论身份】: 如果评论者是【主要角色】，你【必须】为其添加 \`commenterOriginalName\` 字段，并填入其本名。如果是路人NPC，则省略此字段。

# 供你参考的上下文
${doubanSettingContext}
${sharedWorldBookContext}

# 当前情景
- **当前真实时间**: ${currentTimeString}

# 【你的聊天对象（用户）的身份档案】
- **昵称**: ${userNickname}
- **人设**: ${userPersona}

# 统一角色列表 (你扮演的角色 + 路人NPC)
${charactersContext}

现在，请严格遵守所有规则，特别是【时间感知】和【禁止扮演用户】的铁律，开始生成这组生动、多样且充满“豆瓣味”的小组帖子。`;

    try {
        const messagesForApi = [{ role: 'user', content: "请根据角色列表，生成豆瓣小组帖子。" }];
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
                    temperature: runtime.state.globalSettings.apiTemperature ?? 1.0,
                })
            });

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        
        const jsonMatch = aiResponseContent.match(/\[[\s\S]*\]/);
        
        if (!jsonMatch) {
            throw new Error(`AI返回的内容中未找到有效的JSON数组。原始返回: ${aiResponseContent}`);
        }
        
        const simulatedPosts = JSON.parse(jsonMatch[0]);
        await runtime.db.doubanPosts.clear();
        await runtime.db.doubanPosts.bulkAdd(simulatedPosts.map(p => ({...p, timestamp: Date.now() - Math.random() * 100000})));
        
        await renderDoubanScreen();
        
    } catch (error) {
        console.error("生成豆瓣帖子失败:", error);
        await showCustomAlert("Generation Failed", `Could not generate content. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function openDoubanPostDetail(postId) {
    showScreen('douban-post-detail-screen');
    runtime.activeDoubanPostId = postId;
    const post = await runtime.db.doubanPosts.get(postId);
    if (!post) {
        showScreen('douban-screen');
        return;
    }

    document.getElementById('douban-post-detail-title').textContent = "Post Details";

 
    let authorAvatar = runtime.defaultAvatar;
    let authorDisplayName = post.authorName; 

    const authorChatByOriginalName = post.authorOriginalName
        ? Object.values(runtime.state.chats).find(c => !c.isGroup && c.originalName === post.authorOriginalName)
        : null;

    if (authorChatByOriginalName) {
        authorAvatar = authorChatByOriginalName.settings.aiAvatar;
    } else {
        const authorChatByName = Object.values(runtime.state.chats).find(c => !c.isGroup && c.name === post.authorName);
        if (authorChatByName) {
            authorAvatar = authorChatByName.settings.aiAvatar;
        } else if (post.authorAvatarPrompt) {
            authorAvatar = `https://image.pollinations.ai/prompt/${encodeURIComponent(post.authorAvatarPrompt)}`;
        }
    }
    
   
    document.getElementById('douban-detail-avatar').src = authorAvatar;
    document.getElementById('douban-detail-author').textContent = authorDisplayName;
    document.getElementById('douban-detail-group').textContent = `From ${post.groupName}`;
    document.getElementById('douban-detail-post-title').textContent = post.postTitle;
    document.getElementById('douban-detail-content').innerHTML = post.content.replace(/\n/g, '<br>');
    document.getElementById('douban-my-comment-avatar').src = runtime.state.qzoneSettings.avatar;
    document.getElementById('douban-comment-input').value = '';

    const commentsListEl = document.getElementById('douban-detail-comments-list');
    commentsListEl.innerHTML = '';

  
    if (post.comments && post.comments.length > 0) {
   
        const commenterAvatarMap = new Map();

        post.comments.forEach(comment => {
            let commenterAvatar = runtime.defaultAvatar; 
            const myNickname = runtime.state.qzoneSettings.nickname || '我';
            const commenterName = comment.commenter; 
       
            if (commenterAvatarMap.has(commenterName)) {
              
                commenterAvatar = commenterAvatarMap.get(commenterName);
            } else {
              
                if (commenterName === myNickname) {
                    commenterAvatar = runtime.state.qzoneSettings.avatar;
                }
                else if (commenterName === post.authorName) {
                    commenterAvatar = authorAvatar;
                }
                else {
                    const commenterChatByOriginalName = comment.commenterOriginalName
                        ? Object.values(runtime.state.chats).find(c => !c.isGroup && c.originalName === comment.commenterOriginalName)
                        : null;
                    
                    if (commenterChatByOriginalName) {
                        commenterAvatar = commenterChatByOriginalName.settings.aiAvatar;
                    } else {
                        const commenterChatByName = Object.values(runtime.state.chats).find(c => !c.isGroup && c.name === commenterName);
                        if (commenterChatByName) {
                            commenterAvatar = commenterChatByName.settings.aiAvatar;
                        } else if (comment.avatar_prompt) {
                            commenterAvatar = `https://image.pollinations.ai/prompt/${encodeURIComponent(comment.avatar_prompt)}`;
                        }
                    }
                }
         
                commenterAvatarMap.set(commenterName, commenterAvatar);
            }
       
            const commentEl = document.createElement('div');
            commentEl.className = 'douban-comment-item';
            commentEl.innerHTML = `
                <img src="${commenterAvatar}" class="douban-comment-avatar">
                <div class="douban-comment-body">
                    <div class="douban-comment-author">${commenterName}</div>
                    <div class="douban-comment-text">${comment.text.replace(/\n/g, '<br>')}</div>
                </div>
            `;
            commentsListEl.appendChild(commentEl);
        });
    } else {
        commentsListEl.innerHTML = "<p style=\"color: var(--text-secondary); font-size: 13px;\">No replies yet.</p>";
    }
 
    const contentWrapper = document.getElementById('douban-detail-content-wrapper');
    if(contentWrapper) contentWrapper.scrollTop = 0;
}

export async function handleSendDoubanComment() {
    if (!runtime.activeDoubanPostId) return;

    const input = document.getElementById('douban-comment-input');
    const commentText = input.value.trim();
    if (!commentText) return;

    const post = await runtime.db.doubanPosts.get(runtime.activeDoubanPostId);
    if (!post) return;

    if (!post.comments) {
        post.comments = [];
    }
    
    const myNickname = runtime.state.qzoneSettings.nickname || '我';
    
    post.comments.push({
        commenter: myNickname,
        text: commentText
    });
    post.commentsCount++;

    await runtime.db.doubanPosts.put(post);
    input.value = '';
    

    await openDoubanPostDetail(runtime.activeDoubanPostId);


}

export async function handleDoubanWaitReply() {
    if (!runtime.activeDoubanPostId) return;

    const postId = runtime.activeDoubanPostId;
    const post = await runtime.db.doubanPosts.get(postId);
    if (!post) return;

    const lastComment = post.comments && post.comments.slice(-1)[0];
    if (!lastComment) {
        alert("Add a comment before generating replies.");
        return;
    }

    await showCustomAlert("Please wait…", "Asking the characters to join the discussion…");

    try {
        const { proxyUrl, apiKey, model } = runtime.state.apiConfig;
        if (!proxyUrl || !apiKey || !model) {
            throw new Error('API未配置，无法生成内容。');
        }

        const userNickname = runtime.state.qzoneSettings.nickname || '我';
        const userPersona = runtime.state.chats[Object.keys(runtime.state.chats)[0]]?.settings.myPersona || '(未设置)';
        
        const existingNpcs = new Map();
        if (post.comments) {
            post.comments.forEach(comment => {
                const isMainCharacter = (runtime.state.globalSettings.doubanActiveCharacterIds || []).some(id => runtime.state.chats[id]?.name === comment.commenter);
                if (!isMainCharacter && comment.avatar_prompt) {
                    existingNpcs.set(comment.commenter, comment.avatar_prompt);
                }
            });
        }
        
        let existingNpcContext = "# 已有路人NPC头像指令 (必须遵守！)\n";
        if (existingNpcs.size > 0) {
            existingNpcContext += "如果以下任何一位NPC再次评论，你【必须】使用我们提供的、完全相同的`avatar_prompt`，以保持头像一致性。\n";
            existingNpcs.forEach((prompt, name) => {
                existingNpcContext += `- **${name}**: "${prompt}"\n`;
            });
        } else {
            existingNpcContext += "（当前帖子还没有路人NPC发表评论。）\n";
        }

        const doubanWorldBook = runtime.state.worldBooks.find(wb => wb.name === '豆瓣设定');
        let npcCharacters = [];
        if (doubanWorldBook) {
            doubanWorldBook.content.forEach(entry => {
                if (entry.comment.includes('NPC人设')) {
                    const lines = entry.content.split('\n');
                    lines.forEach(line => {
                        const match = line.match(/- \*\*昵称\*\*:\s*(.*?)\s*\*\*人设\*\*:\s*(.*)/);
                        if (match) {
                            npcCharacters.push({ name: match[1].trim(), persona: match[2].trim() });
                        }
                    });
                }
            });
        }
        
        let charactersContext = '';
        const activeCharacterIds = runtime.state.globalSettings.doubanActiveCharacterIds || [];
        activeCharacterIds.forEach(charId => {
            const c = runtime.state.chats[charId];
            if (c) {
                const longTermMemory = c.longTermMemory && c.longTermMemory.length > 0 ? c.longTermMemory.map(m => m.content).join('; ') : '无';
                const recentHistory = c.history.slice(-10).map(msg => `${msg.role === 'user' ? userNickname : c.name}: ${String(msg.content).substring(0, 30)}...`).join('\n');
                charactersContext += `\n- ${c.name}: ${c.settings.aiPersona.substring(0,50)}... [记忆: ${longTermMemory}] [最近对话: ${recentHistory}]`;
            }
        });
        npcCharacters.forEach(npc => {
            charactersContext += `\n- ${npc.name}: ${npc.persona}`;
        });

       
        const now = new Date();
        const currentTimeString = now.toLocaleString('zh-CN', { dateStyle: 'full', timeStyle: 'short' });

     
        const systemPrompt = `
# 你的任务
你是一个虚拟社区的AI导演。下面的“帖子摘要”和“已有评论”来自于一个豆瓣小组的帖子。用户“${userNickname}”刚刚对最后一条评论点击了“等待回复”，TA希望看到更多角色参与讨论。
你的任务是：根据所有角色的设定，选择【10到20位】最适合参与讨论的角色，让他们针对已有评论，发表【全新的、符合人设的】回应。

# 核心规则
1.  **【时间感知】**:
    -   你【必须】意识到当前是 **${currentTimeString}**。
    -   你的评论内容【必须】自然地体现出对【当前真实时间】的感知。
2.  **【禁止扮演用户 (最最最高优先级！！！)】**:
    -   用户的昵称是“${userNickname}”。
    -   你【绝对不能】生成 commenter 字段为 “${userNickname}” 的评论。你的任务是扮演【除了用户以外】的所有角色。
3.  **【互动】**: 新生成的评论【必须】是针对【已有评论】的延续或回应，让讨论能继续下去。
4.  **【头像一致性 (最高优先级！)】**: 你【必须】参考下面的“已有路人NPC头像指令”列表。如果一个已有的NPC再次发言，【必须】复用它旧的头像指令。只有在创造一个【全新的、从未出现过的】NPC时，才为其生成新的头像指令。
5.  **【格式】**: 你的回复【必须且只能】是一个JSON数组，数组中的每个元素都代表一条新评论，格式【必须】如下:
    \`\`\`json
    [
      { "commenter": "角色A的名字", "text": "角色A的新评论内容。", "avatar_prompt": "(可选)如果评论者是【全新的】NPC,提供头像指令" },
      { "commenter": "角色B的名字", "text": "角色B对角色A或楼主的看法。" }
    ]
    \`\`\`

# 上下文
- **帖子标题**: 《${post.postTitle}》
- **发帖人**: ${post.authorName}
- **帖子内容摘要**: ${post.content.substring(0, 100)}...
- **已有评论**:
${post.comments.map(c => `- ${c.commenter}: ${c.text}`).join('\n')}

${existingNpcContext}

# 当前情景
- **当前真实时间**: ${currentTimeString}

# 【你的聊天对象（用户）的人设】
- **昵称**: ${userNickname}
- **人设**: ${userPersona}

# 你的角色库 (你可以从中选择【任何角色】进行评论，并参考他们的记忆和对话)
${charactersContext}

现在，请生成新的评论。`;

        const messagesForApi = [{ role: 'user', content: "请根据以上情景，生成新的评论。" }];
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
                    temperature: runtime.state.globalSettings.apiTemperature ?? 1.0,
                })
            });

        if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
        
        const data = await response.json();
        const aiResponseContent = getGeminiResponseText(data);
        const cleanedJson = aiResponseContent.replace(/^```json\s*/, '').replace(/```$/, '');
        const newComments = JSON.parse(cleanedJson);

        if (Array.isArray(newComments) && newComments.length > 0) {
            post.comments.push(...newComments);
            post.commentsCount += newComments.length;
            await runtime.db.doubanPosts.put(post);
        }

        await openDoubanPostDetail(postId);
        
        hideCustomModal();

    } catch (error) {
        console.error("等待回复失败:", error);
        await showCustomAlert("Operation Failed", `Could not generate a reply. Check API Connections or retry. Error: ${error.message}`);
    }
}

export async function openDoubanCastSelector() {
    const modal = document.getElementById('douban-cast-modal');
    const listEl = document.getElementById('douban-cast-list');
    listEl.innerHTML = '';

    const allCharacters = Object.values(runtime.state.chats).filter(c => !c.isGroup);
    // 从全局设置中读取已保存的选择
    const activeIds = new Set(runtime.state.globalSettings.doubanActiveCharacterIds || []);

    if (allCharacters.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color:#8a8a8a; padding: 50px 0;\">No characters available.</p>";
    } else {
        allCharacters.forEach(char => {
            const item = document.createElement('div');
            item.className = 'contact-picker-item'; // 复用联系人选择器的样式
            item.innerHTML = `
                <input type="checkbox" class="douban-cast-checkbox" data-chat-id="${char.id}" ${activeIds.has(char.id) ? 'checked' : ''} style="margin-right: 15px;">
                <img src="${char.settings.aiAvatar || runtime.defaultAvatar}" class="avatar">
                <span class="name">${char.name}</span>
            `;
            listEl.appendChild(item);
        });
    }
    modal.classList.add('visible');
}

export function openDoubanSettingsModal() {
    const modal = document.getElementById('douban-settings-modal');
    
    
    document.getElementById('douban-min-posts-input').value = runtime.state.globalSettings.doubanMinPosts || 12;
    document.getElementById('douban-max-posts-input').value = runtime.state.globalSettings.doubanMaxPosts || 20;
    
    modal.classList.add('visible');
}

export async function saveDoubanSettings() {
    const minInput = document.getElementById('douban-min-posts-input');
    const maxInput = document.getElementById('douban-max-posts-input');
    
    const min = parseInt(minInput.value);
    const max = parseInt(maxInput.value);

    
    if (isNaN(min) || isNaN(max) || min < 1 || max < 1) {
        alert("Enter a positive whole number.");
        return;
    }
    if (min > max) {
        alert("The minimum must be less than or equal to the maximum.");
        return;
    }

    
    runtime.state.globalSettings.doubanMinPosts = min;
    runtime.state.globalSettings.doubanMaxPosts = max;
    await runtime.db.globalSettings.put(runtime.state.globalSettings);

    
    document.getElementById('douban-settings-modal').classList.remove('visible');
    await showCustomAlert("Saved", "Douban settings saved for the next generation.");
}

export async function saveDoubanCastSelection() {
    const selectedCheckboxes = document.querySelectorAll('#douban-cast-list .douban-cast-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.chatId);

 
    runtime.state.globalSettings.doubanActiveCharacterIds = selectedIds;
    await runtime.db.globalSettings.put(runtime.state.globalSettings);

    document.getElementById('douban-cast-modal').classList.remove('visible');
    
    
    await handleGenerateDoubanPosts();
}
