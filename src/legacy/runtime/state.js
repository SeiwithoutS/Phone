

// Shared browser state used by the feature modules.
export const runtime = {
  state: {
    /** @type {Record<string, unknown>} */
    chats: {},
    /** @type {string | null} */
    activeChatId: null,
  },
  activeShoppingCategoryId: 'all',
  allFavoriteItems: [],
}

// DOM references shared by related startup handlers.
export const controls = {}
