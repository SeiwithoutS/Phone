interface ImportedBook { [field: string]: unknown; content?: unknown }

function hasEntryText(entry: unknown): entry is Record<string, unknown> & { content: string } {
  return typeof entry === 'object' && entry !== null && 'content' in entry && typeof entry.content === 'string'
}

export function normalizeWorldInfo<T extends ImportedBook>(book: T): T {
  if (typeof book.content === 'string') {
    book.content = book.content.trim()
      ? [{ keys: [], comment: 'Migrated entry', content: book.content, enabled: true }]
      : []
  } else {
    const entries: unknown[] = Array.isArray(book.content) ? book.content : []
    book.content = entries.filter(hasEntryText).map(entry => ({
      ...entry,
      enabled: entry.enabled === undefined ? true : entry.enabled,
    }))
  }
  return book
}
