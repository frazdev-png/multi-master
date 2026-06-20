"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { SellerSidebar } from "@/components/seller/sidebar"
import { SellerHeader } from "@/components/seller/header"
import { Search, Send, Paperclip, Mail, Reply, Trash2, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface Conversation {
  conversation_id: number
  created_at?: string
  updated_at?: string
  other_user_id: number
  other_user_name: string
  other_user_email: string
  other_user_avatar?: string
  other_user_online?: number | boolean
  last_message?: string
  last_message_at?: string
  unread_count?: number
}

interface ChatMessage {
  id: number
  conversation_id: number
  sender_id: number
  content: string
  message_type?: string
  created_at: string
  sender_name?: string
  sender_avatar?: string
  is_read?: boolean
}

export default function SellerMessagesPage() {
  const [me, setMe] = useState<any>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [replyText, setReplyText] = useState("")
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((v) => !v)
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setIsLoadingConversations(true)
        setError("")

        const [meRes, convRes] = await Promise.all([fetch("/api/backend/auth/me"), fetch("/api/backend/conversations")])

        const meData = await meRes.json().catch(() => null)
        const convData = await convRes.json().catch(() => null)

        if (!meRes.ok) {
          throw new Error(meData?.error || "Failed to load user")
        }

        if (!convRes.ok) {
          throw new Error(convData?.error || "Failed to load conversations")
        }

        if (cancelled) return
        setMe(meData?.user || null)
        setConversations(Array.isArray(convData?.conversations) ? convData.conversations : [])
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message || "Failed to load messages")
      } finally {
        if (cancelled) return
        setIsLoadingConversations(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredConversations = useMemo(() => {
    const s = searchTerm.trim().toLowerCase()
    if (!s) return conversations
    return conversations.filter((c) => {
      return (
        (c.other_user_name || "").toLowerCase().includes(s) ||
        (c.other_user_email || "").toLowerCase().includes(s) ||
        (c.last_message || "").toLowerCase().includes(s)
      )
    })
  }, [conversations, searchTerm])

  const selectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv)
    setShowReplyBox(false)
    setReplyText("")
    setIsLoadingMessages(true)
    setError("")

    try {
      const res = await fetch(`/api/backend/conversations/${conv.conversation_id}/messages`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load conversation messages")
      }
      const msgs = Array.isArray(data?.messages) ? data.messages : []
      setThreadMessages(msgs)
      setConversations((prev) =>
        prev.map((c) => (c.conversation_id === conv.conversation_id ? { ...c, unread_count: 0 } : c)),
      )
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 0)
    } catch (e: any) {
      setError(e?.message || "Failed to load messages")
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const deleteConversationLocal = (conversationId: number) => {
    setConversations((prev) => prev.filter((c) => c.conversation_id !== conversationId))
    if (selectedConversation?.conversation_id === conversationId) {
      setSelectedConversation(null)
      setThreadMessages([])
    }
  }

  const sendReply = async () => {
    if (!selectedConversation) return
    if (!replyText.trim()) return

    try {
      const res = await fetch("/api/backend/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: selectedConversation.conversation_id, content: replyText.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to send message")
      }

      const newMsg = data?.message
      if (newMsg) {
        setThreadMessages((prev) => [...prev, newMsg])
        setConversations((prev) =>
          prev.map((c) =>
            c.conversation_id === selectedConversation.conversation_id
              ? { ...c, last_message: newMsg.content, last_message_at: newMsg.created_at }
              : c,
          ),
        )
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 0)
      }

      setReplyText("")
      setShowReplyBox(false)
    } catch (e: any) {
      setError(e?.message || "Failed to send message")
    }
  }

  const formatTime = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return d.toLocaleString()
  }

  return (
    <div className="flex bg-background">
      <SellerSidebar isMobileMenuOpen={isMobileMenuOpen} onMobileMenuClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col">
        <SellerHeader onMobileMenuToggle={toggleMobileMenu} isMobileMenuOpen={isMobileMenuOpen} />

        <main className="flex-1 p-8">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Messages</h1>
              <p className="text-muted-foreground">Communicate with your customers</p>
            </div>
            <div className="flex gap-4 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline">
                <Archive className="mr-2 h-4 w-4" />
                Archive All
              </Button>
            </div>
          </div>

          {error ? (
            <Card className="mb-6">
              <CardContent className="p-4">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Messages List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Inbox</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {isLoadingConversations ? (
                      <div className="p-4 text-sm text-muted-foreground">Loading conversations...</div>
                    ) : filteredConversations.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">No conversations yet.</div>
                    ) : (
                      filteredConversations.map((conv) => (
                        <div
                          key={conv.conversation_id}
                          className={`p-4 cursor-pointer hover:bg-muted transition-colors ${
                            selectedConversation?.conversation_id === conv.conversation_id ? "bg-muted" : ""
                          } ${Number(conv.unread_count || 0) > 0 ? "border-l-4 border-primary" : ""}`}
                          onClick={() => selectConversation(conv)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={conv.other_user_avatar} />
                                <AvatarFallback>{(conv.other_user_name || "?").charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{conv.other_user_name}</p>
                                <p className="text-xs text-muted-foreground">{formatTime(conv.last_message_at || conv.updated_at)}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 items-center">
                              {Number(conv.unread_count || 0) > 0 ? (
                                <Badge variant="secondary" className="text-xs">
                                  {conv.unread_count} new
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <p className="text-sm font-medium mb-1 line-clamp-1">Conversation</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{conv.last_message || "No messages yet"}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Message Detail */}
            <div className="lg:col-span-2">
              {selectedConversation ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={selectedConversation.other_user_avatar} />
                          <AvatarFallback>{(selectedConversation.other_user_name || "?").charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{selectedConversation.other_user_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{selectedConversation.other_user_email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Reply className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteConversationLocal(selectedConversation.conversation_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="border rounded-lg p-4 bg-muted/30 max-h-[360px] overflow-y-auto">
                        {isLoadingMessages ? (
                          <div className="text-sm text-muted-foreground">Loading messages...</div>
                        ) : threadMessages.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No messages yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {threadMessages.map((m) => {
                              const isMine = me?.id != null && Number(m.sender_id) === Number(me.id)
                              return (
                                <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                                  <div
                                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                      isMine ? "bg-primary text-primary-foreground" : "bg-background border"
                                    }`}
                                  >
                                    <div>{m.content}</div>
                                    <div className={`mt-1 text-[11px] ${isMine ? "opacity-80" : "text-muted-foreground"}`}>
                                      {formatTime(m.created_at)}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                            <div ref={messagesEndRef} />
                          </div>
                        )}
                      </div>

                      {/* Reply Box */}
                      <div className="border-t pt-4">
                        {!showReplyBox ? (
                          <Button onClick={() => setShowReplyBox(true)} className="w-full">
                            <Reply className="mr-2 h-4 w-4" />
                            Reply to Message
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <Textarea
                              placeholder="Type your reply..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="min-h-[100px]"
                            />
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                <Paperclip className="mr-2 h-4 w-4" />
                                Attach File
                              </Button>
                              <div className="flex-1"></div>
                              <Button variant="outline" onClick={() => setShowReplyBox(false)}>
                                Cancel
                              </Button>
                              <Button onClick={sendReply}>
                                <Send className="mr-2 h-4 w-4" />
                                Send Reply
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Select a message to view details</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
