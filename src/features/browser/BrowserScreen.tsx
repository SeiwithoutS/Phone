import { generatePath, useLocation, useNavigate } from 'react-router-dom'
import { screenPaths } from '../../app/routes'
import { BackButton, Screen, ScreenHeader } from '../../components/phone'
import { runtime } from '../../legacy/runtime/state.js'

import { findArticle } from '../chat/shared-cards'

export function BrowserScreen() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const chatId = typeof state?.chatId === 'string' ? state.chatId : undefined
  const article = chatId ? findArticle(runtime.state.chats[chatId], state.timestamp) : undefined
  const backPath = chatId ? generatePath(screenPaths['chat-interface-screen'], { chatId: encodeURIComponent(chatId) })
    : screenPaths['chat-list-screen']

  return (
    <Screen id="browser-screen">
      <ScreenHeader>
        <BackButton id="browser-back-btn" onClick={() => void navigate(backPath)}>‹</BackButton>
        <span id="browser-title">{article?.source_name || 'Article Details'}</span>
        <span className="w-[30px]" />
      </ScreenHeader>
      <div id="browser-content" className="list-container">
        {article ? <>
          <h1 className="article-title">{article.title || 'Untitled article'}</h1>
          <div className="article-meta">Source: {article.source_name || 'Unknown'}</div>
          <div className="article-body">
            {(article.content || 'No article content.').split(/\r?\n/).map((line, index) => <p key={index}>{line}</p>)}
          </div>
        </> : <p>This shared article is unavailable.</p>}
      </div>
    </Screen>
  )
}
