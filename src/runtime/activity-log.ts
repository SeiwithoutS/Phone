export function logActivity(action: 'completion' | 'bank.transfer' | 'backup.restore',
  result: 'ok' | 'failed', started?: number) {
  void fetch('/api/activity-log', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ action, result, milliseconds: started === undefined ? undefined : performance.now() - started }),
  }).catch(() => {})
}
