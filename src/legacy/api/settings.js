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

function presetMatches(preset, connection, settings, budget) {
  const { generation } = preset
  return ['apiKey', 'proxyUrl', 'model'].every(key => (preset[key] ?? '') === (connection[key] ?? '')) &&
    usesGemini(preset.proxyUrl, preset.provider) === usesGemini(connection.proxyUrl, connection.provider) &&
    (preset.sendImagesToAi ?? settings.sendImagesToAi ?? false) === (settings.sendImagesToAi ?? false) &&
    (!generation || (generation.size === budget.size && generation.response === budget.response &&
      Object.entries(generation).every(([key, value]) => key === 'size' || key === 'response' || settings[key] === value)))
}

async function loadApiPresetsDropdown(preferredId) {
  const select = field('api-preset-select')
  const presets = await runtime.db.apiPresets.toArray()
  const { apiConfig, globalSettings } = runtime.state
  const budget = contextConfig()
  const matches = preset => presetMatches(preset, apiConfig, globalSettings, budget)
  const selected = preferredId ?? presets.find(preset => preset.id === apiConfig.presetId && matches(preset))?.id ??
    presets.find(matches)?.id
  const current = new Option('Current settings', '')
  select.replaceChildren(current, ...presets.map(preset => new Option(preset.name, String(preset.id))))
  select.value = selected === undefined ? '' : String(selected)
  updatePresetButtons()
}

function updatePresetButtons() {
  const hasPreset = Boolean(field('api-preset-select').value)
  field('save-api-preset-btn').disabled = !hasPreset
  field('delete-api-preset-btn').disabled = !hasPreset
}

async function handlePresetSelectionChange() {
  if (!text('api-preset-select')) {
    renderConnectionSettings()
    return
  }
  const preset = await runtime.db.apiPresets.get(Number(text('api-preset-select')))
  if (!preset) return
  const provider = usesGemini(preset.proxyUrl, preset.provider) ? 'gemini' : 'openai'
  const { size, response, apiTemperature, apiTopP, apiFrequencyPenalty, apiPresencePenalty, apiSwipes, apiStreaming } = preset.generation ?? {}
  const db = runtime.db
  await db.transaction('rw', db.apiConfig, db.globalSettings, db.deviceSettings, async tx => {
    const apiConfig = {
      ...(await tx.apiConfig.get('main') ?? runtime.state.apiConfig),
      id: 'main', presetId: preset.id, provider,
      proxyUrl: provider === 'gemini' ? geminiModelsUrl : (preset.proxyUrl ?? ''),
      apiKey: preset.apiKey ?? '', model: preset.model ?? '',
    }
    await tx.apiConfig.put(apiConfig)
    if (preset.generation || typeof preset.sendImagesToAi === 'boolean') {
      const settings = await tx.globalSettings.get('main') ?? runtime.state.globalSettings
      await tx.globalSettings.put({
        ...settings,
        apiTemperature: apiTemperature ?? settings.apiTemperature,
        apiTopP: apiTopP ?? settings.apiTopP,
        apiFrequencyPenalty: apiFrequencyPenalty ?? settings.apiFrequencyPenalty,
        apiPresencePenalty: apiPresencePenalty ?? settings.apiPresencePenalty,
        apiSwipes: apiSwipes ?? settings.apiSwipes,
        apiStreaming: apiStreaming ?? settings.apiStreaming,
        sendImagesToAi: preset.sendImagesToAi ?? settings.sendImagesToAi,
      })
    }
    if (preset.generation) {
      const context = normalizeContext((await tx.deviceSettings.get(contextKey))?.value)
      await tx.deviceSettings.put({ id: contextKey, value: normalizeContext({ ...context, size: size ?? context.size, response: response ?? context.response }) })
    }
  })
  runtime.state.apiConfig = await db.apiConfig.get('main')
  runtime.state.globalSettings = await db.globalSettings.get('main') ?? runtime.state.globalSettings
  renderConnectionSettings()
}

