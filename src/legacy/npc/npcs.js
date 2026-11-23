import { openMemberManagementScreen } from '../chat/groups.js'
import { addLongPressListener, showCustomConfirm } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'
import { fileDataUrl } from '../../runtime/files'

export function bindNpcEvents() {
  const modal = document.getElementById('npc-editor-modal')
  const avatarInput = document.getElementById('npc-avatar-input')
  const preview = document.getElementById('npc-avatar-preview')
  document.getElementById('add-npc-btn').addEventListener('click', () => openNpcEditor())
  document.getElementById('save-npc-btn').addEventListener('click', saveNpc)
  document.getElementById('cancel-npc-editor-btn').addEventListener('click', () => modal.classList.remove('visible'))
  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files[0]
    if (!file) return
    try {
      preview.src = await fileDataUrl(file)
    } catch {
      alert('Could not read the avatar.')
    }
  })
}

export async function renderNpcListScreen() {
    const listEl = document.getElementById('npc-list');
    listEl.innerHTML = '';
    
    const npcs = await runtime.db.npcs.toArray();

    if (npcs.length === 0) {
        listEl.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); padding: 50px 0;\">No NPCs yet.<br>Use the plus button to add an NPC.</p>";
        return;
    }

    npcs.forEach(npc => {
        const item = document.createElement('div');
        item.className = 'chat-list-item';
        item.dataset.npcId = npc.id;
        
        item.innerHTML = `
            <img src="${npc.avatar || runtime.defaultGroupMemberAvatar}" class="avatar" style="border-radius: 50%;">
            <div class="info">
                <div class="name-line">
                    <span class="name">${npc.name}</span>
                </div>
                <div class="last-msg">${npc.persona.substring(0, 30)}...</div>
            </div>
        `;
        
        item.addEventListener('click', () => openNpcEditor(npc.id));
        
        
        addLongPressListener(item, async () => {
            await deleteNpc(npc.id);
        });
        
        listEl.appendChild(item);
    });
}

export async function openNpcEditor(npcId = null) {
            runtime.editingNpcId = npcId;
            const modal = document.getElementById('npc-editor-modal');
            const titleEl = document.getElementById('npc-editor-title');
            const nameInput = document.getElementById('npc-name-input');
            const personaInput = document.getElementById('npc-persona-input');
            const avatarPreview = document.getElementById('npc-avatar-preview');
            const associationListEl = document.getElementById('npc-association-list');
            
            
            const activitySwitch = document.getElementById('npc-background-activity-switch');
            const cooldownInput = document.getElementById('npc-action-cooldown-input');
            
            associationListEl.innerHTML = ''; 

            
            associationListEl.innerHTML += `<label><input type="checkbox" value="user"> ${runtime.state.qzoneSettings.nickname || '我'} (User)</label>`;
            Object.values(runtime.state.chats).filter(c => !c.isGroup).forEach(char => {
                associationListEl.innerHTML += `<label><input type="checkbox" value="${char.id}"> ${char.name} (Character)</label>`;
            });

            if (npcId) {
                
                titleEl.textContent = "Edit NPC";
                const npc = await runtime.db.npcs.get(npcId);
                if (npc) {
                    nameInput.value = npc.name;
                    personaInput.value = npc.persona;
                    avatarPreview.src = npc.avatar || runtime.defaultGroupMemberAvatar;

                    
                    
                    activitySwitch.checked = npc.enableBackgroundActivity !== false; 
                    cooldownInput.value = npc.actionCooldownMinutes || 15;

                    if (npc.associatedWith && Array.isArray(npc.associatedWith)) {
                        npc.associatedWith.forEach(id => {
                            const checkbox = associationListEl.querySelector(`input[value="${id}"]`);
                            if (checkbox) checkbox.checked = true;
                        });
                    }
                }
            } else {
                
                titleEl.textContent = "Add NPC";
                nameInput.value = '';
                personaInput.value = '';
                avatarPreview.src = runtime.defaultGroupMemberAvatar;

                
                activitySwitch.checked = true; 
                cooldownInput.value = 15;     

                const userCheckbox = associationListEl.querySelector('input[value="user"]');
                if (userCheckbox) userCheckbox.checked = true;
            }

            modal.classList.add('visible');
        }

export async function saveNpc() {
    const name = document.getElementById('npc-name-input').value.trim();
    const persona = document.getElementById('npc-persona-input').value.trim();
    if (!name || !persona) {
        alert("Enter the NPC’s name and description.");
        return;
    }

    const selectedAssociations = Array.from(document.querySelectorAll('#npc-association-list input:checked')).map(cb => cb.value);
    const enableBackgroundActivity = document.getElementById('npc-background-activity-switch').checked;
    const actionCooldownMinutes = parseInt(document.getElementById('npc-action-cooldown-input').value) || 15;

    const npcData = {
        name,
        persona,
        avatar: document.getElementById('npc-avatar-preview').src,
        associatedWith: selectedAssociations,
        enableBackgroundActivity: enableBackgroundActivity,
        actionCooldownMinutes: actionCooldownMinutes
    };

    if (runtime.editingNpcId) {
        await runtime.db.npcs.update(runtime.editingNpcId, npcData);
    } else {
        
        const newNpcId = await runtime.db.npcs.add(npcData);

        if (runtime.isAddingNpcToGroup && runtime.state.activeChatId) {
            const chat = runtime.state.chats[runtime.state.activeChatId];
            if (chat.isGroup) {
                
                
                chat.members.push({
                    id: `npc_${newNpcId}`,
                    originalName: name,
                    groupNickname: name,
                    persona: persona,
                    avatar: npcData.avatar, 
                    isNpc: true
                });
                await runtime.db.chats.put(chat);
            }
        }
    }
    
    document.getElementById('npc-editor-modal').classList.remove('visible');
    
    if (runtime.isAddingNpcToGroup) {
        runtime.isAddingNpcToGroup = false; 
        openMemberManagementScreen();
    } else {
        await renderNpcListScreen();
    }
}

export async function deleteNpc(npcId) {
    const npc = await runtime.db.npcs.get(npcId);
    if (!npc) return;
    const confirmed = await showCustomConfirm("Delete NPC", `Delete NPC “${npc.name}”?`, { confirmButtonClass: 'btn-danger' });
    if (confirmed) {
        await runtime.db.npcs.delete(npcId);
        await renderNpcListScreen();
    }
}
