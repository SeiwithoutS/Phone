export function openAiUrl(base: string, endpoint: 'chat/completions' | 'models') {
  const url = new URL(base)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an HTTP or HTTPS API base URL.')
  }
  const path = url.pathname.replace(/\/+$/, '').replace(/\/(?:chat\/completions|models)$/, '')
  url.pathname = `${path.endsWith('/v1') ? path : path + '/v1'}/${endpoint}`
  return url.toString()
}
