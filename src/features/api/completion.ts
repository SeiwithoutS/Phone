import { runtime } from '../../legacy/runtime/state.js'
import { getRandomValue } from '../../runtime/helpers'
import { assembleContext, chatContextScope, contextConfig, recordContext } from '../context/context'
import { openAiUrl } from './endpoints'
import { maySendImages } from './image-input'
import type { ContextInput } from '../context/context'
import type { PromptMessage } from '../context/budget'
import type { DirectChat, GroupChat } from '../chat/model'

export const geminiModelsUrl = 'https://generativelanguage.googleapis.com/v1beta/models'
export const usesGemini = (base?: string, provider?: string) =>
  provider === 'gemini' || (provider !== 'openai' && Boolean(base?.includes('generativelanguage.googleapis.com')))

export function streamingReplyText(raw: string) {
  const part = raw.trimStart().replace(/^```(?:json)?[ \t]*\r?\n/i, '').trimStart()
  if (!part || part.startsWith('```')) return ''
  if (!/^[\[{]/.test(part)) return part
  const textParts = part.split(/,\s*(?=\{\s*"type")/)
    .filter(block => /"type"\s*:\s*"(?:text|offline_text|quote_reply)"/.test(block))
  const texts = textParts.flatMap(block => [...block.matchAll(/"(?:content|message|reply_content)"\s*:\s*"((?:[^"\\]|\\.)*)/g)])
  return texts.map(match => {
    try { return JSON.parse('"' + match[1] + '"') as string }
    catch { return match[1] ?? '' }
  }).join('\n')
}

export function generationSettings() {
  const saved = runtime.state.globalSettings
  return {
    temperature: saved?.apiTemperature ?? 0.8,
    topP: saved?.apiTopP ?? 1,
    frequencyPenalty: saved?.apiFrequencyPenalty ?? 0,
    presencePenalty: saved?.apiPresencePenalty ?? 0,
    swipes: Math.max(1, Math.min(5, Math.trunc(saved?.apiSwipes ?? 1))),
    streaming: saved?.apiStreaming === true,
  }
}

type Connection = { proxyUrl?: string; apiKey?: string; model?: string; provider?: string }
type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } }
type CompletionOptions = {
  connection?: Connection; temperature?: number; onText?: (text: string) => void; signal?: AbortSignal; swipes?: boolean
  outputTokens?: number
}

export async function requestContextCompletion(chat: DirectChat | GroupChat | undefined, input: ContextInput, options: CompletionOptions = {}) {
  const scope = input.scope ?? (chat && chatContextScope(chat))
  const config = contextConfig()
  const requestOptions = { ...options, outputTokens: config.response }
  const plan = await assembleContext(chat, input, runtime.db, config)
  if (plan.error) throw new Error(plan.error)
  if (scope) recordContext(scope, plan, input.task ?? 'Chat completion')
  const primary = await sendCompletion(plan.messages, requestOptions)
  const count = options.swipes ? generationSettings().swipes - 1 : 0
  if (!primary.ok || !count) return primary
  const result = await primary.json()
  const alternatives = await Promise.allSettled(Array.from({ length: count }, async () => {
    const response = await sendCompletion(plan.messages, { ...requestOptions, onText: undefined, signal: options.signal ?? AbortSignal.timeout(60000) })
    return response.ok ? completionText(await response.json()) : undefined
  }))
  return Response.json({ ...result, eephoneAlternatives: alternatives.flatMap(alternative =>
    alternative.status === 'fulfilled' && alternative.value ? [alternative.value] : []) })
}

export function completionText(data: { choices?: Array<{ message?: { content?: string } }>; candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> }) {
  return data.choices?.[0]?.message?.content ?? data.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text ?? '').join('')
}

export async function sendCompletion(messages: PromptMessage[], options: CompletionOptions = {}) {
  const { proxyUrl, apiKey, model, provider } = options.connection ?? runtime.state.apiConfig ?? {}
  const gemini = usesGemini(proxyUrl, provider)
  if (!proxyUrl || !model || (gemini && !apiKey)) throw new Error('Configure the API connection and select a model.')
  const settings = generationSettings()
  const maxTokens = options.outputTokens ?? contextConfig().response
  const safeMessages = maySendImages() ? messages : messages.map(message => Array.isArray(message.content)
    ? { ...message, content: message.content.filter(part => part?.type === 'text').map(part => part.text).join('\n') || '[Attachment]' }
    : message)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = apiKey ? getRandomValue(apiKey) : ''
  let url: string
  let body: object
  if (gemini) {
    url = geminiModelsUrl + '/' + encodeURIComponent(model.replace(/^models\//, '')) +
      (settings.streaming ? ':streamGenerateContent?alt=sse' : ':generateContent')
    headers['x-goog-api-key'] = key
    const system = safeMessages.filter(message => message.role === 'system').map(message => String(message.content)).join('\n\n')
    const contents = safeMessages.filter(message => message.role !== 'system').flatMap(message => {
      const parts = Array.isArray(message.content) ? message.content.flatMap<GeminiPart>(part => {
        if (part?.type === 'text') return [{ text: String(part.text) }]
        const source = part?.image_url?.url
        const inline = maySendImages() && typeof source === 'string' && source.match(/^data:(image\/[^;,]+);base64,(.+)$/s)
        return inline ? [{ inline_data: { mime_type: inline[1], data: inline[2] } }] : []
      }) : [{ text: String(message.content) }]
      return parts.length ? [{ role: message.role === 'assistant' || message.role === 'ai' ? 'model' : 'user', parts }] : []
    })
    if (!contents.length) contents.push({ role: 'user', parts: [{ text: 'Respond using the instructions above.' }] })
    body = { system_instruction: { parts: [{ text: system }] }, contents,
      generationConfig: { temperature: options.temperature ?? settings.temperature, topP: settings.topP, maxOutputTokens: maxTokens,
        frequencyPenalty: settings.frequencyPenalty, presencePenalty: settings.presencePenalty } }
  } else {
    url = openAiUrl(proxyUrl, 'chat/completions')
    if (key) headers.Authorization = 'Bearer ' + key
    body = { model, messages: safeMessages, max_tokens: maxTokens, temperature: options.temperature ?? settings.temperature, top_p: settings.topP,
      frequency_penalty: settings.frequencyPenalty, presence_penalty: settings.presencePenalty, stream: settings.streaming }
  }
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: options.signal })
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream') || !response.body) return response
  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let pending = ''
  let result = ''
  function consume(line: string) {
    if (!line.startsWith('data:')) return
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') return
    const chunk = JSON.parse(data)
    if (chunk.error) throw new Error(chunk.error.message || 'The streaming API returned an error.')
    const text = gemini ? chunk.candidates?.[0]?.content?.parts?.filter((part: { thought?: boolean }) => !part.thought)
      .map((part: { text?: string }) => part.text || '').join('') : chunk.choices?.[0]?.delta?.content
    if (typeof text === 'string' && text) { result += text; options.onText?.(result) }
  }
  try {
    for (;;) {
      const { done, value } = await reader.read()
      pending += decoder.decode(value, { stream: !done })
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      lines.forEach(consume)
      if (done) break
    }
    consume(pending)
  } finally { reader.releaseLock() }
  return Response.json({ choices: [{ message: { content: result } }] })
}
