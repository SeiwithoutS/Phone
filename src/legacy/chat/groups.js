import { populateFrameGrids } from '../avatars/frames.js'
import { createMessageElement, openChat } from './conversation.js'
import { renderChatList } from './list.js'
import { showChoiceModal, showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { openNpcEditor } from '../npc/npcs.js'
import { showScreen } from '../../app/routes'
import { controls } from '../runtime/state.js'
import { runtime } from '../runtime/state.js'

export async function syncCharacterNameInGroups(characterChat) {
            
            if (!characterChat || characterChat.isGroup) {
                console.warn("syncCharacterNameInGroups: 传入的不是有效的单聊对象，已跳过同步。");
                return;
            }
        
            const characterId = characterChat.id;
            const newRemarkName = characterChat.name;        
            const newOriginalName = characterChat.originalName;  
        
            console.log(`正在为角色 ${characterId} 同步所有群聊内的名称信息...`);
        
            
            for (const chatId in runtime.state.chats) {
                const groupChat = runtime.state.chats[chatId];
                
                
                if (groupChat.isGroup && groupChat.members) {
                    
                    const memberToUpdate = groupChat.members.find(m => m.id === characterId);
        
                    
                    if (memberToUpdate) {
                        let needsDbUpdate = false; 
                        
                        
                        if (memberToUpdate.groupNickname !== newRemarkName) {
                            memberToUpdate.groupNickname = newRemarkName;
                            needsDbUpdate = true;
                        }
        
                        
                        if (memberToUpdate.originalName !== newOriginalName) {
                            memberToUpdate.originalName = newOriginalName;
                            needsDbUpdate = true;
                        }
        
                        
                        if (needsDbUpdate) {
                            await runtime.db.chats.put(groupChat);
                            console.log(`成功将群聊 "${groupChat.name}" 中的成员信息更新`);
                        }
                    }
                }
            }
        }

export async function syncCharacterAvatarInGroups(characterChat) {
            
            if (!characterChat || characterChat.isGroup) {
                console.warn("syncCharacterAvatarInGroups: 传入的不是有效的单聊对象，已跳过同步。");
                return;
            }
        
            const characterId = characterChat.id;
            const newAvatar = characterChat.settings.aiAvatar; 
        
            console.log(`正在为角色 ${characterId} 同步所有群聊内的头像...`);
        
            
            for (const groupChat of Object.values(runtime.state.chats)) {
                if (groupChat.isGroup && groupChat.members) {
                    
                    const memberToUpdate = groupChat.members.find(m => m.id === characterId);
                    
                    
                    if (memberToUpdate && memberToUpdate.avatar !== newAvatar) {
                        memberToUpdate.avatar = newAvatar; 
                        
                        
                        await runtime.db.chats.put(groupChat);
                        console.log(`成功将角色 ${characterId} 的新头像同步到群聊 "${groupChat.name}"`);
                    }
                }
            }
        }

export function getDisplayNameInGroup(groupChat, originalName) {
            
            if (!groupChat || !groupChat.isGroup || !originalName) {
                return originalName;
            }
        
            
        
            
            
            const userOriginalName = runtime.state.qzoneSettings.nickname || '{{user}}';
            if (originalName === userOriginalName) {
                
                return groupChat.settings.myNickname || '我';
            }
        
            
            const member = groupChat.members.find(m => m.originalName === originalName);
            
            
            return member ? member.groupNickname : originalName;
        }

export function getDisplayNameByOriginalName(nameIdentifier) {
            
            if (!nameIdentifier) return '';
        
            
            if (runtime.state.qzoneSettings && nameIdentifier === runtime.state.qzoneSettings.nickname) {
                return runtime.state.qzoneSettings.nickname;
            }
            
            
            
            let characterChat = Object.values(runtime.state.chats).find(chat => !chat.isGroup && chat.originalName === nameIdentifier);
            if (characterChat) {
                return characterChat.name; 
            }
        
            
            characterChat = Object.values(runtime.state.chats).find(chat => 
                !chat.isGroup && 
                (chat.nameHistory && chat.nameHistory.includes(nameIdentifier))
            );
            if (characterChat) {
                return characterChat.name; 
            }
        
            
            
            return nameIdentifier;
        }

export function processMentions(text, chat = null) {
            
            if (!text || typeof text !== 'string' || !text.includes('@[[')) {
                return text; 
            }
            
            
            return text.replace(/@\[\[([^\]]+)\]\]/g, (match, originalName) => {
                const trimmedOriginalName = originalName.trim();
                let displayName;
                
                
                if (chat && chat.isGroup) {
                    
                    
                    displayName = getDisplayNameInGroup(chat, trimmedOriginalName);
                } else {
                    
                    displayName = getDisplayNameByOriginalName(trimmedOriginalName);
                }
                
                
                return `@${displayName}`;
            });
        }

