"use client"

import { Trash2 } from "lucide-react"

export interface MessageBubbleProps {
  content: string
  timestamp: string
  isOwn: boolean
  senderName?: string
  onDelete?: () => void
}

export function MessageBubble({ content, timestamp, isOwn, senderName, onDelete }: MessageBubbleProps) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`relative max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {isOwn && onDelete && (
          <button
            type="button"
            aria-label="Delete message"
            className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        {senderName && !isOwn && <p className="text-xs font-semibold mb-1 opacity-75">{senderName}</p>}
        <p className="break-words">{content}</p>
        <p className={`text-xs mt-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{timestamp}</p>
      </div>
    </div>
  )
}
