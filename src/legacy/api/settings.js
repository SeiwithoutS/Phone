import { startBackgroundSimulation, stopBackgroundSimulation } from '../npc/simulation.js'
import { openAiUrl } from '../../features/api/endpoints'
import { contextConfig } from '../../features/context/context'
import { contextKey, normalizeContext } from '../../features/context/budget'
import { completionText, geminiModelsUrl, generationSettings, sendCompletion, usesGemini } from '../../features/api/completion'
import { preferences } from '../storage/preferences.js'
import { displayTotalImageSize } from '../backup/media.js'
import { showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { logConnectionActivity } from '../../runtime/activity-log'
import { escapeHtml } from '../../runtime/files'
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
            resetModelList();
            
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

let modelRequest;

function resetModelList() {
  modelRequest?.abort();
  modelRequest = undefined;
  const select = field('api-external-models');
  select.replaceChildren(select.options[0]);
  select.value = '';
  field('api-external-model-field').hidden = true;
  field('fetch-models-btn').disabled = false;
  showConnectionStatus('');
}

function syncModelSelect() {
  const select = field('api-external-models');
  select.value = text('model-select');
  if (select.selectedIndex < 0) select.value = '';
}

function redactConnectionKeys(value, keys) {
  for (const key of keys.split(',').map(part => part.trim()).filter(Boolean)) {
    for (const form of new Set([key, JSON.stringify(key).slice(1, -1)])) {
      value = value.replaceAll(form, '[redacted]');
    }
  }
  return value;
}

function formatProviderBody(value, keys) {
  const body = redactConnectionKeys(value, keys);
  try { return redactConnectionKeys(JSON.stringify(JSON.parse(body), null, 2), keys); }
  catch { return body; }
}

async function fetchModels() {
  const isGemini = text('api-provider') === 'gemini';
  const provider = isGemini ? 'gemini' : 'openai';
  const base = text('proxy-url');
  const key = text('api-key');
  if (isGemini && !key) return showConnectionStatus('Enter your Gemini API key first.');
  if (!isGemini && !base) return showConnectionStatus('Enter the Base URL first.');
  resetModelList();
  const request = new AbortController();
  modelRequest = request;
  field('fetch-models-btn').disabled = true;
  showConnectionStatus('Fetching models...');

  let status;
  let providerBody;
  try {
    const apiKey = key ? getRandomValue(key) : '';
    const endpoint = isGemini ? geminiModelsUrl : openAiUrl(base, 'models');
    const headers = isGemini ? { 'x-goog-api-key': apiKey } : apiKey ? { Authorization: 'Bearer ' + apiKey } : {};
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)]);
    const models = new Set();
    const pageTokens = new Set();
    let pageToken = '';
    do {
      const url = new URL(endpoint);
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const response = await fetch(url.href, { headers, signal });
      status = response.status;
      const body = await response.text();
      if (!response.ok) {
        providerBody = body;
        throw new Error('HTTP ' + status);
      }
      let data;
      try { data = JSON.parse(body); }
      catch { providerBody = body; throw new Error('The provider returned invalid JSON.'); }
      const entries = isGemini ? data?.models : data?.data;
      if (!Array.isArray(entries)) { providerBody = body; throw new Error('Invalid model list.'); }
      for (const entry of entries) {
        if (!entry || (isGemini && Array.isArray(entry.supportedGenerationMethods) &&
          !entry.supportedGenerationMethods.includes('generateContent'))) continue;
        const id = isGemini ? entry.name : entry.id;
        if (typeof id === 'string' && id.trim()) models.add(isGemini ? id.trim().replace(/^models\//, '') : id.trim());
      }
      pageToken = isGemini && typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
      if (pageTokens.has(pageToken)) break;
      pageTokens.add(pageToken);
    } while (pageToken);
    if (modelRequest !== request) return;
    const select = field('api-external-models');
    const ids = [...models].sort((a, b) => a.localeCompare(b));
    for (const id of ids) select.add(new Option(id, id));
    syncModelSelect();
    field('api-external-model-field').hidden = !models.size;
    showConnectionStatus(models.size ? models.size + ' models available. Open Model to choose one.' : 'No models returned. Enter a model ID manually.');
    logConnectionActivity({ action: 'connection.models', provider, status, result: 'ok', models: ids.map(id => redactConnectionKeys(id, key)) });
  } catch (error) {
    if (modelRequest === request) {
      const reason = error.name === 'TimeoutError' ? 'Request timed out.' : redactConnectionKeys(error.message, key);
      showConnectionStatus('Could not fetch models. ' + reason + ' You can enter a model ID manually.');
      logConnectionActivity({ action: 'connection.models', provider, status, result: 'failed',
        detail: providerBody ? reason + '\n' + formatProviderBody(providerBody, key) : reason });
    }
  } finally {
    if (modelRequest === request) {
      modelRequest = undefined;
      field('fetch-models-btn').disabled = false;
    }
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
  const provider = text('api-provider') === 'gemini' ? 'gemini' : 'openai';
  const proxyUrl = provider === 'gemini' ? geminiModelsUrl : text('proxy-url');
  const apiKey = text('api-key');
  const model = text('model-select');
  button.disabled = true;
  showConnectionStatus('Testing model…');
  let status;
  let statusText;
  let responseBody;
  let reason;
  try {
    const response = await sendCompletion([{ role: 'user', content: 'Reply with OK.' }], {
      connection: { provider, proxyUrl, apiKey, model }, outputTokens: 16, signal: AbortSignal.timeout(15000),
      onResponse: received => {
        status = received.status;
        statusText = redactConnectionKeys(received.statusText, apiKey);
        responseBody = received.clone().text().catch(() => undefined);
      },
    });
    if (!response.ok) throw new Error('HTTP ' + response.status + (statusText ? ' ' + statusText : ''));
    let data;
    try { data = await response.json(); }
    catch { throw new Error('The provider did not return valid JSON or the response was interrupted.'); }
    if (!completionText(data ?? {})?.trim()) throw new Error('The model returned no reply text.');
  } catch (error) {
    reason = error.name === 'TimeoutError' ? 'Request timed out.' : redactConnectionKeys(error.message, apiKey);
  }
  const raw = await responseBody;
  const body = raw ? formatProviderBody(raw, apiKey) : status ?
    (raw === '' ? 'The response body was empty.' : 'The response body could not be read.') : 'No HTTP response was available to the browser.';
  const summary = reason ? 'Connection test failed: ' + reason : 'Connection successful.';
  const heading = status && !reason?.startsWith('HTTP ') ? 'HTTP ' + status + (statusText ? ' ' + statusText : '') + '\n' + summary : summary;
  showConnectionStatus(summary);
  logConnectionActivity({ action: 'connection.test', provider, model: redactConnectionKeys(model, apiKey), status,
    result: reason ? 'failed' : 'ok', detail: (reason ? reason + '\n' : '') + body });
  button.disabled = false;
  void showCustomAlert('Test Message', escapeHtml(heading) + '<pre class="api-test-response">' + escapeHtml(body) + '</pre>');
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

  field('api-provider').addEventListener('change', () => {
    updateProviderFields()
    resetModelList()
  })
  for (const id of ['proxy-url', 'api-key']) field(id).addEventListener('input', resetModelList)
  field('api-external-models').addEventListener('change', event => {
    field('model-select').value = event.target.value
  })
  field('model-select').addEventListener('input', syncModelSelect)
  field('test-api-connection-btn').addEventListener('click', testApiConnection)
  field('fetch-models-btn').addEventListener('click', fetchModels)
}
