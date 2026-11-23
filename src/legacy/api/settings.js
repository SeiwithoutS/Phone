import { startBackgroundSimulation, stopBackgroundSimulation } from '../npc/simulation.js'
import { openAiUrl } from '../../features/api/endpoints'
import { contextConfig } from '../../features/context/context'
import { contextKey, normalizeContext } from '../../features/context/budget'
import { geminiModelsUrl, generationSettings, sendCompletion, usesGemini } from '../../features/api/completion'
import { preferences } from '../storage/preferences.js'
import { displayTotalImageSize } from '../backup/media.js'
import { showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { getRandomValue } from '../../runtime/helpers'
import { runtime } from '../runtime/state.js'

export async function loadApiPresetsDropdown() {
            const selectEl = document.getElementById('api-preset-select');
            selectEl.innerHTML = "<option value=\"current\">Current Settings (Unsaved)</option>";
            
            const presets = await runtime.db.apiPresets.toArray();
            presets.forEach(preset => {
                const option = document.createElement('option');
                option.value = preset.id;
                option.textContent = preset.name;
                selectEl.appendChild(option);
            });
        
            
            const currentConfig = runtime.state.apiConfig;
            let matchingPresetId = null;
            for (const preset of presets) {
                
                if (
                    preset.proxyUrl === currentConfig.proxyUrl &&
                    preset.apiKey === currentConfig.apiKey &&
                    preset.model === currentConfig.model &&
                    usesGemini(preset.proxyUrl, preset.provider) === usesGemini(currentConfig.proxyUrl, currentConfig.provider) &&
                    
                    (preset.minimaxGroupId || '') === (currentConfig.minimaxGroupId || '') &&
                    (preset.minimaxApiKey || '') === (currentConfig.minimaxApiKey || '') &&
                    (preset.minimaxModel || 'speech-01') === (currentConfig.minimaxModel || 'speech-01')
                ) 
                  
                {
                    matchingPresetId = preset.id;
                    break;
                }
            }
        
            if (matchingPresetId) {
                selectEl.value = matchingPresetId;
            } else {
                selectEl.value = 'current';
            }
        }

export async function handlePresetSelectionChange() {
            const selectEl = document.getElementById('api-preset-select');
            const selectedId = parseInt(selectEl.value);
        
            
            if (isNaN(selectedId)) {
                return;
            }
        
            const preset = await runtime.db.apiPresets.get(selectedId);
            if (preset) {
                
                runtime.state.apiConfig = {
                    id: 'main',
                    proxyUrl: usesGemini(preset.proxyUrl, preset.provider) ? geminiModelsUrl : preset.proxyUrl,
                    apiKey: preset.apiKey,
                    model: preset.model,
                    provider: usesGemini(preset.proxyUrl, preset.provider) ? "gemini" : "openai",
                    
                    minimaxGroupId: preset.minimaxGroupId,
                    minimaxApiKey: preset.minimaxApiKey,
                    minimaxModel: preset.minimaxModel
                      
                };
                
                await runtime.db.apiConfig.put(runtime.state.apiConfig);
                
                renderApiSettings();
                
                alert(`Loaded preset “${preset.name}”`);
            }
        }

export async function saveApiPreset() {
            const name = await showCustomPrompt("Save API Preset", "Enter a preset name");
            if (!name || !name.trim()) return;
        
            
            const presetData = {
                name: name.trim(),
                proxyUrl: text('api-provider') === 'gemini' ? geminiModelsUrl : text('proxy-url'),
                apiKey: document.getElementById('api-key').value.trim(),
                model: text('model-select'),
                provider: text('api-provider'),
     
                minimaxGroupId: document.getElementById('minimax-group-id').value.trim(),
                minimaxApiKey: document.getElementById('minimax-api-key').value.trim(),
                minimaxModel: document.getElementById('minimax-model-select').value
                  
            };
        
            
            const existingPreset = await runtime.db.apiPresets.where('name').equals(presetData.name).first();
            if (existingPreset) {
                const confirmed = await showCustomConfirm("Overwrite Preset", `A preset named “${presetData.name}” already exists. Overwrite it?`, { confirmButtonClass: 'btn-danger' });
                if (!confirmed) return;
                presetData.id = existingPreset.id; 
            }
        
            await runtime.db.apiPresets.put(presetData);
            await loadApiPresetsDropdown(); 
            alert("API preset saved.");
        }

export async function deleteApiPreset() {
            const selectEl = document.getElementById('api-preset-select');
            const selectedId = parseInt(selectEl.value);
        
            if (isNaN(selectedId)) {
                alert("Select a saved preset to delete.");
                return;
            }
        
            const preset = await runtime.db.apiPresets.get(selectedId);
            if (!preset) return;
        
            const confirmed = await showCustomConfirm("Delete Preset", `Delete preset “${preset.name}”?`, { confirmButtonClass: 'btn-danger' });
            if (confirmed) {
                await runtime.db.apiPresets.delete(selectedId);
                await loadApiPresetsDropdown(); 
                alert("Preset deleted.");
            }
        }

export function renderApiSettings() { 
            
            field('proxy-url').value = runtime.state.apiConfig.proxyUrl || '';
            field('api-provider').value = usesGemini(runtime.state.apiConfig.proxyUrl, runtime.state.apiConfig.provider) ? 'gemini' : 'openai';
            renderGenerationSettings();
            showConnectionStatus('');
            document.getElementById('api-key').value = runtime.state.apiConfig.apiKey || ''; 
            document.getElementById('model-select').value = runtime.state.apiConfig.model ?? '';
            document.getElementById('background-activity-switch').checked = runtime.state.globalSettings.enableBackgroundActivity || false;
            document.getElementById('background-interval-input').value = runtime.state.globalSettings.backgroundActivityInterval || 60;
            document.getElementById('block-cooldown-input').value = runtime.state.globalSettings.blockCooldownHours || 1;
            document.getElementById('enable-ai-drawing-switch').checked = runtime.state.globalSettings.enableAiDrawing; 
            document.getElementById('send-images-to-ai-switch').checked = runtime.state.globalSettings.sendImagesToAi === true;
            document.getElementById('chat-render-window-input').value = runtime.state.globalSettings.chatRenderWindow || 50;   
            document.getElementById('chat-list-render-window-input').value = runtime.state.globalSettings.chatListRenderWindow || 30;
            const tempSlider = document.getElementById('api-temperature-slider');
            const tempValue = document.getElementById('api-temperature-value');
            const savedTemp = runtime.state.globalSettings.apiTemperature ?? 0.8;
            tempSlider.value = savedTemp;
            tempValue.textContent = savedTemp;    
           document.getElementById('minimax-group-id').value = runtime.state.apiConfig.minimaxGroupId || '';
           document.getElementById('minimax-api-key').value = runtime.state.apiConfig.minimaxApiKey || '';
document.getElementById('minimax-model-select').value = runtime.state.apiConfig.minimaxModel || 'speech-01'; 
            
            // 加载NovelAI配置
            const novelaiEnabled = preferences.getItem('novelai-enabled') === 'true';
            const novelaiModel = preferences.getItem('novelai-model') || 'nai-diffusion-4-5-full';
            const novelaiApiKey = preferences.getItem('novelai-api-key') || '';
            document.getElementById('novelai-switch').checked = novelaiEnabled;
            document.getElementById('novelai-model').value = novelaiModel;
            document.getElementById('novelai-api-key').value = novelaiApiKey;
            document.getElementById('novelai-details').style.display = novelaiEnabled ? 'block' : 'none';
            
            loadApiPresetsDropdown();
           displayTotalImageSize();
        }

async function fetchModels(urlInputId, keyInputId, modelId) {
  const isGemini = text('api-provider') === 'gemini';
  const base = isGemini ? geminiModelsUrl : text(urlInputId);
  const key = document.getElementById(keyInputId).value.trim();
  if (!base || (isGemini && !key)) return showConnectionStatus('Enter the Base URL and API key first.');
  showConnectionStatus('Connecting…');

  try {
    const apiKey = key ? getRandomValue(key) : '';
    const endpoint = isGemini ? geminiModelsUrl : openAiUrl(base, 'models');
    const headers = isGemini ? { 'x-goog-api-key': apiKey } : apiKey ? { Authorization: 'Bearer ' + apiKey } : {};
    const response = await fetch(endpoint, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const names = isGemini ? data.models?.map(model => model.name?.replace(/^models\//, '')) :
      data.data?.map(model => model.id);
    if (!Array.isArray(names)) throw new Error('Invalid model list.');
    const models = [...new Set(names.filter(name => typeof name === 'string' && name.length))];
    const field = document.getElementById(modelId);
    const options = document.getElementById(`${modelId}-options`);
    options.replaceChildren(...models.map(name => {
      const option = document.createElement('option');
      option.value = name;
      return option;
    }));
    if (!field.value) field.value = models[0] ?? '';
    showConnectionStatus(models.length ? 'Connected. ' + models.length + ' models available.' : 'Connected. Enter a model ID manually.');
    if (models.length) field.focus();
  } catch (error) {
    showConnectionStatus('Failed to fetch models: ' + error.message);
  }
}

const field = id => document.getElementById(id)
const text = id => field(id).value.trim()

function showConnectionStatus(message) { field('api-connection-status').textContent = message; }
function numberField(id, min, max, fallback) {
  const value = Number(text(id));
  return text(id) && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
function updateProviderFields() {
  field('proxy-url').disabled = text('api-provider') === 'gemini';
}
function renderGenerationSettings() {
  const settings = generationSettings();
  const budget = contextConfig();
  field('api-context-size').value = budget.size;
  field('api-max-response').value = budget.response;
  field('api-top-p').value = settings.topP;
  field('api-frequency-penalty').value = settings.frequencyPenalty;
  field('api-presence-penalty').value = settings.presencePenalty;
  field('api-swipes').value = settings.swipes;
  field('api-streaming').checked = settings.streaming;
  updateProviderFields();
}
async function testApiConnection() {
  const button = field('test-api-connection-btn');
  button.disabled = true;
  showConnectionStatus('Testing model…');
  try {
    const provider = text('api-provider');
    const response = await sendCompletion([{ role: 'user', content: 'Reply with OK.' }], { connection: {
      provider, proxyUrl: provider === 'gemini' ? geminiModelsUrl : text('proxy-url'), apiKey: text('api-key'), model: text('model-select'),
    }, outputTokens: 16, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('HTTP ' + response.status);
    const result = await response.json();
    if (!result.choices?.length && !result.candidates?.length) throw Error('The model returned no completion.');
    showConnectionStatus('Connection successful.');
  } catch (error) { showConnectionStatus('Connection test failed: ' + error.message); }
  finally { button.disabled = false; }
}
export function bindApiSettingsEvents() {
  const save = field('save-api-settings-btn')
  save.addEventListener('click', async () => {
    const provider = text('api-provider');
    const proxyUrl = provider === 'gemini' ? geminiModelsUrl : text('proxy-url').replace(/\/+$/, '');
    try {
      if (proxyUrl && provider !== 'gemini') openAiUrl(proxyUrl, 'models');
    } catch {
      alert('Enter a valid HTTP or HTTPS base URL.')
      return
    }

    const apiConfig = {
      id: 'main',
      provider,
      proxyUrl,
      apiKey: text('api-key'),
      model: text('model-select'),
      minimaxGroupId: text('minimax-group-id'),
      minimaxApiKey: text('minimax-api-key'),
      minimaxModel: text('minimax-model-select'),
    }
    const globalSettings = {
      ...runtime.state.globalSettings,
      enableBackgroundActivity: field('background-activity-switch').checked,
      backgroundActivityInterval: Math.max(1, Number.parseInt(text('background-interval-input'), 10) || 60),
      blockCooldownHours: Math.max(0, Number.parseFloat(text('block-cooldown-input')) || 1),
      enableAiDrawing: field('enable-ai-drawing-switch').checked,
      sendImagesToAi: field('send-images-to-ai-switch').checked,
      chatRenderWindow: Math.max(1, Number.parseInt(text('chat-render-window-input'), 10) || 50),
      chatListRenderWindow: Math.max(1, Number.parseInt(text('chat-list-render-window-input'), 10) || 30),
      apiTemperature: numberField('api-temperature-slider', 0, 2, 0.8),
      apiTopP: numberField('api-top-p', 0, 1, 1),
      apiFrequencyPenalty: numberField('api-frequency-penalty', -2, 2, 0),
      apiPresencePenalty: numberField('api-presence-penalty', -2, 2, 0),
      apiSwipes: Math.trunc(numberField('api-swipes', 1, 5, 1)),
      apiStreaming: field('api-streaming').checked,
    }
    const size = Number(text('api-context-size'));
    const response = Number(text('api-max-response'));
    if (!Number.isInteger(size) || size < 1024 || size > 2000000 || !Number.isInteger(response) || response < 1 || response > size - 256) {
      showConnectionStatus('Enter a valid context size and leave at least 256 tokens for the prompt.');
      return;
    }
    const deviceSettings = [
      { id: 'novelai-enabled', value: String(field('novelai-switch').checked) },
      { id: 'novelai-model', value: text('novelai-model') },
      { id: 'novelai-api-key', value: text('novelai-api-key') },
    ]

    const db = runtime.db
    save.disabled = true
    try {
      await db.transaction('rw', db.apiConfig, db.globalSettings, db.deviceSettings, async tx => {
        await tx.apiConfig.put(apiConfig)
        await tx.globalSettings.put(globalSettings)
        await tx.deviceSettings.bulkPut(deviceSettings)
        await tx.deviceSettings.put({ id: contextKey, value: normalizeContext({ ...contextConfig(db), size, response }) })
      })
      Object.assign(runtime.state, { apiConfig, globalSettings })
      stopBackgroundSimulation()
      if (globalSettings.enableBackgroundActivity) startBackgroundSimulation()
      alert('API and background activity settings saved.')
    } catch {
      // The application displays storage errors when the transaction fails.
    } finally {
      save.disabled = false
    }
  })

  field('api-provider').addEventListener('change', updateProviderFields)
  field('test-api-connection-btn').addEventListener('click', testApiConnection)
  field('fetch-models-btn').addEventListener('click', () => {
    void fetchModels('proxy-url', 'api-key', 'model-select')
  })
}
