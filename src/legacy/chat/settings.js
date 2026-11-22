import { controls } from '../runtime/state.js'
import { runtime } from '../runtime/state.js'

export function updateWorldBookSelectionDisplay() {
            const checkedBoxes = controls.worldBookCheckboxesContainer.querySelectorAll('input:checked');
            const displayText = document.querySelector('.selected-options-text');
            
            if (checkedBoxes.length === 0) {
                displayText.textContent = "Select entries";
            } else if (checkedBoxes.length > 2) {
                displayText.textContent = `${checkedBoxes.length} World Info books selected`;
            } else {
                const displayItems = Array.from(checkedBoxes).map(cb => {
                    return cb.parentElement.textContent.trim();
                });
                displayText.textContent = displayItems.join(', ');
            }
        }

export function renderGroupMemberSettings(members) { 
    const container = document.getElementById('group-members-settings'); 
    container.innerHTML = ''; 
    members.forEach(member => { 
        const div = document.createElement('div'); 
        div.className = 'member-editor'; 
        div.dataset.memberId = member.id; 
        
        
        
        
        const memberAvatar = member.avatar || (runtime.state.chats[member.id] ? runtime.state.chats[member.id].settings.aiAvatar : runtime.defaultGroupMemberAvatar);

        div.innerHTML = `<img src="${memberAvatar}" alt="${member.groupNickname}"><div class="member-name">${member.groupNickname}</div>`;
        div.addEventListener('click', () => openMemberEditor(member.id)); 
        container.appendChild(div); 
    }); 
}

export function openMemberEditor(memberId) { 
            runtime.editingMemberId = memberId; 
            const chat = runtime.state.chats[runtime.state.activeChatId]; 
            const member = chat.members.find(m => m.id === memberId); 
            if (!member) return; 
        
            document.getElementById('member-name-input').value = member.groupNickname; 
            document.getElementById('member-persona-input').value = member.persona; 
            
            
            
            const memberAvatar = member.avatar || (runtime.state.chats[member.id] ? runtime.state.chats[member.id].settings.aiAvatar : runtime.defaultGroupMemberAvatar);
            document.getElementById('member-avatar-preview').src = memberAvatar;
        
            document.getElementById('member-settings-modal').classList.add('visible'); 
        }
