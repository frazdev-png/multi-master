"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  MessageSquareText, 
  X, 
  Send, 
  ChevronDown,
  ChevronUp,
  Trash2,
  Users,
  Paperclip,
  Loader2,
  ArrowLeft,
  Download,
  Pencil
} from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  text: string
  sender: string
  senderId: string
  timestamp: Date
  isRead: boolean
  message_type?: string
  image_url?: string
}

interface ChatUser {
  id: string
  conversationId?: number
  name: string
  avatar?: string
  role: 'admin' | 'vendor' | 'customer'
  isOnline: boolean
  lastMessage?: string
  unreadCount?: number
}

interface BackendConversation {
  conversation_id: number
  other_user_id: number
  other_user_name: string
  other_user_avatar?: string | null
  other_user_online?: number | boolean | null
  other_user_last_seen?: string | null
  last_message?: string | null
  last_message_at?: string | null
  unread_count?: number | string | null
}

interface BackendMessage {
  id: number
  conversation_id: number
  sender_id: number
  content: string
  message_type?: string
  created_at: string
  sender_name?: string
  sender_avatar?: string | null
  is_read?: number | boolean | string
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)
  const [showInbox, setShowInbox] = useState(true)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([])
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)
  const selectedConversationIdRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const deleteMessageById = useCallback(
    async (messageId: string) => {
      if (!selectedUser?.conversationId) return
      const idNum = Number(messageId)
      if (!idNum) return
      if (!confirm("Delete this message?")) return

      try {
        setError("")
        const res = await fetch(`/api/backend/messages/${idNum}`, { method: "DELETE" })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || "Failed to delete message")
        }

        setMessages((prev) => {
          const next = prev.filter((m) => Number(m.id) !== idNum)

          setChatUsers((users) =>
            users.map((u) => {
              if (Number(u.conversationId) !== Number(selectedUser.conversationId)) return u
              const last = next.length ? next[next.length - 1]?.text : ""
              return { ...u, lastMessage: last }
            }),
          )

          return next
        })
      } catch (e: any) {
        setError(e?.message || "Failed to delete message")
      }
    },
    [selectedUser?.conversationId],
  )

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const totalUnread = useMemo(() => {
    return chatUsers.reduce((acc, user) => acc + (user.unreadCount || 0), 0)
  }, [chatUsers])

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/backend/auth/me")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load current user")
      }

      const u = data?.user || data?.data?.user || data?.me || null
      const role = (u?.role || "customer") as ChatUser["role"]
      setCurrentUser({
        id: String(u?.id ?? u?.user_id ?? u?.userId ?? u?.user?.id ?? ""),
        name: u?.full_name || u?.name || u?.user?.full_name || u?.user?.name || "User",
        role,
        isOnline: true,
      })
    } catch (e: any) {
      setError(e?.message || "Failed to load current user")
    }
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/conversations")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load conversations")
      }

      const convs: BackendConversation[] = data?.conversations || []
      const mappedUsers: ChatUser[] = convs.map((c) => ({
        id: String(c.other_user_id),
        conversationId: Number(c.conversation_id),
        name: c.other_user_name || "User",
        avatar: c.other_user_avatar || undefined,
        role: (c as any).other_user_role || "customer",
        isOnline: Boolean(c.other_user_online),
        lastMessage: c.last_message || "",
        unreadCount: Number(c.unread_count || 0),
      }))

      setChatUsers(mappedUsers)
    } catch (e: any) {
      setError(e?.message || "Failed to load conversations")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/conversations/${conversationId}/messages`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load messages")
      }

      const list: BackendMessage[] = data?.messages || []
      const mapped: Message[] = list.map((m) => ({
        id: String(m.id),
        text: m.content || "",
        sender: m.sender_name || "",
        senderId: String(m.sender_id),
        timestamp: m.created_at ? new Date(m.created_at) : new Date(),
        isRead: Boolean(m.is_read),
        message_type: m.message_type || "text",
        image_url: m.message_type === "image" ? m.content : undefined,
      }))

      setMessages(mapped)

      setChatUsers((prev) =>
        prev.map((u) =>
          u.conversationId === conversationId
            ? { ...u, unreadCount: 0 }
            : u
        )
      )
    } catch (e: any) {
      setError(e?.message || "Failed to load messages")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const startChatWithAdmin = useCallback(async () => {
    try {
      setError("")
      setIsLoading(true)
      const usersRes = await fetch("/api/backend/users?role=admin&limit=1")
      const usersData = await usersRes.json().catch(() => null)
      if (!usersRes.ok || !usersData?.users?.length) {
        throw new Error(usersData?.error || "No admin found")
      }
      const admin = usersData.users[0]

      const convRes = await fetch("/api/backend/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: admin.id }),
      })
      const convData = await convRes.json().catch(() => null)
      if (!convRes.ok) {
        throw new Error(convData?.error || "Failed to create conversation")
      }

      const convId = Number(convData?.conversation_id)
      if (!convId) throw new Error("Conversation was not created")

      const newUser: ChatUser = {
        id: String(admin.id),
        conversationId: convId,
        name: admin.full_name || admin.name || admin.email || "Admin",
        avatar: admin.avatar_url || undefined,
        role: "admin",
        isOnline: false,
      }

      setChatUsers((prev) => [newUser, ...prev])
      setSelectedUser(newUser)
      setShowInbox(false)
      await loadMessages(convId)
    } catch (e: any) {
      setError(e?.message || "Failed to start chat with admin")
    } finally {
      setIsLoading(false)
    }
  }, [loadMessages])

  const connectWebSocket = useCallback(async () => {
    if (wsRef.current) return
    try {
      setWsStatus('connecting')
      const tokenRes = await fetch("/api/ws-token")
      const tokenData = await tokenRes.json().catch(() => null)
      if (!tokenRes.ok || !tokenData?.token) {
        throw new Error(tokenData?.error || "Failed to get ws token")
      }

      const baseUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080"
      const wsUrl = `${baseUrl}?token=${encodeURIComponent(tokenData.token)}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setWsStatus('connected')
      }

      ws.onclose = () => {
        wsRef.current = null
        setWsStatus('disconnected')
      }

      ws.onerror = () => {}

      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data || "{}")
        if (!data) return

        if (data.type === 'user_status') {
          const userId = String(data.user_id)
          setChatUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, isOnline: Boolean(data.is_online) } : u))
          )
          return
        }

        if (data.type === 'read_receipt') {
          const messageId = String(data.message_id)
          setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isRead: true } : m)))
          return
        }

        if (data.conversation_id && data.sender_id && data.content) {
          const incomingConversationId = Number(data.conversation_id)
          const msgType = data.message_type || "text"
          const incoming: Message = {
            id: String(data.id || Date.now()),
            text: String(data.content || ""),
            sender: String(data.sender_name || ""),
            senderId: String(data.sender_id),
            timestamp: data.created_at ? new Date(data.created_at) : new Date(),
            isRead: false,
            message_type: msgType,
            image_url: msgType === "image" ? String(data.content || "") : undefined,
          }

          setChatUsers((prev) => {
            const exists = prev.some((u) => u.conversationId === incomingConversationId)
            if (!exists) {
              // New conversation — add it
              const newUser: ChatUser = {
                id: String(data.sender_id),
                conversationId: incomingConversationId,
                name: String(data.sender_name || "User"),
                role: String(data.sender_role || "customer") as ChatUser["role"],
                isOnline: false,
                lastMessage: incoming.text,
                unreadCount: 1,
              }
              return [newUser, ...prev]
            }
            return prev.map((u) => {
              if (u.conversationId !== incomingConversationId) return u
              const shouldCountUnread = selectedConversationIdRef.current !== incomingConversationId
              return {
                ...u,
                lastMessage: incoming.text,
                unreadCount: shouldCountUnread ? (u.unreadCount || 0) + 1 : 0,
              }
            })
          })

          if (selectedConversationIdRef.current === incomingConversationId) {
            setMessages((prev) => [...prev, incoming])
          }
          return
        }
      }
    } catch (e: any) {
      setWsStatus('disconnected')
      setError(e?.message || "WebSocket connection failed")
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    loadCurrentUser()
    loadConversations()
    connectWebSocket()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setWsStatus('disconnected')
    }
  }, [connectWebSocket, isOpen, loadConversations, loadCurrentUser])

  useEffect(() => {
    selectedConversationIdRef.current = selectedUser?.conversationId ?? null
  }, [selectedUser?.conversationId])

  const sendMessage = async () => {
    if (!message.trim() || !selectedUser?.conversationId || !currentUser) return

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      text: message,
      sender: currentUser.name,
      senderId: currentUser.id,
      timestamp: new Date(),
      isRead: false,
    }

    const content = message
    setMessages((prev) => [...prev, optimistic])
    setMessage("")

    const payload = {
      type: 'message',
      conversation_id: selectedUser.conversationId,
      content,
    }

    try {
      if (wsRef.current && wsStatus === 'connected') {
        wsRef.current.send(JSON.stringify(payload))
      } else {
        const res = await fetch("/api/backend/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: selectedUser.conversationId,
            content,
            message_type: "text",
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || "Failed to send message")
        }
      }

      setChatUsers((prev) =>
        prev.map((u) =>
          u.conversationId === selectedUser.conversationId ? { ...u, lastMessage: content } : u
        )
      )
    } catch (e: any) {
      setError(e?.message || "Failed to send message")
    }
  }

  const uploadAndSendImage = async (file: File) => {
    if (!selectedUser?.conversationId || !currentUser) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("type", "chat")
      formData.append("file", file)

      const uploadRes = await fetch("/api/backend/settings/upload", {
        method: "POST",
        body: formData,
      })
      const uploadData = await uploadRes.json().catch(() => null)
      if (!uploadRes.ok || !uploadData?.success) {
        throw new Error(uploadData?.message || "Upload failed")
      }

      const imageUrl = uploadData.url

      const optimistic: Message = {
        id: `tmp-${Date.now()}`,
        text: imageUrl,
        sender: currentUser.name,
        senderId: currentUser.id,
        timestamp: new Date(),
        isRead: false,
        message_type: "image",
        image_url: imageUrl,
      }

      setMessages((prev) => [...prev, optimistic])

      const payload = {
        type: "message",
        conversation_id: selectedUser.conversationId,
        content: imageUrl,
        message_type: "image",
      }

      if (wsRef.current && wsStatus === "connected") {
        wsRef.current.send(JSON.stringify(payload))
      } else {
        await fetch("/api/backend/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: selectedUser.conversationId,
            content: imageUrl,
            message_type: "image",
          }),
        })
      }

      setChatUsers((prev) =>
        prev.map((u) =>
          u.conversationId === selectedUser.conversationId ? { ...u, lastMessage: "[Image]" } : u
        )
      )
    } catch (e: any) {
      setError(e?.message || "Failed to send image")
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB)")
      return
    }
    uploadAndSendImage(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const deleteSelectedConversation = useCallback(async () => {
    if (!selectedUser?.conversationId) return
    if (!confirm("Delete this conversation? This will remove all messages.")) return

    try {
      setError("")
      const res = await fetch(`/api/backend/conversations/${selectedUser.conversationId}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete conversation")
      }

      setChatUsers((prev) => prev.filter((u) => Number(u.conversationId) !== Number(selectedUser.conversationId)))
      setSelectedUser(null)
      setShowInbox(true)
      selectedConversationIdRef.current = null
      setMessages([])
    } catch (e: any) {
      setError(e?.message || "Failed to delete conversation")
    }
  }, [selectedUser])

  const handleBackToInbox = () => {
    setSelectedUser(null)
    setShowInbox(true)
  }

  const editMessage = async (messageId: string) => {
    if (!editText.trim()) return
    try {
      const res = await fetch(`/api/backend/messages/${messageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to edit message")
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: editText } : m)))
      setEditingMessageId(null)
      setEditText("")
    } catch (e: any) {
      setError(e?.message || "Failed to edit message")
    }
  }

  const downloadImage = async (url: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = url.split("/").pop() || "image.jpg"
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {}
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
      case 'vendor': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
      case 'customer': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const formatLastSeen = (isOnline: boolean) => {
    return isOnline ? "Online" : "Offline"
  }

  // Floating button when closed
  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-[999]">
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className={cn(
            "relative h-14 w-14 rounded-full shadow-xl",
            "bg-gradient-to-br from-primary to-primary/80",
            "hover:from-primary/90 hover:to-primary/70",
            "ring-2 ring-primary/20 hover:ring-primary/30",
            "transition-all duration-200 hover:scale-105 active:scale-95"
          )}
        >
          <MessageSquareText className="h-6 w-6 text-white" />
          {totalUnread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-6 min-w-[1.5rem] px-1.5 rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className={cn(
      "fixed z-[999] transition-all duration-300",
      "top-0 left-0 right-0 bottom-0 sm:top-auto sm:left-auto sm:bottom-4 sm:right-4",
      isMinimized ? "sm:w-80 sm:h-14" : "sm:w-96 sm:max-h-[85vh] sm:h-[500px]"
    )}>
      <Card className={cn(
        "h-full flex flex-col shadow-2xl",
        "rounded-none sm:rounded-xl",
        "border-0 sm:border"
      )}>
        {/* Header */}
        <CardHeader className={cn(
          "flex flex-row items-center justify-between space-y-0 py-2.5 px-4",
          "bg-card border-b border-border shrink-0",
          isMinimized ? "sm:py-2 sm:px-4" : ""
        )}>
          <div className="flex items-center gap-2 min-w-0">
            {selectedUser && !showInbox && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={handleBackToInbox}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 shrink-0">
                <MessageSquareText className="h-3.5 w-3.5 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold truncate">
                {selectedUser && !showInbox ? selectedUser.name : "Chat Support"}
              </CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? "Expand" : "Minimize"}
            >
              {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => {
                setIsOpen(false)
                setSelectedUser(null)
                setShowInbox(true)
              }}
              aria-label="Close chat"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {!isMinimized && (
          <>
            <CardContent className="flex-1 p-0 overflow-hidden">
              {error && (
                <div className="px-4 py-2 text-sm bg-destructive/10 text-destructive border-b border-border">
                  {error}
                </div>
              )}
              <div className="flex h-full">
                {/* Users List */}
                <div className={cn(
                  "border-r border-border bg-muted/20 w-full",
                  selectedUser && !showInbox ? "hidden" : "block"
                )}>
                  <div className="p-3 border-b border-border bg-background/50 flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Conversations ({chatUsers.length})
                    </p>
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" onClick={startChatWithAdmin}>
                      + New
                    </Button>
                  </div>
                  <ScrollArea className="h-[calc(100%-45px)]">
                    <div className="py-1">
                      {isLoading && !chatUsers.length ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : chatUsers.length === 0 ? (
                        <div className="py-12 text-center px-4">
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <Users className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
                          <p className="mt-1 text-xs text-muted-foreground/70">
                            Messages will appear here when you contact support or a seller.
                          </p>
                          <div className="flex gap-2 justify-center mt-4">
                            <Button variant="outline" size="sm" onClick={loadConversations}>
                              Refresh
                            </Button>
                            <Button variant="default" size="sm" onClick={startChatWithAdmin}>
                              Contact Admin
                            </Button>
                          </div>
                        </div>
                      ) : (
                        chatUsers.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => {
                              setSelectedUser(user)
                              setShowInbox(false)
                              if (user.conversationId) {
                                loadMessages(user.conversationId)
                              }
                            }}
                            className={cn(
                              "flex items-center gap-3 px-3 py-3 cursor-pointer transition-all",
                              "hover:bg-muted/80 border-b border-border/50 last:border-b-0",
                              selectedUser?.id === user.id && "bg-muted border-l-2 border-l-primary"
                            )}
                          >
                            <div className="relative shrink-0">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {user.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {user.isOnline && (
                                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium truncate">{user.name}</p>
                                {user.unreadCount && user.unreadCount > 0 && (
                                  <Badge variant="destructive" className="h-5 min-w-5 rounded-full px-1.5 text-[10px] shrink-0">
                                    {user.unreadCount}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-muted-foreground truncate flex-1">
                                  {user.lastMessage || "No messages yet"}
                                </p>
                                <span className={cn("text-[10px] shrink-0", getRoleColor(user.role))}>
                                  {user.role}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Chat Area */}
                {selectedUser && (
                  <div className={cn(
                    "flex-1 flex flex-col",
                    showInbox ? "hidden" : "flex"
                  )}>
                    {/* Chat Header */}
                    <div className="px-4 py-3 border-b border-border bg-background/50 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 shrink-0"
                          onClick={handleBackToInbox}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={selectedUser.avatar} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {selectedUser.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{selectedUser.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatLastSeen(selectedUser.isOnline)}
                          </p>
                        </div>
                      </div>
                      {selectedUser.conversationId && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={deleteSelectedConversation}>
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Messages */}
                    <ScrollArea className="flex-1 px-4 py-3">
                      <div className="space-y-3">
                        {isLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="py-12 text-center">
                            <MessageSquareText className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                            <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
                            <p className="mt-1 text-xs text-muted-foreground/70">Send a message to start the conversation.</p>
                          </div>
                        ) : (
                          messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={cn(
                                  "group flex flex-col",
                                  msg.senderId === currentUser?.id ? "items-end" : "items-start"
                                )}
                              >
                                <div
                                  className={cn(
                                    "relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5",
                                    msg.senderId === currentUser?.id
                                      ? "bg-primary text-primary-foreground rounded-br-md"
                                      : "bg-muted rounded-bl-md"
                                  )}
                                >
                                  {editingMessageId === msg.id ? (
                                    <div className="flex gap-2 items-center">
                                      <input
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), editMessage(msg.id))}
                                        className="flex-1 text-sm bg-background border rounded px-2 py-1 min-w-[150px]"
                                        autoFocus
                                      />
                                      <button onClick={() => editMessage(msg.id)} className="text-xs font-medium text-primary-foreground shrink-0"><Send className="h-3 w-3" /></button>
                                      <button onClick={() => setEditingMessageId(null)} className="text-xs shrink-0"><X className="h-3 w-3" /></button>
                                    </div>
                                  ) : msg.message_type === "image" && msg.image_url ? (
                                    <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-xl overflow-hidden">
                                      <Image 
                                        src={msg.image_url} 
                                        alt="Shared image" 
                                        fill 
                                        className="object-cover"
                                        sizes="(max-width: 640px) 192px, 224px"
                                      />
                                      <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-end justify-end p-2">
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => downloadImage(msg.image_url!)}
                                            className="h-8 w-8 rounded-lg bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                                            title="Download image"
                                          >
                                            <Download className="h-4 w-4 text-white" />
                                          </button>
                                          {msg.senderId === currentUser?.id && (
                                            <button
                                              onClick={() => deleteMessageById(msg.id)}
                                              className="h-8 w-8 rounded-lg bg-red-500/70 flex items-center justify-center hover:bg-red-600 transition-colors"
                                              title="Delete image"
                                            >
                                              <Trash2 className="h-4 w-4 text-white" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                                  )}
                                  {editingMessageId !== msg.id && (
                                    <div className={cn(
                                      "flex items-center justify-between gap-2 mt-1.5",
                                      msg.senderId === currentUser?.id ? "flex-row-reverse" : "flex-row"
                                    )}>
                                      <p className={cn(
                                        "text-[10px]",
                                        msg.senderId === currentUser?.id
                                          ? "text-primary-foreground/60"
                                          : "text-muted-foreground/60"
                                      )}>
                                        {formatTime(msg.timestamp)}
                                      </p>
                                      {msg.senderId === currentUser?.id && msg.message_type !== "image" && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            className="h-5 w-5 rounded flex items-center justify-center hover:bg-primary-foreground/10 transition-colors"
                                            onClick={() => deleteMessageById(msg.id)}
                                            title="Delete"
                                          >
                                            <Trash2 className="h-3 w-3 text-primary-foreground/70" />
                                          </button>
                                          <button
                                            className="h-5 w-5 rounded flex items-center justify-center hover:bg-primary-foreground/10 transition-colors"
                                            onClick={() => { setEditingMessageId(msg.id); setEditText(msg.text) }}
                                            title="Edit"
                                          >
                                            <Pencil className="h-3 w-3 text-primary-foreground/70" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                          ))
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    {/* Input */}
                    <div className="p-3 border-t border-border bg-background/50 shrink-0">
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileSelect}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="h-9 w-9 p-0 shrink-0"
                          aria-label="Attach image"
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Input
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Type a message..."
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                          className="flex-1 h-9 text-sm bg-background border-muted-foreground/20 focus-visible:border-primary/50"
                        />
                        <Button 
                          size="sm" 
                          onClick={sendMessage}
                          disabled={!message.trim()}
                          className="h-9 w-9 p-0 shrink-0"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
