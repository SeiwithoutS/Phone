const binaryTag = '$eephoneBinary'

const encodeBytes = (bytes: Uint8Array & { toBase64?: () => string }) => {
  if (bytes.toBase64) return bytes.toBase64()
  const parts = []
  for (let index = 0; index < bytes.length; index += 8192) {
    parts.push(String.fromCharCode(...bytes.subarray(index, index + 8192)))
  }
  return btoa(parts.join(''))
}
function decodeBytes(text: string) {
  const codec: Uint8ArrayConstructor & { fromBase64?: (text: string) => Uint8Array<ArrayBuffer> } = Uint8Array
  return codec.fromBase64 ? codec.fromBase64(text) : Uint8Array.from(atob(text), char => char.charCodeAt(0))
}

export async function encodePortable(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    return {
      [binaryTag]: 'blob',
      type: value.type,
      data: encodeBytes(new Uint8Array(await value.arrayBuffer())),
    }
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    return { [binaryTag]: 'buffer', data: encodeBytes(bytes) }
  }
  if (value instanceof Date) return { [binaryTag]: 'date', data: value.toISOString() }
  if (Array.isArray(value)) return Promise.all(value.map(encodePortable))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) =>
      [key, await encodePortable(item)])))
  }
  return value
}

export function decodePortable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodePortable)
  if (value !== null && typeof value === 'object') {
    const record: Record<string, unknown> = Object.fromEntries(Object.entries(value))
    if (typeof record.data === 'string') {
      if (record[binaryTag] === 'blob') return new Blob([decodeBytes(record.data)], { type: typeof record.type === 'string' ? record.type : '' })
      if (record[binaryTag] === 'buffer') return decodeBytes(record.data).buffer
      if (record[binaryTag] === 'date') return new Date(record.data)
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodePortable(item)]))
  }
  return value
}
