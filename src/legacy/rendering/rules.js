import { addLongPressListener, showCustomConfirm } from '../dialogs/dialogs.js'
import { showScreen } from '../../app/routes'
import { runtime } from '../runtime/state.js'

export function switchRuleCategory(categoryId) {
            
            document.querySelectorAll('.rules-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.categoryId === categoryId);
            });
            
            document.querySelectorAll('.rules-category-pane').forEach(pane => {
                pane.classList.toggle('active', pane.dataset.categoryId === categoryId);
            });
        }

export async function openRenderingRulesScreen() {
            await renderRulesList();
            showScreen('rendering-rules-screen');
        }

export async function renderRulesList() {
            const tabsContainer = document.getElementById('rules-tabs');
            const contentContainer = document.getElementById('rules-content-container');
            tabsContainer.innerHTML = '';
            contentContainer.innerHTML = '';
        
            const allRules = await runtime.db.renderingRules.toArray();
        
            if (allRules.length === 0) {
                contentContainer.innerHTML = "<p style=\"text-align:center; color: var(--text-secondary); margin-top: 50px;\">Use the plus button to create your first rendering rule.</p>";
                return;
            }
        
            
            const globalTab = document.createElement('button');
            globalTab.className = 'rules-tab active'; 
            globalTab.textContent = "Global Rules";
            globalTab.dataset.categoryId = 'global';
            tabsContainer.appendChild(globalTab);
        
            const globalPane = document.createElement('div');
            globalPane.className = 'rules-category-pane active';
            globalPane.dataset.categoryId = 'global';
            contentContainer.appendChild(globalPane);
        
            
            const characterChatsWithRules = Object.values(runtime.state.chats).filter(chat => 
                !chat.isGroup && allRules.some(r => r.chatId === chat.id)
            );
        
            characterChatsWithRules.forEach(chat => {
                const charTab = document.createElement('button');
                charTab.className = 'rules-tab';
                charTab.textContent = chat.name;
                charTab.dataset.categoryId = chat.id;
                tabsContainer.appendChild(charTab);
        
                const charPane = document.createElement('div');
                charPane.className = 'rules-category-pane';
                charPane.dataset.categoryId = chat.id;
                contentContainer.appendChild(charPane);
            });
            
            
            allRules.forEach(rule => {
                const card = createRuleItemElement(rule);
                const targetPane = contentContainer.querySelector(`.rules-category-pane[data-category-id="${rule.chatId}"]`);
                if (targetPane) {
                    targetPane.appendChild(card);
                }
            });
        
            
            document.querySelectorAll('.rules-tab').forEach(tab => {
                tab.addEventListener('click', () => switchRuleCategory(tab.dataset.categoryId));
            });
        }

export function createRuleItemElement(rule) {
            const card = document.createElement('div');
            
            card.className = `rule-card ${rule.isEnabled ? 'enabled' : ''}`;
            card.dataset.ruleId = rule.id;
        
            card.innerHTML = `
                <div class="card-title">${rule.name}</div>
                <div class="card-content-preview">${rule.regex}</div>
            `;
            
            
            card.addEventListener('click', () => openRuleEditor(rule.id));
            addLongPressListener(card, () => deleteRenderingRule(rule.id));
        
            return card;
        }

export async function openRuleEditor(ruleId = null) {
            runtime.editingRuleId = ruleId;
            const modal = document.getElementById('rule-editor-modal');
            const title = document.getElementById('rule-editor-title');
            const nameInput = document.getElementById('rule-name-input');
            const chatIdSelect = document.getElementById('rule-chat-id-select');
            const regexInput = document.getElementById('rule-regex-input');
            const templateInput = document.getElementById('rule-template-input');
            const enabledSwitch = document.getElementById('rule-enabled-switch');
        
            
            chatIdSelect.innerHTML = "<option value=\"global\">Global (all characters)</option>";
            Object.values(runtime.state.chats).filter(c => !c.isGroup).forEach(chat => {
                chatIdSelect.innerHTML += `<option value="${chat.id}">${chat.name}</option>`;
            });
        
            if (ruleId) {
                title.textContent = "Edit Rule";
                const rule = await runtime.db.renderingRules.get(ruleId);
                nameInput.value = rule.name;
                chatIdSelect.value = rule.chatId;
                regexInput.value = rule.regex;
                templateInput.value = rule.template;
                enabledSwitch.checked = rule.isEnabled;
            } else {
                title.textContent = "Create Rule";
                nameInput.value = '';
                chatIdSelect.value = 'global';
                regexInput.value = '';
                templateInput.value = '';
                enabledSwitch.checked = true;
            }
        
            modal.classList.add('visible');
        }

export async function saveRenderingRule() {
            const name = document.getElementById('rule-name-input').value.trim();
            const regex = document.getElementById('rule-regex-input').value.trim();
            if (!name || !regex) {
                alert("Enter a rule name and a regular expression.");
                return;
            }
            try {
                new RegExp(regex);
            } catch (e) {
                alert(`Invalid regular expression: ${e.message}`);
                return;
            }
        
            const ruleData = {
                name: name,
                chatId: document.getElementById('rule-chat-id-select').value,
                regex: regex,
                template: document.getElementById('rule-template-input').value,
                isEnabled: document.getElementById('rule-enabled-switch').checked
            };
        
            if (runtime.editingRuleId) {
                await runtime.db.renderingRules.update(runtime.editingRuleId, ruleData);
            } else {
                await runtime.db.renderingRules.add(ruleData);
            }
        
            document.getElementById('rule-editor-modal').classList.remove('visible');
            await renderRulesList();
        }

export async function deleteRenderingRule(ruleId) {
            const confirmed = await showCustomConfirm("Delete Rule", "Delete this rendering rule?", { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                await runtime.db.renderingRules.delete(ruleId);
                await renderRulesList();
            }
        }

export async function applyRenderingRules(rawContent, chatId) {
    
    if (rawContent.trim().startsWith('<') || (!rawContent.includes('[') && !rawContent.includes('{'))) {
        return rawContent;
    }

    
    if (!runtime.ruleCache[chatId]) { 
        console.log(`Caching rendering rules for chat: ${chatId}`);
        
        const applicableRules = await runtime.db.renderingRules
            .where('chatId').equals('global')
            .or('chatId').equals(chatId)
            .toArray();
        
        runtime.ruleCache[chatId] = applicableRules.filter(r => r.isEnabled);
    }
    const rules = runtime.ruleCache[chatId]; 
    

    let processedContent = rawContent;

    for (const rule of rules) {
        try {
            const regex = new RegExp(rule.regex, 'g');
            let testContent = processedContent; 
            if (regex.test(testContent)) {
                processedContent = processedContent.replace(regex, rule.template);
            }
        } catch (e) {
            console.error(`渲染规则 [${rule.name}] 的正则表达式无效:`, e);
        }
    }

    return processedContent;
}

export function bindRenderingEvents() {
  document.getElementById('rules-tabs').addEventListener('click', (e) => {
            if (e.target.classList.contains('rules-tab')) {
                switchRuleCategory(e.target.dataset.categoryId);
            }
        });

document.getElementById('add-new-rule-btn').addEventListener('click', () => openRuleEditor(null));

document.getElementById('cancel-rule-editor-btn').addEventListener('click', () => {
            document.getElementById('rule-editor-modal').classList.remove('visible');
        });

document.getElementById('save-rule-btn').addEventListener('click', saveRenderingRule);
}
