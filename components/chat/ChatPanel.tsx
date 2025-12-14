"use client"
import { FC, useEffect, useRef, useState } from "react"
import { Socket } from "socket.io-client"
import { ClientToServerEvents, ServerToClientEvents } from "../../lib/socket"

type ChatMessage = {
  id: string
  userId: string
  name: string
  text: string
  ts: number
}

interface Props {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>
  className?: string
}

// Audio notification constants
const NOTIFICATION_FREQUENCY = 800
const NOTIFICATION_VOLUME = 0.3
const NOTIFICATION_VOLUME_END = 0.01
const NOTIFICATION_DURATION = 0.1

// Reusable audio context for notifications
let audioContext: AudioContext | null = null

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

const ChatPanel: FC<Props> = ({ socket, className }) => {
  const [messages, _setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const messagesRef = useRef(messages)
  const setMessages = (m: ChatMessage[]) => {
    messagesRef.current = m
    _setMessages(m)
  }

  useEffect(() => {
    const onHistory = (history: ChatMessage[]) => {
      setMessages(history)
    }
    const onNew = (msg: ChatMessage) => {
      setMessages([...messagesRef.current, msg].slice(-200))
      // Play notification sound using Web Audio API
      try {
        const ctx = getAudioContext()
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.frequency.value = NOTIFICATION_FREQUENCY
        oscillator.type = 'sine'
        
        gainNode.gain.setValueAtTime(NOTIFICATION_VOLUME, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(NOTIFICATION_VOLUME_END, ctx.currentTime + NOTIFICATION_DURATION)
        
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + NOTIFICATION_DURATION)
      } catch (err) {
        console.log("Audio notification failed:", err)
      }
    }

    socket.on("chatHistory", onHistory)
    socket.on("chatNew", onNew)
    return () => {
      socket.off("chatHistory", onHistory)
      socket.off("chatNew", onNew)
    }
  }, [socket])

  const send = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    socket.emit("chatMessage", trimmed)
    setText("")
  }

  return (
    <div className={className ?? "flex flex-col h-64 border border-dark-700/50 rounded-xl overflow-hidden shadow-lg bg-dark-900"}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-dark-900/50 flex flex-col-reverse">
        {messages.length === 0 ? (
          <div className="text-dark-500 text-sm text-center py-8">
            No messages yet. Be the first to say hello! 👋
          </div>
        ) : (
          // Render messages in reverse order without creating a new array
          messages.map((_, idx) => {
            const reverseIdx = messages.length - 1 - idx
            const msg = messages[reverseIdx]
            return (
              <div key={msg.id} className="text-sm bg-dark-800/50 rounded-lg p-3 border border-dark-700/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-primary-400">{msg.name}</span>
                  <span className="text-dark-500 text-xs">•</span>
                  <span className="text-dark-500 text-xs">{new Date(msg.ts).toLocaleTimeString()}</span>
                </div>
                <div className="break-words text-dark-200">{msg.text}</div>
              </div>
            )
          })
        )}
      </div>
      <div className="p-3 flex gap-2 bg-dark-800/50 border-t border-dark-700/50">
        <input
          className="input flex-1 bg-dark-800 border border-dark-700/50 focus:border-primary-500/50 p-2.5 rounded-lg outline-none transition-all duration-200"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send()
          }}
        />
        <button 
          className="btn bg-primary-600 hover:bg-primary-700 active:bg-primary-800 px-4 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-glow" 
          onClick={send}
        >
          Send
        </button>
      </div>
    </div>
  )
}

export default ChatPanel