export async function openGroupManager() {
            await renderGroupList();
            document.getElementById('group-management-modal').classList.add('visible');
        }

export async function renderGroupList() {
            const listEl = document.getElementById('existing-groups-list');
            const groups = await runtime.db.qzoneGroups.toArray();
            listEl.innerHTML = '';
            if (groups.length === 0) {
                listEl.innerHTML = "<p style=\"text-align: center; color: var(--text-secondary);\">No groups yet.</p>";
            }
            groups.forEach(group => {
                const item = document.createElement('div');
                item.className = 'existing-group-item';
                item.innerHTML = `
                    <span class="group-name">${group.name}</span>
                    <span class="delete-group-btn" data-id="${group.id}">×</span>
                `;
                listEl.appendChild(item);
            });
        }

export async function addNewGroup() {
            const input = document.getElementById('new-group-name-input');
            const name = input.value.trim();
            if (!name) {
                alert("Enter a group name.");
                return;
            }
        
            
            const existingGroup = await runtime.db.qzoneGroups.where('name').equals(name).first();
            if (existingGroup) {
                alert(`A group named “${name}” already exists.`);
                return;
            }
            
        
            await runtime.db.qzoneGroups.add({ name });
            input.value = '';
            await renderGroupList();
        }

export async function deleteGroup(groupId) {
            const confirmed = await showCustomConfirm("Confirm Delete", "Delete this group and ungroup its contacts?", { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                await runtime.db.qzoneGroups.delete(groupId);
                // 将属于该分组的好友的 groupId 设为 null
                const chatsToUpdate = await runtime.db.chats.where('groupId').equals(groupId).toArray();
                for (const chat of chatsToUpdate) {
                    chat.groupId = null;
                    await runtime.db.chats.put(chat);
                    if(runtime.state.chats[chat.id]) runtime.state.chats[chat.id].groupId = null;
                }
                await renderGroupList();
            }
        }

export async function openContactPickerForGroupCreate() {
    
    const choice = await showChoiceModal('Create Group Chat', [
        { text: 'Group Chat', value: 'normal' },
        { text: 'Spectator Chat', value: 'spectator' }
    ]);

    if (choice === 'normal') {
        
        runtime.selectedContacts.clear();
        const confirmBtn = document.getElementById('confirm-contact-picker-btn');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        newConfirmBtn.addEventListener('click', handleCreateGroup);
        await renderContactPicker();
        showScreen('contact-picker-screen');

    } else if (choice === 'spectator') {
        
        openSpectatorGroupCreator();
    }
}

export async function openSpectatorGroupCreator() {
    runtime.selectedContacts.clear(); 

    
    const confirmBtn = document.getElementById('confirm-contact-picker-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', handleCreateSpectatorGroup);

    
    await renderSpectatorContactPicker();

    
    showScreen('contact-picker-screen');
}

export async function renderSpectatorContactPicker() {
    const listEl = document.getElementById('contact-picker-list');
    listEl.innerHTML = '';

    
    const characters = Object.values(runtime.state.chats).filter(chat => !chat.isGroup);
    
    const npcs = await runtime.db.npcs.toArray();

    if (characters.length === 0 && npcs.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color:#8a8a8a; margin-top:50px;\">Create characters or NPCs to invite them to a group chat.</p>";
        return;
    }

    
    characters.forEach(contact => {
        const item = document.createElement('div');
        item.className = 'contact-picker-item';
        item.dataset.contactId = contact.id; 
        item.innerHTML = `
            <div class="checkbox"></div>
            <img src="${contact.settings.aiAvatar || runtime.defaultAvatar}" class="avatar">
            <span class="name">${contact.name} <small style="color:#888;"> (Character)</small></span>
        `;
        listEl.appendChild(item);
    });

    
    npcs.forEach(npc => {
        const item = document.createElement('div');
        item.className = 'contact-picker-item';
        item.dataset.contactId = npc.id; 
        item.dataset.isNpc = "true";     
        item.innerHTML = `
            <div class="checkbox"></div>
            <img src="${npc.avatar || runtime.defaultGroupMemberAvatar}" class="avatar">
            <span class="name">${npc.name} <small style="color:#007722;">(NPC)</small></span>
        `;
        listEl.appendChild(item);
    });

    updateContactPickerConfirmButton();
}

export async function handleCreateSpectatorGroup() {
    if (runtime.selectedContacts.size < 2) {
        alert("Select at least two members for a spectator chat.");
        return;
    }

    const groupName = await showCustomPrompt("Set Group Name", "Enter a group name", 'Spectator Chat');
    if (!groupName || !groupName.trim()) return;

    const newChatId = 'group_' + Date.now();
    const members = [];
    const allNpcs = await runtime.db.npcs.toArray(); 

    for (const contactId of runtime.selectedContacts) {
        const isNpc = document.querySelector(`.contact-picker-item[data-contact-id="${contactId}"]`).dataset.isNpc === "true";

        if (isNpc) {
            
            const npcData = allNpcs.find(n => n.id === parseInt(contactId));
            if (npcData) {
                members.push({
                    id: `npc_${npcData.id}`, 
                    originalName: npcData.name,
                    groupNickname: npcData.name,
                    persona: npcData.persona,
                    avatar: npcData.avatar || runtime.defaultGroupMemberAvatar,
                    isNpc: true
                });
            }
        } else {
            
            const contactChat = runtime.state.chats[contactId];
            if (contactChat) {
                members.push({
                    id: contactId,
                    originalName: contactChat.originalName,
                    groupNickname: contactChat.name,
                    persona: contactChat.settings.aiPersona,
                    avatar: contactChat.settings.aiAvatar || runtime.defaultAvatar,
                    isNpc: false
                });
            }
        }
    }

    const newGroupChat = {
        id: newChatId,
        name: groupName.trim(),
        isGroup: true,
        isSpectatorGroup: true, 
        members: members,
        settings: {
            
            maxMemory: 10,
            groupAvatar: runtime.defaultGroupAvatar,
            background: '',
            theme: 'default',
            fontSize: 13,
            customCss: '',
            linkedWorldBookIds: [],
        },
        history: [{ 
            role: 'system',
            content: '[System instruction: The user does not participate in this group. Start the conversation in character.]',
            timestamp: Date.now(),
            isHidden: true
        }],
        musicData: { totalTime: 0 }
    };

    await runtime.db.chats.put(newGroupChat);
    runtime.state.chats[newChatId] = newGroupChat;

    await renderChatList();
    showScreen('chat-list-screen');
    openChat(newChatId);
}

export async function renderContactPicker() {
    const listEl = document.getElementById('contact-picker-list');
    listEl.innerHTML = '';

    
    const characters = Object.values(runtime.state.chats).filter(chat => !chat.isGroup);
    const npcs = await runtime.db.npcs.toArray();

    if (characters.length === 0 && npcs.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color:#8a8a8a; margin-top:50px;\">There are no contacts to add.</p>";
        return;
    }

    
    characters.forEach(contact => {
        const item = document.createElement('div');
        item.className = 'contact-picker-item';
        item.dataset.contactId = contact.id; 
        item.innerHTML = `
            <div class="checkbox"></div>
            <img src="${contact.settings.aiAvatar || runtime.defaultAvatar}" class="avatar">
            <span class="name">${contact.name} <small style="color:#888;"> (Character)</small></span>
        `;
        listEl.appendChild(item);
    });
    
    
    npcs.forEach(npc => {
        const item = document.createElement('div');
        item.className = 'contact-picker-item';
        
        item.dataset.contactId = `npc_${npc.id}`; 
        item.innerHTML = `
            <div class="checkbox"></div>
            <img src="${npc.avatar || runtime.defaultGroupMemberAvatar}" class="avatar">
            <span class="name">${npc.name} <small style="color:#007722;">(NPC)</small></span>
        `;
        listEl.appendChild(item);
    });

    updateContactPickerConfirmButton();
}

export function updateContactPickerConfirmButton() {
            const btn = document.getElementById('confirm-contact-picker-btn');
            btn.textContent = `Done (${runtime.selectedContacts.size})`;
            btn.disabled = runtime.selectedContacts.size < 2; 
        }

export async function handleCreateGroup() {
    if (runtime.selectedContacts.size < 2) {
        alert("Choose at least two contacts to create a group chat.");
        return;
    }

    const groupName = await showCustomPrompt("Set Group Name", "Enter a group name", 'Group Chat');
    if (!groupName || !groupName.trim()) return;

    const newChatId = 'group_' + Date.now();
    const members = [];
    const allNpcs = await runtime.db.npcs.toArray(); 

    for (const contactId of runtime.selectedContacts) {
        
        if (contactId.startsWith('npc_')) {
            const npcId = parseInt(contactId.replace('npc_', ''));
            const npcData = allNpcs.find(n => n.id === npcId);
            if (npcData) {
                members.push({
                    id: contactId, 
                    originalName: npcData.name,
                    groupNickname: npcData.name,
                    persona: npcData.persona,
                    avatar: npcData.avatar || runtime.defaultGroupMemberAvatar,
                    isNpc: true 
                });
            }
        } else { 
            const contactChat = runtime.state.chats[contactId];
            if (contactChat) {
                members.push({
                    id: contactId,
                    originalName: contactChat.originalName,
                    groupNickname: contactChat.name,
                    persona: contactChat.settings.aiPersona,
                    avatar: contactChat.settings.aiAvatar || runtime.defaultAvatar,
                    isNpc: false 
                });
            }
        }
    }

    const newGroupChat = {
        id: newChatId,
        name: groupName.trim(),
        isGroup: true,
        members: members,
        settings: {
            myPersona: '',
            myNickname: 'Me',
            maxMemory: 10,
            groupAvatar: runtime.defaultGroupAvatar,
            myAvatar: runtime.defaultMyGroupAvatar,
            background: '',
            theme: 'default',
            fontSize: 13,
            customCss: '',
            linkedWorldBookIds: [],
        },
        history: [],
        musicData: { totalTime: 0 }
    };

    await runtime.db.chats.put(newGroupChat);
    runtime.state.chats[newChatId] = newGroupChat;
    
    await renderChatList();
    showScreen('chat-list-screen');
    openChat(newChatId); 
}

export function openMemberManagementScreen() {
            if (!runtime.state.activeChatId || !runtime.state.chats[runtime.state.activeChatId].isGroup) return;
            renderMemberManagementList();
            showScreen('member-management-screen');
        }

export function renderMemberManagementList() {
            const listEl = document.getElementById('member-management-list');
            const chat = runtime.state.chats[runtime.state.activeChatId];
            listEl.innerHTML = '';
        
            chat.members.forEach(member => {
                const item = document.createElement('div');
                item.className = 'member-management-item';
                
                item.innerHTML = `
                    <img src="${member.avatar}" class="avatar">
                    <span class="name">${member.groupNickname}</span>
                    <button class="remove-member-btn" data-member-id="${member.id}" title="Remove from Group">-</button>
                `;
                listEl.appendChild(item);
            });
        }

export async function removeMemberFromGroup(memberId) {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const memberIndex = chat.members.findIndex(m => m.id === memberId);
            
            if (memberIndex === -1) return;
            
            
            if (chat.members.length <= 2) {
                alert("A group chat must have at least two members.");
                return;
            }
            
        const memberName = chat.members[memberIndex].groupNickname; 
            const confirmed = await showCustomConfirm(
                "Remove Member",
                `Remove “${memberName}” from the group?`,
                { confirmButtonClass: 'btn-danger' }
            );
        
            if (confirmed) {
                chat.members.splice(memberIndex, 1);
                await runtime.db.chats.put(chat);
                renderMemberManagementList(); 
                document.getElementById('chat-settings-btn').click(); 
            }
        }

export async function openContactPickerForAddMember() {
    
    const confirmBtn = document.getElementById('confirm-contact-picker-btn');
    
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', handleAddMembersToGroup);
    
    
    await renderUnifiedContactPicker();
    
    
    showScreen('contact-picker-screen');
}

export async function renderUnifiedContactPicker() {
    const listEl = document.getElementById('contact-picker-list');
    listEl.innerHTML = '';
    runtime.selectedContacts.clear(); 

    const chat = runtime.state.chats[runtime.state.activeChatId];
    const existingMemberIds = new Set(chat.members.map(m => m.id));

    
    const characters = Object.values(runtime.state.chats).filter(c => !c.isGroup && !existingMemberIds.has(c.id));
    
    
    const npcs = (await runtime.db.npcs.toArray()).filter(n => !existingMemberIds.has(`npc_${n.id}`));

    if (characters.length === 0 && npcs.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color:#8a8a8a; margin-top:50px;\">There are no more contacts to invite.</p>";
        document.getElementById('confirm-contact-picker-btn').style.display = 'none';
    } else {
        document.getElementById('confirm-contact-picker-btn').style.display = 'block';
        
        
        characters.forEach(contact => {
            const item = document.createElement('div');
            item.className = 'contact-picker-item';
            item.dataset.contactId = contact.id;
            item.dataset.contactType = 'character'; 
            item.innerHTML = `
                <div class="checkbox"></div>
                <img src="${contact.settings.aiAvatar || runtime.defaultAvatar}" class="avatar">
                <span class="name">${contact.name} <small style="color:#888;"> (Character)</small></span>
            `;
            listEl.appendChild(item);
        });

        
        npcs.forEach(npc => {
            const item = document.createElement('div');
            item.className = 'contact-picker-item';
            item.dataset.contactId = `npc_${npc.id}`; 
            item.dataset.contactType = 'npc'; 
            item.dataset.npcId = npc.id; 
            item.innerHTML = `
                <div class="checkbox"></div>
                <img src="${npc.avatar || runtime.defaultGroupMemberAvatar}" class="avatar">
                <span class="name">${npc.name} <small style="color:#007722;">(NPC)</small></span>
            `;
            listEl.appendChild(item);
        });
    }

    updateContactPickerConfirmButton();
}

export async function handleAddMembersToGroup() {
    if (runtime.selectedContacts.size === 0) {
        alert("Select at least one contact.");
        return;
    }
    
    const chat = runtime.state.chats[runtime.state.activeChatId];
    const allNpcs = await runtime.db.npcs.toArray(); 

    for (const contactId of runtime.selectedContacts) {
        const itemEl = document.querySelector(`.contact-picker-item[data-contact-id="${contactId}"]`);
        if (!itemEl) continue;

        const contactType = itemEl.dataset.contactType;

        if (contactType === 'character') {
            const contactChat = runtime.state.chats[contactId];
            if (contactChat) {
                chat.members.push({
                    id: contactId,
                    originalName: contactChat.originalName,
                    groupNickname: contactChat.name,
                    persona: contactChat.settings.aiPersona,
                    
                    avatar: contactChat.settings.aiAvatar || runtime.defaultAvatar,
                    isNpc: false 
                });
            }
        } else if (contactType === 'npc') {
            const npcId = parseInt(itemEl.dataset.npcId);
            const npcData = allNpcs.find(n => n.id === npcId);
            if (npcData) {
                
                
                chat.members.push({
                    id: `npc_${npcId}`,
                    originalName: npcData.name,
                    groupNickname: npcData.name,
                    persona: npcData.persona,
                    avatar: npcData.avatar || runtime.defaultGroupMemberAvatar, 
                    isNpc: true
                });
            }
        }
    }

    await runtime.db.chats.put(chat);
    
    
    openMemberManagementScreen();
}

export function createNewMemberInGroup() {
    
    runtime.isAddingNpcToGroup = true; 
    
    openNpcEditor(null);
}

export async function showAnnouncementBoard() { 
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const announcements = chat.announcements || [];

            if (!chat || announcements.length === 0) {
                showCustomAlert("Notice", "This group has no announcements yet.");
                return;
            }

            const contentEl = document.getElementById('announcement-board-content');
            contentEl.innerHTML = '';

            
            announcements.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

            
            for (const anno of announcements) {
                const originalMessage = chat.history.find(m => m.timestamp === anno.messageTimestamp);

                const wrapper = document.createElement('div');
                wrapper.className = 'announcement-item-wrapper';

                if (originalMessage) {
                    
                    const messageBubbleEl = await createMessageElement(originalMessage, chat);
                    if (messageBubbleEl) { 
                        wrapper.appendChild(messageBubbleEl);
                    }
                } else {
                    wrapper.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary);\">The original message was deleted.</p>";
                }

                if (anno.isPinned) {
                    wrapper.innerHTML += `<div class="pinned-indicator">📌</div>`;
                }
                wrapper.innerHTML += `<div class="announcement-item-actions" data-anno-id="${anno.id}">...</div>`;

                contentEl.appendChild(wrapper);
            }

            document.getElementById('announcement-board-modal').classList.add('visible');
        }

