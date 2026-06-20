"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Search } from "lucide-react"

export interface ConversationItemProps {
  id: string
  name: string
  avatar?: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  isActive?: boolean
  onSelect?: () => void
}

export function ConversationItem({
  name,
  lastMessage,
  lastMessageTime,
  unreadCount,
  isActive,
  onSelect,
}: ConversationItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 border-b border-border hover:bg-muted transition-colors ${
        isActive ? "bg-muted" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`font-medium ${unreadCount > 0 ? "font-bold" : ""}`}>{name}</p>
          <p className="text-sm text-muted-foreground truncate">{lastMessage}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{lastMessageTime}</p>
          {unreadCount > 0 && (
            <span className="inline-block mt-1 px-2 py-1 rounded-full bg-primary text-white text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export function ConversationList() {
  return null
}

export function ConversationListView({
  conversations,
  selectedId,
  isLoading,
  error,
  onSelect,
  onRefresh,
  headerActions,
}: {
  conversations: ConversationItemProps[]
  selectedId?: string | null
  isLoading?: boolean
  error?: string
  onSelect: (id: string) => void
  onRefresh?: () => void
  headerActions?: ReactNode
}) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return conversations
    return conversations.filter((c) => {
      return (c.name || "").toLowerCase().includes(s) || (c.lastMessage || "").toLowerCase().includes(s)
    })
  }, [conversations, search])

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-xl font-bold">Messages</h2>
          {headerActions}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            placeholder="Search conversations..."
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="p-4 text-sm text-red-600">
            {error}
            {onRefresh && (
              <button className="ml-2 underline" onClick={onRefresh}>
                Retry
              </button>
            )}
          </div>
        ) : isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading conversations...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No conversations yet.
            {onRefresh && (
              <button className="ml-2 underline" onClick={onRefresh}>
                Refresh
              </button>
            )}
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              {...conv}
              isActive={String(selectedId || "") === String(conv.id)}
              onSelect={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