async function createApiPreset() {
  const preset = readPresetFields()
  if (!preset) return
  const name = (await showCustomPrompt('New API Preset', 'Enter a preset name'))?.trim()
  if (!name) return
  const existing = await runtime.db.apiPresets.where('name').equals(name).first()
  if (existing) return showPresetStatus('That preset name already exists. Select it to save changes.')
  const id = await runtime.db.apiPresets.add({ name, ...preset })
  await loadApiPresetsDropdown(id)
  showPresetStatus('API preset created.')
}

async function saveApiPreset() {
  const id = Number(text('api-preset-select'))
  const preset = readPresetFields()
  if (!id || !preset) return
  const existing = await runtime.db.apiPresets.get(id)
  if (!existing) return
  await runtime.db.apiPresets.put({ id, name: existing.name, ...preset })
  showPresetStatus('API preset saved.')
}

async function deleteApiPreset() {
  const id = Number(text('api-preset-select'))
  const preset = await runtime.db.apiPresets.get(id)
  if (!preset || !await showCustomConfirm('Delete Preset', 'Delete preset “' + preset.name + '”?', { confirmButtonClass: 'btn-danger' })) return
  await runtime.db.apiPresets.delete(id)
  await loadApiPresetsDropdown()
  showPresetStatus('API preset deleted.')
}

function renderConnectionSettings() {
  resetModelList()
  const connection = runtime.state.apiConfig
  field('proxy-url').value = connection.proxyUrl || ''
  field('api-provider').value = usesGemini(connection.proxyUrl, connection.provider) ? 'gemini' : 'openai'
  field('api-key').value = connection.apiKey || ''
  field('model-select').value = connection.model ?? ''
  field('send-images-to-ai-switch').checked = runtime.state.globalSettings.sendImagesToAi === true
  renderGenerationSettings()
}

