import { runtime } from '../runtime/state.js'

const pending = new Map()
const writes = new Map()

function save(id, value) {
  const db = runtime.db
  pending.set(id, value)
  const promise = value === null ? db.deviceSettings.delete(id) : db.deviceSettings.put({ id, value })
  writes.set(id, promise)
  function clear() {
    if (writes.get(id) === promise) {
      writes.delete(id)
      pending.delete(id)
    }
  }
  void promise.then(clear, clear)
}

export const preferences = {
  getItem(id) { return pending.has(id) ? pending.get(id) : runtime.db.getPreference(id) },
  setItem(id, value) { save(id, String(value)) },
  removeItem(id) { save(id, null) },
}
