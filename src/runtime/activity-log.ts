export function logActivity(action: 'completion' | 'bank.transfer' | 'backup.restore',
  result: 'ok' | 'failed', started?: number) {
  void fetch('/api/activity-log', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ action, result, milliseconds: started === undefined ? undefined : performance.now() - started }),
  }).catch(() => {})
}

type ConnectionEvent = {
  provider: 'gemini' | 'openai'
  status?: number
  detail?: string
} & ({ action: 'connection.test'; model: string; result: 'ok' | 'failed' } |
  { action: 'connection.models'; models?: string[]; result: 'ok' | 'failed' })

export function logConnectionActivity(event: ConnectionEvent) {
  const detail = event.detail && event.detail.length > 16000
    ? event.detail.slice(0, 16000) + '\n[Terminal output truncated]' : event.detail
  void fetch('/api/activity-log', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, detail }),
  }).catch(() => {})
}