export async function handlePinAnnouncement() {
            if (!controls.activeAnnouncementId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            const announcement = chat.announcements.find(a => a.id === controls.activeAnnouncementId);
            if (announcement) {
                announcement.isPinned = !announcement.isPinned; 
                await runtime.db.chats.put(chat);
                showAnnouncementBoard(); 
            }
            document.getElementById('announcement-actions-modal').classList.remove('visible');
        }

export async function handleDeleteAnnouncement() {
            if (!controls.activeAnnouncementId) return;
        
            const confirmed = await showCustomConfirm("Confirm Delete", "Permanently delete this announcement?", { confirmButtonClass: 'btn-danger' });
        
            if (confirmed) {
                const chat = runtime.state.chats[runtime.state.activeChatId];
                
                chat.announcements = chat.announcements.filter(a => a.id !== controls.activeAnnouncementId);
                await runtime.db.chats.put(chat);
                showAnnouncementBoard(); 
            }
            document.getElementById('announcement-actions-modal').classList.remove('visible');
        }

export function openFrameSelectorModal(type = 'chat') {
            const frameModal = document.getElementById('avatar-frame-modal');
            if (!runtime.state.activeChatId) return;
            const chat = runtime.state.chats[runtime.state.activeChatId];
            runtime.editingFrameForMember = (type === 'member');
        
            if (runtime.editingFrameForMember) {
                const member = chat.members.find(m => m.id === runtime.editingMemberId);
                if (!member) return;
                runtime.currentFrameSelection.my = member.avatarFrame || '';
                populateFrameGrids(true, member.avatar, member.avatarFrame);
            } else {
                runtime.currentFrameSelection.ai = chat.settings.aiAvatarFrame || '';
                runtime.currentFrameSelection.my = chat.settings.myAvatarFrame || '';
                populateFrameGrids(false);
            }
            frameModal.classList.add('visible');
        }
