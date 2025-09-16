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
    <div className={className ?? "flex flex-col h-64 border rounded-md"}>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-neutral-900/30">
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-semibold">{m.name}</span>
            <span className="opacity-60"> • {new Date(m.ts).toLocaleTimeString()}</span>
            <div className="break-words">{m.text}</div>
          </div>
        ))}
        {messages.length === 0 && <div className="opacity-60 text-sm">No messages yet</div>}
      </div>
      <div className="p-2 flex gap-2">
        <input
          className="input flex-1 bg-neutral-800 p-2 rounded-md outline-none"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send()
          }}
        />
        <button className="btn bg-primary-700 hover:bg-primary-600 px-3 rounded-md" onClick={send}>
          Send
        </button>
      </div>
    </div>
  )
}

export default ChatPanel
