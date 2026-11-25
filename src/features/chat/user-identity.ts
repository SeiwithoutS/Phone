type UserIdentity = { myNickname?: string; characterNickname?: string; myPersona?: string }
type IdentityMessage = { role?: string; type?: string; content?: unknown; timestamp?: number }

export function describeUserIdentity(settings: UserIdentity) {
  const nickname = settings.characterNickname?.trim()
  return [
    `The user's display name is “${settings.myNickname?.trim() || 'You'}”.`,
    nickname ? `Your nickname for the user in this chat is “${nickname}”.` : 'You have no separate nickname for the user in this chat.',
  ].join(' ')
}

export function changeCharacterNickname(chat: { name: string; isGroup?: boolean; settings: UserIdentity }, value: unknown, timestamp: number) {
  const nickname = typeof value === 'string' ? value.trim() : ''
  if (chat.isGroup || !nickname || nickname === chat.settings.characterNickname) return

  chat.settings.characterNickname = nickname
  return [
    { role: 'system', type: 'pat_message', content: `“${chat.name}” changed your nickname to “${nickname}”`, timestamp },
    { role: 'system', content: `[System notice: You changed the user's nickname to "${nickname}".]`, timestamp: timestamp + 1, isHidden: true },
  ] as const
}

export function recoverLegacyNickname(settings: UserIdentity,
  history: ReadonlyArray<IdentityMessage>,
  personas: ReadonlyArray<{ name?: string; persona?: string }>,
  archives: ReadonlyArray<{ history?: ReadonlyArray<IdentityMessage> }> = []) {
  const { myNickname, myPersona } = settings
  if (settings.characterNickname !== undefined || !myNickname || !myPersona?.trim()) return

  let previousNickname: string | undefined
  let previousTime = -Infinity
  for (const session of [...archives, { history }]) {
    for (const message of session.history ?? []) {
      if (message.role !== 'system' || message.type !== 'pat_message' || typeof message.content !== 'string') continue
      const time = message.timestamp ?? 0
      if (time < previousTime) continue
      const match = /^[“"].+?[”"] (?:changed your nickname to|将对你的称呼修改为) [“"]([\s\S]*)[”"]$/.exec(message.content)
      if (match) {
        previousNickname = match[1]
        previousTime = time
      }
    }
  }
  if (previousNickname !== myNickname) return

  const names = new Set(personas.filter(persona => persona.persona === myPersona).map(persona => persona.name?.trim()).filter(Boolean))
  const [displayName] = names
  if (names.size === 1 && displayName && displayName !== myNickname) {
    return { myNickname: displayName, characterNickname: myNickname }
  }
}
