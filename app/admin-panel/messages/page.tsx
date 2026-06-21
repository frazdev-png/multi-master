"use client"

import { Send, Search, RefreshCw, Paperclip, Image, FileText, X, ChevronDown } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Message {
  id: number
  conversation_id: number
  sender_id: number
  content: string
  message_type: string
  attachment_url: string | null
  attachment_type: string | null
  created_at: string
  sender_name: string
  sender_avatar: string | null
  sender_role: string
  is_read: boolean
}

interface Conversation {
  conversation_id: number
  other_user_id: number
  other_user_name: string
  other_user_email: string
  other_user_role: string
  last_message: string | null
  last_message_at: string | null
  unread_count: number | string
  status: string
  subject: string | null
}

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  under_review: "bg-yellow-100 text-yellow-700",
  resolved: "bg-blue-100 text-blue-700",
  closed: "bg-gray-100 text-gray-500",
}

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadConversations = async () => {
    try {
      setIsLoading(true)
      setError("")
      const qs = new URLSearchParams()
      if (searchTerm.trim()) qs.set("search", searchTerm.trim())
      if (statusFilter) qs.set("status", statusFilter)
      const res = await fetch(`/api/backend/admin/conversations?${qs.toString()}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load conversations")
      setConversations(Array.isArray(data?.conversations) ? data.conversations : [])
    } catch (e: any) {
      setError(e?.message || "Failed to load conversations")
    } finally {
      setIsLoading(false)
    }
  }

  const loadMessages = async (conversationId: number) => {
    try {
      setError("")
      const res = await fetch(`/api/backend/conversations/${conversationId}/messages`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load messages")
      setMessages(Array.isArray(data?.messages) ? data.messages : [])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0)
    } catch (e: any) {
      setError(e?.message || "Failed to load messages")
    }
  }

  useEffect(() => { loadConversations() }, [])

  const selectConversation = async (conv: Conversation) => {
    setSelectedConvId(conv.conversation_id)
    await loadMessages(conv.conversation_id)
    setConversations((prev) =>
      prev.map((c) => (c.conversation_id === conv.conversation_id ? { ...c, unread_count: 0 } : c)),
    )
  }

  const handleSendMessage = async () => {
    if (!selectedConvId || !messageInput.trim()) return
    try {
      setError("")
      const res = await fetch("/api/backend/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: selectedConvId, content: messageInput.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to send message")
      if (data?.message) setMessages((prev) => [...prev, data.message])
      setMessageInput("")
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0)
    } catch (e: any) {
      setError(e?.message || "Failed to send message")
    }
  }

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedConvId) return

    try {
      setUploadingFile(true)
      setError("")
      const formData = new FormData()
      formData.append("file", file)
      formData.append("conversation_id", String(selectedConvId))
      formData.append("content", "")

      const uploadRes = await fetch("/api/backend/messages/upload", { method: "POST", body: formData })
      const uploadData = await uploadRes.json().catch(() => null)
      if (!uploadRes.ok) throw new Error(uploadData?.error || "Upload failed")

      const attachmentType = uploadData.attachment_type
      const msgRes = await fetch("/api/backend/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: selectedConvId,
          content: file.name,
          message_type: attachmentType === "image" ? "image" : "file",
          attachment_url: uploadData.attachment_url,
          attachment_type: attachmentType,
        }),
      })
      const msgData = await msgRes.json().catch(() => null)
      if (!msgRes.ok) throw new Error(msgData?.error || "Failed to save message")
      if (msgData?.message) setMessages((prev) => [...prev, msgData.message])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0)
    } catch (e: any) {
      setError(e?.message || "Upload failed")
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const updateStatus = async (status: string) => {
    if (!selectedConvId) return
    try {
      setError("")
      const res = await fetch(`/api/backend/conversations/${selectedConvId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to update status")
      setConversations((prev) =>
        prev.map((c) => (c.conversation_id === selectedConvId ? { ...c, status } : c)),
      )
    } catch (e: any) {
      setError(e?.message || "Failed to update status")
    }
  }

  const selectedConv = conversations.find((c) => c.conversation_id === selectedConvId)

  const formatTime = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString()
  }

  const isImage = (url?: string | null) => url && /\.(jpg|jpeg|png|gif|webp)$/i.test(url)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground mt-1">Support chat with customers and vendors</p>
        </div>
        <Button variant="outline" onClick={loadConversations}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadConversations()}
                    className="flex-1 h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setTimeout(loadConversations, 0) }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8" onClick={loadConversations}>Go</Button>
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading...</div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No conversations</div>
                ) : conversations.map((conv) => (
                  <div
                    key={conv.conversation_id}
                    className={`p-3 border-b border-border hover:bg-muted cursor-pointer transition-colors ${selectedConvId === conv.conversation_id ? "bg-muted" : ""}`}
                    onClick={() => selectConversation(conv)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={""} />
                          <AvatarFallback className="text-xs">{(conv.other_user_name || "?").charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{conv.other_user_name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{conv.other_user_role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {Number(conv.unread_count || 0) > 0 && (
                          <Badge variant="default" className="text-xs px-1.5">{conv.unread_count}</Badge>
                        )}
                        {conv.status && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[conv.status] || ""}`}>
                            {conv.status.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                    {conv.subject && <p className="text-xs font-medium truncate">{conv.subject}</p>}
                    <p className="text-xs text-muted-foreground truncate">{conv.last_message || "No messages"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatTime(conv.last_message_at)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="flex flex-col h-[600px]">
            {selectedConv ? (
              <>
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{selectedConv.other_user_name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize bg-muted text-muted-foreground">{selectedConv.other_user_role}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedConv.other_user_email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedConv.status || "open"}
                      onValueChange={updateStatus}
                    >
                      <SelectTrigger className="h-8 text-xs w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="under_review">Under Review</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-background/50">
                  {messages.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center pt-8">No messages yet</div>
                  ) : messages.map((msg) => {
                    const isAdmin = msg.sender_role === "admin"
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] ${isAdmin ? "order-1" : ""}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">{msg.sender_name}</span>
                            <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                          </div>
                          <div className={`px-3 py-2 rounded-lg ${isAdmin ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            {msg.attachment_url && msg.attachment_type === "image" ? (
                              <div className="space-y-1">
                                {msg.content && <p className="text-sm">{msg.content}</p>}
                                <img src={msg.attachment_url} alt="Attachment" className="max-w-full rounded cursor-pointer" style={{ maxHeight: 200 }} onClick={() => window.open(msg.attachment_url, "_blank")} />
                              </div>
                            ) : msg.attachment_url && msg.attachment_type === "document" ? (
                              <div className="flex items-center gap-2">
                                <FileText size={16} />
                                <a href={msg.attachment_url} target="_blank" className="text-sm underline">{msg.content || "Document"}</a>
                              </div>
                            ) : (
                              <p className="text-sm">{msg.content}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-border space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                      className="flex-1"
                    />
                    <input type="file" ref={fileInputRef} onChange={handleUploadFile} className="hidden" accept="image/*,.pdf,.doc,.docx" />
                    <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
                      {uploadingFile ? <RefreshCw size={16} className="animate-spin" /> : <Paperclip size={16} />}
                    </Button>
                    <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                      <Send size={16} />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Attach: images, PDF, DOC (max 10MB)</p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a conversation to start chatting
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
