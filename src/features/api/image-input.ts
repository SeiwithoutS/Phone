import { runtime } from '../../legacy/runtime/state.js'

export function maySendImages() {
  return runtime.state.globalSettings?.sendImagesToAi === true
}

export function photoPromptContent(prefix: string, description: unknown, images: unknown[]) {
  const caption = typeof description === 'string' && description.trim()
    ? 'Photo description: ' + description.trim() : '[Photo attached]'
  const text = prefix + caption
  if (!maySendImages()) return text
  return [{ type: 'text', text }, ...images]
}
