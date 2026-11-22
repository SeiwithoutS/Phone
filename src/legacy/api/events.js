import { fetchModels } from './settings.js'
import { openAiUrl } from '../../features/api/endpoints'
import { startBackgroundSimulation, stopBackgroundSimulation } from '../npc/simulation.js'
import { runtime } from '../runtime/state.js'

const field = id => document.getElementById(id)
const text = id => field(id).value.trim()

export function bindApiSettingsEvents() {
  const save = field('save-api-settings-btn')
  save.addEventListener('click', async () => {
    const proxyUrl = text('proxy-url').replace(/\/+$/, '')
    const secondaryProxyUrl = text('secondary-proxy-url').replace(/\/+$/, '')
    try {
      for (const url of [proxyUrl, secondaryProxyUrl]) {
        if (url && url !== runtime.GEMINI_API_URL) openAiUrl(url, 'models')
      }
    } catch {
      alert('Enter a valid HTTP or HTTPS base URL.')
      return
    }

    const apiConfig = {
      ...runtime.state.apiConfig,
      proxyUrl,
      apiKey: text('api-key'),
      model: text('model-select'),
      minimaxGroupId: text('minimax-group-id'),
      minimaxApiKey: text('minimax-api-key'),
      minimaxModel: text('minimax-model-select'),
      secondaryProxyUrl,
      secondaryApiKey: text('secondary-api-key'),
      secondaryModel: text('secondary-model-select'),
    }
    const globalSettings = {
      ...runtime.state.globalSettings,
      enableBackgroundActivity: field('background-activity-switch').checked,
      backgroundActivityInterval: Math.max(1, Number.parseInt(text('background-interval-input'), 10) || 60),
      blockCooldownHours: Math.max(0, Number.parseFloat(text('block-cooldown-input')) || 1),
      enableAiDrawing: field('enable-ai-drawing-switch').checked,
      chatRenderWindow: Math.max(1, Number.parseInt(text('chat-render-window-input'), 10) || 50),
      chatListRenderWindow: Math.max(1, Number.parseInt(text('chat-list-render-window-input'), 10) || 30),
      apiTemperature: Number.parseFloat(text('api-temperature-slider')),
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

  field('fetch-models-btn').addEventListener('click', () => {
    void fetchModels('proxy-url', 'api-key', 'model-select')
  })
  field('fetch-secondary-models-btn').addEventListener('click', () => {
    void fetchModels('secondary-proxy-url', 'secondary-api-key', 'secondary-model-select')
  })
}
