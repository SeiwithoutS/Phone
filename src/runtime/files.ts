export function fileDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function imageSource(value: unknown) {
  if (typeof value !== 'string') return ''
  const source = value.trim()
  if (/^data:image\/(?:png|apng|jpe?g|jfif|webp|gif|avif|bmp|x-icon);base64,[\da-z+/=\s]+$/i.test(source)) return source
  try {
    const url = new URL(source)
    return /^(https?):$/.test(url.protocol) ? url.href.replace(/'/g, '%27') : ''
  } catch {
    return ''
  }
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!)
}

export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = (name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 100) || 'export') + '.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
