"use client"

import { useRef, useEffect, useState } from "react"
import { Send, Trash2 } from "lucide-react"
import { MessageBubble } from "./message-bubble"

export type MessagingMessage = {
  id: string
  content: string
  timestamp: string
  isOwn: boolean
  senderName?: string
  onDelete?: () => void
}

export function ChatWindow({
  title,
  status,
  messages,
  isLoading,
  error,
  canSend,
  onSend,
  onDelete,
}: {
  title?: string
  status?: string
  messages: MessagingMessage[]
  isLoading?: boolean
  error?: string
  canSend: boolean
  onSend: (content: string) => Promise<void> | void
  onDelete?: () => void
}) {
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!canSend) return
    const v = inputValue.trim()
    if (!v) return
    setInputValue("")
    await onSend(v)
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{title || "Select a conversation"}</h3>
          <p className="text-xs text-muted-foreground">{status || (title ? "" : "Choose a chat from the left")}</p>
        </div>
        {title && onDelete && (
          <div className="flex items-center gap-2">
            <button
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              onClick={onDelete}
              type="button"
              aria-label="Delete conversation"
            >
              <Trash2 size={18} className="text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : isLoading ? (
          <div className="text-sm text-muted-foreground">Loading messages...</div>
        ) : !title ? (
          <div className="text-sm text-muted-foreground">Select a conversation to start.</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">No messages yet. Say hello!</div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} {...msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-card border-t border-border p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={canSend ? "Type your message..." : "Select a conversation to chat"}
            className="input flex-1"
            disabled={!canSend}
          />
          <button
            onClick={handleSendMessage}
            className="btn-primary flex items-center gap-2 px-4"
            disabled={!canSend}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
