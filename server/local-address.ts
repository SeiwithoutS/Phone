export const loopbackAddress = '127.0.0.1'

export function localAddress() {
  const host = (process.env.EEPHONE_HOST || 'eephone.localhost').trim().toLowerCase()
  const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
  if (host.length > 253 || !new RegExp(`^${label}(?:\\.${label})*$`).test(host)) {
    throw new Error('EEPHONE_HOST must be a hostname without a scheme, port, or path.')
  }
  const port = Number(process.env.PORT ?? 8000)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be between 1 and 65535.')
  }
  return { host, port }
}
