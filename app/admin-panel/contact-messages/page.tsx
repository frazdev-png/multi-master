"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Mail, User, Calendar } from "lucide-react"

interface ContactMessage {
  id: number
  name: string
  email: string
  subject: string
  message: string
  is_read: string | number
  created_at: string
}

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ContactMessage | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/backend/contact/messages")
      const data = await res.json()
      if (data?.success) setMessages(data.messages || [])
    } catch {} finally { setLoading(false) }
  }

  const markRead = async (id: number) => {
    try {
      await fetch(`/api/backend/contact/messages/${id}/read`, { method: "PUT" })
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: "1" } : m))
    } catch {}
  }

  useEffect(() => { load() }, [])

  const formatDate = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contact Messages</h1>
          <p className="text-muted-foreground mt-1">Messages from the Contact Us page</p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {loading && messages.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Loading...</div>
              ) : messages.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No messages yet</div>
              ) : messages.map(msg => (
                <div
                  key={msg.id}
                  className={`p-3 border-b border-border cursor-pointer hover:bg-muted transition-colors ${selected?.id === msg.id ? "bg-muted" : ""} ${!Number(msg.is_read) ? "border-l-2 border-l-primary" : ""}`}
                  onClick={() => { setSelected(msg); if (!Number(msg.is_read)) markRead(msg.id) }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate">{msg.name}</p>
                    {!Number(msg.is_read) && <Badge className="text-[9px] px-1 py-0">New</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{msg.subject || msg.message.substring(0, 50)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(msg.created_at)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            {selected ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">{selected.subject || "No Subject"}</h2>
                  <Badge variant={Number(selected.is_read) ? "secondary" : "default"}>
                    {Number(selected.is_read) ? "Read" : "New"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><User size={14} /> {selected.name}</span>
                  <span className="flex items-center gap-1"><Mail size={14} /> {selected.email}</span>
                  <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(selected.created_at)}</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap text-sm">{selected.message}</div>
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                <Mail size={40} className="mx-auto mb-3 opacity-50" />
                <p>Select a message to view</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}