import { useEffect, useRef, useState } from 'react'
import { CometChat } from '@cometchat-pro/chat'
import './App.css'

const APP_ID = import.meta.env.VITE_COMETCHAT_APP_ID ?? ''
const REGION = import.meta.env.VITE_COMETCHAT_REGION ?? ''
const AUTH_KEY = import.meta.env.VITE_COMETCHAT_AUTH_KEY ?? ''
const USER_ID = import.meta.env.VITE_COMETCHAT_USER_ID ?? 'cometchat-uid-4'
const USER_NAME = import.meta.env.VITE_COMETCHAT_USER_NAME ?? 'cometchat-uid-5'
const DEFAULT_PEER_ID = import.meta.env.VITE_COMETCHAT_PEER_ID ?? 'superhero2'
const MESSAGE_LISTENER_ID = 'cometchat-demo-listener'

const isConfigured = () => {
  const values = [APP_ID, REGION, AUTH_KEY, USER_ID]
  return values.every(Boolean) && values.every((value) => !value.includes('YOUR_'))
}

function App() {
  const [initializing, setInitializing] = useState(true)
  const [connectedUser, setConnectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [peerId, setPeerId] = useState(DEFAULT_PEER_ID)
  const [peerDraftId, setPeerDraftId] = useState(DEFAULT_PEER_ID)
  const [status, setStatus] = useState('Starting chat...')
  const [error, setError] = useState('')
  const messageEndRef = useRef(null)

  useEffect(() => {
    if (!isConfigured()) {
      setStatus('Missing CometChat configuration. Add VITE_COMETCHAT_* values to .env')
      setInitializing(false)
      return
    }

    const appSettings = new CometChat.AppSettingsBuilder()
      .subscribePresenceForAllUsers()
      .setRegion(REGION)
      .build()

    CometChat.init(APP_ID, appSettings)
      .then(() => CometChat.login(USER_ID, AUTH_KEY))
      .then((user) => {
        setConnectedUser(user)
        setStatus(`Logged in as ${user.name || user.uid}`)
        setInitializing(false)
        loadMessages(peerId)
        addMessageListener()
      })
      .catch((err) => {
        setError(`CometChat startup failed: ${err?.message || err}`)
        setStatus('Unable to connect to CometChat')
        setInitializing(false)
      })

    return () => {
      CometChat.removeMessageListener(MESSAGE_LISTENER_ID)
      CometChat.logout().catch(() => {})
    }
  }, [])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessageListener = () => {
    CometChat.addMessageListener(
      MESSAGE_LISTENER_ID,
      new CometChat.MessageListener({
        onTextMessageReceived: (message) => {
          setMessages((previous) => [...previous, message])
        },
      }),
    )
  }

  const loadMessages = (uid) => {
    if (!uid) return

    const messagesRequest = new CometChat.MessagesRequestBuilder()
      .setUID(uid)
      .setLimit(50)
      .build()

    messagesRequest
      .fetchPrevious()
      .then((fetched) => setMessages(fetched.reverse()))
      .catch((err) => {
        console.error('Load messages failed', err)
        setError('Unable to load recent chat history.')
      })
  }

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || !peerId) return

    const message = new CometChat.TextMessage(peerId, text, CometChat.RECEIVER_TYPE.USER)

    try {
      const sent = await CometChat.sendMessage(message)
      setMessages((previous) => [...previous, sent])
      setDraft('')
    } catch (sendError) {
      setError(`Message send failed: ${sendError?.message || sendError}`)
    }
  }

  const handlePeerChange = () => {
    const trimmed = peerDraftId.trim()
    if (!trimmed) return
    setPeerId(trimmed)
    setMessages([])
    setStatus(`Loading conversation with ${trimmed}`)
    loadMessages(trimmed)
  }

  const isReady = !initializing && connectedUser

  return (
    <div className="chat-app">
      <header className="chat-header">
        <div>
          <h1>CometChat demo</h1>
          <p className="subheader">
            A lightweight chat UI using CometChat. Configure your credentials in <code>.env</code>.
          </p>
        </div>
        <div className="chat-status">
          <strong>Status:</strong> {status}
        </div>
      </header>

      {!isConfigured() ? (
        <section className="chat-panel">
          <div className="notice warning">
            <h2>Configure CometChat</h2>
            <p>Create a <code>.env</code> file with the following values:</p>
            <pre>
{`VITE_COMETCHAT_APP_ID=YOUR_APP_ID
VITE_COMETCHAT_REGION=YOUR_APP_REGION
VITE_COMETCHAT_AUTH_KEY=YOUR_AUTH_KEY
VITE_COMETCHAT_USER_ID=superhero1
VITE_COMETCHAT_PEER_ID=superhero2`}
            </pre>
          </div>
        </section>
      ) : (
        <section className="chat-panel">
          <div className="chat-config">
            <label>
              Chat with user ID
              <input
                value={peerDraftId}
                onChange={(event) => setPeerDraftId(event.target.value)}
                placeholder="peer user id"
                autoComplete="off"
              />
            </label>
            <button type="button" onClick={handlePeerChange}>
              Load conversation
            </button>
          </div>

          <div className="chat-window">
            <div className="messages">
              {messages.length === 0 ? (
                <div className="empty-state">
                  {initializing ? 'Connecting…' : 'No messages yet. Send the first one.'}
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.sender?.uid === USER_ID
                  return (
                    <div
                      key={message.id || `${message.sender?.uid}-${message.sentAt}`}
                      className={`message ${isMine ? 'me' : 'them'}`}
                    >
                      <div className="message-meta">
                        <span>{isMine ? 'You' : message.sender?.name || message.sender?.uid}</span>
                        <small>{new Date(message.sentAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                      </div>
                      <div className="message-body">{message.text}</div>
                    </div>
                  )
                })
              )}
              <div ref={messageEndRef} />
            </div>

            <form
              className="chat-form"
              onSubmit={(event) => {
                event.preventDefault()
                handleSend()
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Message ${peerId || 'a user'}`}
                disabled={!isReady}
                autoComplete="off"
              />
              <button type="submit" disabled={!isReady || !draft.trim()}>
                Send
              </button>
            </form>
          </div>

          {error && (
            <div className="notice error">
              <strong>Error:</strong> {error}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default App
