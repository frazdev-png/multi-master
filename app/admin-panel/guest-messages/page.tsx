"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, RefreshCw, MessageSquareText, ArrowLeft } from "lucide-react"

interface GuestMsg {
  id: number
  sender_id: number
  content: string
  message_type: string
  created_at: string
  sender_name: string
  sender_role: string
}

interface GuestConv {
  conversation_id: number
  guest_name: string
  status: string
  last_message: string | null
  last_message_at: string | null
}

export default function AdminGuestMessagesPage() {
  const [convs, setConvs] = useState<GuestConv[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<GuestMsg[]>([])
  const [reply, setReply] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [viewing, setViewing] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const loadConvs = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/backend/admin/guest-conversations")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed")
      setConvs(data?.conversations || [])
    } catch (e: any) {
      setError(e?.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (id: number) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/backend/admin/guest-conversations/${id}/messages`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed")
      setMessages(data?.messages || [])
      setViewing(true)
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 0)
    } catch (e: any) {
      setError(e?.message)
    } finally {
      setLoading(false)
    }
  }

  const sendReply = async () => {
    if (!reply.trim() || !selectedId) return
    const content = reply.trim()
    setReply("")
    setMessages(prev => [...prev, { id: Date.now(), sender_id: -1, content, message_type: "text", created_at: new Date().toISOString(), sender_name: "You", sender_role: "admin" }])

    try {
      const res = await fetch("/api/backend/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: selectedId, content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to send")
    } catch (e: any) {
      setError(e?.message || "Failed to send")
    }
  }

  useEffect(() => { loadConvs() }, [])

  useEffect(() => {
    if (!selectedId) return
    const interval = setInterval(() => {
      fetch(`/api/backend/admin/guest-conversations/${selectedId}/messages`)
        .then(r => r.json())
        .then(d => { if (d?.messages) setMessages(d.messages) })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [selectedId])

  const formatTime = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Guest Messages</h1>
          <p className="text-muted-foreground mt-1">Messages from visitors without an account</p>
        </div>
        <Button variant="outline" onClick={loadConvs}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                {loading && convs.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading...</div>
                ) : convs.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No guest messages yet</div>
                ) : convs.map(conv => (
                  <div
                    key={conv.conversation_id}
                    className={`p-3 border-b border-border hover:bg-muted cursor-pointer transition-colors ${selectedId === conv.conversation_id ? "bg-muted" : ""}`}
                    onClick={() => { setSelectedId(conv.conversation_id); loadMessages(conv.conversation_id) }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold shrink-0">G</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{conv.guest_name}</p>
                      </div>
                      {conv.status && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">{conv.status}</Badge>
                      )}
                    </div>
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
            {viewing && selectedId ? (
              <>
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setViewing(false); setSelectedId(null) }}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">G</div>
                  <div>
                    <p className="font-bold text-sm">{convs.find(c => c.conversation_id === selectedId)?.guest_name || "Guest"}</p>
                    <p className="text-[11px] text-muted-foreground">Guest</p>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {messages.map(msg => {
                      const isAdmin = msg.sender_role === "admin" || msg.sender_id === -1
                      return (
                        <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] px-3 py-2 rounded-lg ${isAdmin ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            <p className="text-[10px] opacity-70 mb-0.5">{msg.sender_name}</p>
                            <p className="text-sm">{msg.content}</p>
                            <p className="text-[9px] opacity-50 mt-0.5">{formatTime(msg.created_at)}</p>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={endRef} />
                  </div>
                </ScrollArea>

                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Reply as admin..."
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendReply()}
                    />
                    <Button onClick={sendReply} disabled={!reply.trim()}>
                      <Send size={16} />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                {convs.length > 0 ? "Select a guest conversation to reply" : "No guest messages available"}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}