export function renderApiSettings() {
            renderConnectionSettings();
            showPresetStatus('');
            document.getElementById('background-activity-switch').checked = runtime.state.globalSettings.enableBackgroundActivity || false;
            document.getElementById('background-interval-input').value = runtime.state.globalSettings.backgroundActivityInterval || 60;
            document.getElementById('block-cooldown-input').value = runtime.state.globalSettings.blockCooldownHours || 1;
            document.getElementById('enable-ai-drawing-switch').checked = runtime.state.globalSettings.enableAiDrawing; 
            document.getElementById('chat-render-window-input').value = runtime.state.globalSettings.chatRenderWindow || 50;   
            document.getElementById('chat-list-render-window-input').value = runtime.state.globalSettings.chatListRenderWindow || 30;
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
function showPresetStatus(message) { field('api-preset-status').textContent = message; }
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
  field('api-temperature-slider').value = settings.temperature;
  field('api-temperature-value').textContent = field('api-temperature-slider').value;
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
function readPresetFields(report = showPresetStatus) {
  const provider = text('api-provider')
  const proxyUrl = provider === 'gemini' ? geminiModelsUrl : text('proxy-url').replace(/\/+$/, '')
  try {
    if (proxyUrl && provider !== 'gemini') openAiUrl(proxyUrl, 'models')
  } catch {
    report('Enter a valid HTTP or HTTPS base URL.')
    return
  }
  const size = Number(text('api-context-size'))
  const response = Number(text('api-max-response'))
  if (!Number.isInteger(size) || size < 1024 || size > 2000000 || !Number.isInteger(response) || response < 1 || response > size - 256) {
    report('Enter a valid context size and leave at least 256 tokens for the prompt.')
    return
  }
  return {
    provider, proxyUrl, apiKey: text('api-key'), model: text('model-select'),
    sendImagesToAi: field('send-images-to-ai-switch').checked,
    generation: {
      size, response,
      apiTemperature: numberField('api-temperature-slider', 0, 2, 0.8),
      apiTopP: numberField('api-top-p', 0, 1, 1),
      apiFrequencyPenalty: numberField('api-frequency-penalty', -2, 2, 0),
      apiPresencePenalty: numberField('api-presence-penalty', -2, 2, 0),
      apiSwipes: Math.trunc(numberField('api-swipes', 1, 5, 1)),
      apiStreaming: field('api-streaming').checked,
    },
  }
}

export function bindApiSettingsEvents() {
  const save = field('save-api-settings-btn')
  const presetSelect = field('api-preset-select')
  const create = field('create-api-preset-btn')
  const presetSave = field('save-api-preset-btn')
  const remove = field('delete-api-preset-btn')
  const presetControls = [presetSelect, create, presetSave, remove]
  const bindPresetAction = (element, event, action) => element.addEventListener(event, async () => {
    showPresetStatus('')
    for (const control of [...presetControls, save]) control.disabled = true
    try {
      await action()
    } catch {
      await loadApiPresetsDropdown()
      showPresetStatus('Could not update API presets.')
    } finally {
      for (const control of [...presetControls, save]) control.disabled = false
      updatePresetButtons()
    }
  })
  bindPresetAction(presetSelect, 'change', handlePresetSelectionChange)
  bindPresetAction(create, 'click', createApiPreset)
  bindPresetAction(presetSave, 'click', saveApiPreset)
  bindPresetAction(remove, 'click', deleteApiPreset)

  save.addEventListener('click', async () => {
    const preset = readPresetFields(message => {
      showConnectionStatus(message)
      alert(message)
    })
    if (!preset) return
    const { generation: { size, response, ...generation }, sendImagesToAi, ...connection } = preset
    const apiConfig = {
      id: 'main',
      presetId: Number(presetSelect.value) || undefined,
      ...connection,
      minimaxGroupId: text('minimax-group-id'),
      minimaxApiKey: text('minimax-api-key'),
      minimaxModel: text('minimax-model-select'),
    }
    const globalSettings = {
      enableBackgroundActivity: field('background-activity-switch').checked,
      backgroundActivityInterval: Math.max(1, Number.parseInt(text('background-interval-input'), 10) || 60),
      blockCooldownHours: Math.max(0, Number.parseFloat(text('block-cooldown-input')) || 1),
      enableAiDrawing: field('enable-ai-drawing-switch').checked,
      chatRenderWindow: Math.max(1, Number.parseInt(text('chat-render-window-input'), 10) || 50),
      chatListRenderWindow: Math.max(1, Number.parseInt(text('chat-list-render-window-input'), 10) || 30),
      ...generation,
      sendImagesToAi,
    }
    const deviceSettings = [
      { id: 'novelai-enabled', value: String(field('novelai-switch').checked) },
      { id: 'novelai-model', value: text('novelai-model') },
      { id: 'novelai-api-key', value: text('novelai-api-key') },
    ]

    const db = runtime.db
    save.disabled = true
    for (const control of presetControls) control.disabled = true
    try {
      await db.transaction('rw', db.apiConfig, db.globalSettings, db.deviceSettings, async tx => {
        await tx.apiConfig.put(apiConfig)
        const current = await tx.globalSettings.get('main') ?? runtime.state.globalSettings
        await tx.globalSettings.put({ ...current, ...globalSettings })
        await tx.deviceSettings.bulkPut(deviceSettings)
        const context = normalizeContext((await tx.deviceSettings.get(contextKey))?.value)
        await tx.deviceSettings.put({ id: contextKey, value: normalizeContext({ ...context, size, response }) })
      })
      runtime.state.apiConfig = apiConfig
      runtime.state.globalSettings = await db.globalSettings.get('main')
      stopBackgroundSimulation()
      if (globalSettings.enableBackgroundActivity) startBackgroundSimulation()
      alert('API and background activity settings saved.')
    } catch {
      // The application displays storage errors when the transaction fails.
    } finally {
      save.disabled = false
      for (const control of presetControls) control.disabled = false
      updatePresetButtons()
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
  field('api-temperature-slider').addEventListener('input', event => {
    field('api-temperature-value').textContent = event.target.value
  })
  field('test-api-connection-btn').addEventListener('click', testApiConnection)
  field('fetch-models-btn').addEventListener('click', fetchModels)
}
