interface SharedArticle {
  type: 'share_link'
  timestamp: number
  title?: string
  description?: string
  source_name?: string
  content?: string
}

interface SharedHistory {
  type: 'share_card'
  timestamp: number
  payload: { title: string; sharedHistory: unknown[] }
}

export function findArticle(chat: unknown, timestamp: number): SharedArticle | undefined {
  if (!chat || typeof chat !== 'object' || !('history' in chat) || !Array.isArray(chat.history)) return
  return chat.history.find((item): item is SharedArticle =>
    item?.type === 'share_link' && item.timestamp === timestamp &&
    ['title', 'source_name', 'content'].every(key => item[key] == null || typeof item[key] === 'string'))
}

// The chat renderer accepts HTML. Assign all imported text through the DOM before serializing.
export function sharedCardHtml(message: SharedArticle | SharedHistory) {
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'link-share-card phone-button text-left'
  card.dataset.timestamp = String(message.timestamp)
  card.dataset.kind = message.type
  const title = document.createElement('div')
  title.className = 'title'
  const description = document.createElement('div')
  description.className = 'description'
  const footer = document.createElement('div')
  footer.className = 'footer'
  if (message.type === 'share_link') {
    title.textContent = message.title || 'Untitled article'
    description.textContent = message.description || 'Read article'
    footer.textContent = message.source_name || 'Article'
  } else {
    title.textContent = message.payload.title
    description.textContent = `${message.payload.sharedHistory.length} messages`
    footer.textContent = 'Chat History'
  }
  card.append(title, description, footer)
  return card.outerHTML
}
