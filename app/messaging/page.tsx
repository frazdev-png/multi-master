"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ConversationListView, type ConversationItemProps } from "@/components/messaging/conversation-list"
import { ChatWindow, type MessagingMessage } from "@/components/messaging/chat-window"

type RecipientUser = {
  id: number
  full_name: string
  email: string
  role: "admin" | "seller" | "customer"
  avatar_url?: string | null
  is_online?: number | boolean | null
}

type BackendConversation = {
  conversation_id: number
  other_user_id: number
  other_user_name: string
  other_user_email?: string
  other_user_avatar?: string | null
  other_user_online?: number | boolean | null
  other_user_last_seen?: string | null
  last_message?: string | null
  last_message_at?: string | null
  unread_count?: number | string | null
}

type BackendMessage = {
  id: number
  conversation_id: number
  sender_id: number
  content: string
  message_type?: string
  created_at: string
  sender_name?: string
  sender_avatar?: string | null
}

export default function MessagingPage() {
  const [me, setMe] = useState<any>(null)
  const [conversations, setConversations] = useState<BackendConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<BackendMessage[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [errorConversations, setErrorConversations] = useState("")
  const [errorMessages, setErrorMessages] = useState("")

  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const [recipientRole, setRecipientRole] = useState<"seller" | "admin">("seller")
  const [recipientSearch, setRecipientSearch] = useState("")
  const [recipients, setRecipients] = useState<RecipientUser[]>([])
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false)
  const [errorRecipients, setErrorRecipients] = useState("")

  const loadMeAndConversations = useCallback(async () => {
    try {
      setIsLoadingConversations(true)
      setErrorConversations("")
      const [meRes, convRes] = await Promise.all([fetch("/api/backend/auth/me"), fetch("/api/backend/conversations")])
      const meData = await meRes.json().catch(() => null)
      const convData = await convRes.json().catch(() => null)

      if (!meRes.ok) {
        throw new Error(meData?.error || "Failed to load user")
      }
      if (!convRes.ok) {
        throw new Error(convData?.error || "Failed to load conversations")
      }

      setMe(meData?.user || null)
      setConversations(Array.isArray(convData?.conversations) ? convData.conversations : [])
    } catch (e: any) {
      setErrorConversations(e?.message || "Failed to load conversations")
    } finally {
      setIsLoadingConversations(false)
    }
  }, [])

  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      setIsLoadingMessages(true)
      setErrorMessages("")
      const res = await fetch(`/api/backend/conversations/${conversationId}/messages`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load messages")
      }
      setMessages(Array.isArray(data?.messages) ? data.messages : [])
    } catch (e: any) {
      setErrorMessages(e?.message || "Failed to load messages")
    } finally {
      setIsLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    loadMeAndConversations()
  }, [loadMeAndConversations])

  const loadRecipients = useCallback(
    async (role: "seller" | "admin", search: string) => {
      try {
        setIsLoadingRecipients(true)
        setErrorRecipients("")
        const qs = new URLSearchParams()
        qs.set("role", role)
        qs.set("limit", "50")
        if (search.trim()) {
          qs.set("search", search.trim())
        }
        const res = await fetch(`/api/backend/users?${qs.toString()}`)
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load users")
        }
        setRecipients(Array.isArray(data?.users) ? data.users : [])
      } catch (e: any) {
        setErrorRecipients(e?.message || "Failed to load users")
        setRecipients([])
      } finally {
        setIsLoadingRecipients(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!isNewChatOpen) return
    loadRecipients(recipientRole, recipientSearch)
  }, [isNewChatOpen, loadRecipients, recipientRole, recipientSearch])

  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) return null
    return conversations.find((c) => Number(c.conversation_id) === Number(selectedConversationId)) || null
  }, [conversations, selectedConversationId])

  const conversationItems: ConversationItemProps[] = useMemo(() => {
    return conversations.map((c) => {
      const ts = c.last_message_at ? new Date(c.last_message_at) : null
      const lastMessageTime = ts && !Number.isNaN(ts.getTime()) ? ts.toLocaleString() : ""
      return {
        id: String(c.conversation_id),
        name: c.other_user_name || "User",
        lastMessage: c.last_message || "",
        lastMessageTime,
        unreadCount: Number(c.unread_count || 0),
      }
    })
  }, [conversations])

  const handleDeleteMessage = useCallback(
    async (messageId: number) => {
      if (!messageId) return
      if (!confirm("Delete this message?")) return

      try {
        setErrorMessages("")
        const res = await fetch(`/api/backend/messages/${messageId}`, { method: "DELETE" })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || "Failed to delete message")
        }
        setMessages((prev) => prev.filter((m) => Number(m.id) !== Number(messageId)))
      } catch (e: any) {
        setErrorMessages(e?.message || "Failed to delete message")
      }
    },
    [setMessages],
  )

  const uiMessages: MessagingMessage[] = useMemo(() => {
    const myId = Number((me as any)?.id ?? (me as any)?.user_id ?? (me as any)?.userId ?? (me as any)?.user?.id ?? 0)
    const myName = String((me as any)?.full_name ?? (me as any)?.name ?? (me as any)?.user?.full_name ?? (me as any)?.user?.name ?? "")
    const otherId = Number((selectedConversation as any)?.other_user_id ?? (selectedConversation as any)?.otherUserId ?? 0)
    const otherName = String(selectedConversation?.other_user_name || "")
    return messages.map((m) => {
      const ts = m.created_at ? new Date(m.created_at) : null
      const senderId = Number((m as any)?.sender_id ?? (m as any)?.senderId ?? 0)
      const senderName = String((m as any)?.sender_name ?? (m as any)?.senderName ?? "")

      let isOwn = false
      if (senderId > 0 && myId > 0) {
        // Primary rule: if we know who the current user is, align based on it.
        isOwn = senderId === myId
      } else if (senderId > 0 && otherId > 0) {
        // Fallback: align based on known other user.
        isOwn = senderId !== otherId
      } else if (senderName && myName) {
        // Name-based fallback when IDs are missing/misreported.
        isOwn = senderName === myName
      } else if (otherName && senderName) {
        // Last resort heuristic.
        isOwn = senderName !== otherName
      }
      return {
        id: String(m.id),
        content: m.content || "",
        timestamp: ts && !Number.isNaN(ts.getTime()) ? ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        isOwn,
        senderName: senderName || m.sender_name,
        onDelete: isOwn ? () => handleDeleteMessage(Number(m.id)) : undefined,
      }
    })
  }, [handleDeleteMessage, me, messages, selectedConversation?.other_user_id, selectedConversation?.other_user_name])

  const handleSelect = useCallback(
    async (id: string) => {
      const cid = Number(id)
      setSelectedConversationId(cid)
      await loadMessages(cid)
      setConversations((prev) => prev.map((c) => (Number(c.conversation_id) === cid ? { ...c, unread_count: 0 } : c)))
    },
    [loadMessages],
  )

  const createConversationAndSelect = useCallback(
    async (recipientId: number) => {
      setErrorConversations("")
      const res = await fetch("/api/backend/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: recipientId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create conversation")
      }
      const cid = Number(data?.conversation_id || 0)
      if (!cid) {
        throw new Error("Conversation was not created")
      }
      await loadMeAndConversations()
      setSelectedConversationId(cid)
      await loadMessages(cid)
      setConversations((prev) => prev.map((c) => (Number(c.conversation_id) === cid ? { ...c, unread_count: 0 } : c)))
      setIsNewChatOpen(false)
    },
    [loadMeAndConversations, loadMessages],
  )

  const handleDeleteConversation = useCallback(async () => {
    if (!selectedConversationId) return
    if (!confirm("Delete this conversation? This will remove all messages.")) return

    try {
      setErrorConversations("")
      const res = await fetch(`/api/backend/conversations/${selectedConversationId}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete conversation")
      }

      setConversations((prev) => prev.filter((c) => Number(c.conversation_id) !== Number(selectedConversationId)))
      setSelectedConversationId(null)
      setMessages([])
    } catch (e: any) {
      setErrorConversations(e?.message || "Failed to delete conversation")
    }
  }, [selectedConversationId])

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedConversationId) return
      setErrorMessages("")
      const res = await fetch("/api/backend/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: selectedConversationId, content }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to send message")
      }
      const msg = data?.message as BackendMessage | undefined
      if (msg && msg.id) {
        setMessages((prev) => [...prev, msg])
        setConversations((prev) =>
          prev.map((c) =>
            Number(c.conversation_id) === Number(selectedConversationId)
              ? { ...c, last_message: msg.content, last_message_at: msg.created_at }
              : c,
          ),
        )
      } else {
        await loadMessages(selectedConversationId)
      }
    },
    [loadMessages, selectedConversationId],
  )

  return (
    <div className="flex h-screen bg-background">
      <ConversationListView
        conversations={conversationItems}
        selectedId={selectedConversationId ? String(selectedConversationId) : null}
        isLoading={isLoadingConversations}
        error={errorConversations}
        onSelect={handleSelect}
        onRefresh={loadMeAndConversations}
        headerActions={
          <button
            className="btn-primary px-3 py-2 text-sm"
            onClick={() => setIsNewChatOpen(true)}
            type="button"
          >
            New Chat
          </button>
        }
      />
      <ChatWindow
        title={selectedConversation?.other_user_name}
        status={selectedConversation ? (selectedConversation.other_user_online ? "Online" : "Offline") : undefined}
        messages={uiMessages}
        isLoading={isLoadingMessages}
        error={errorMessages}
        canSend={Boolean(selectedConversationId)}
        onSend={handleSend}
        onDelete={selectedConversationId ? handleDeleteConversation : undefined}
      />

      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-card border border-border shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <div className="text-lg font-semibold">Start a new chat</div>
                <div className="text-xs text-muted-foreground">Choose a seller or admin to message</div>
              </div>
              <button className="text-sm underline" onClick={() => setIsNewChatOpen(false)} type="button">
                Close
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={recipientRole === "seller" ? "btn-primary px-3 py-2 text-sm" : "btn-secondary px-3 py-2 text-sm"}
                  onClick={() => setRecipientRole("seller")}
                >
                  Sellers
                </button>
                <button
                  type="button"
                  className={recipientRole === "admin" ? "btn-primary px-3 py-2 text-sm" : "btn-secondary px-3 py-2 text-sm"}
                  onClick={() => setRecipientRole("admin")}
                >
                  Admin
                </button>
                <input
                  className="input flex-1"
                  placeholder="Search by name/email"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                />
              </div>

              {errorRecipients ? (
                <div className="text-sm text-red-600">
                  {errorRecipients}
                  <button className="ml-2 underline" onClick={() => loadRecipients(recipientRole, recipientSearch)} type="button">
                    Retry
                  </button>
                </div>
              ) : isLoadingRecipients ? (
                <div className="text-sm text-muted-foreground">Loading users...</div>
              ) : recipients.length === 0 ? (
                <div className="text-sm text-muted-foreground">No users found.</div>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
                  {recipients.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full text-left p-3 border-b border-border hover:bg-muted transition-colors"
                      onClick={async () => {
                        try {
                          await createConversationAndSelect(Number(u.id))
                        } catch (e: any) {
                          setErrorConversations(e?.message || "Failed to start chat")
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{u.full_name || u.email}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{u.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
