"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquareText, X, Send, Loader2 } from "lucide-react"

const GUEST_TOKEN_KEY = "multi_master_guest_token"

interface GuestMessage {
  id: number
  sender_id: number
  content: string
  created_at: string
  sender_name: string
}

export function GuestChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<"form" | "chat">("form")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [msg, setMsg] = useState("")
  const [messages, setMessages] = useState<GuestMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [conversationId, setConversationId] = useState<number | null>(null)
  const tokenRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(GUEST_TOKEN_KEY)
    if (saved) {
      tokenRef.current = saved
      fetchConversation(saved)
    }
  }, [])

  const fetchConversation = async (token: string) => {
    try {
      const res = await fetch(`/api/backend/guest/conversations/${token}`)
      const data = await res.json()
      if (data?.success && data?.conversation) {
        setConversationId(data.conversation.id)
        setMessages(data.messages || [])
        setStep("chat")
        setIsOpen(true)
      } else {
        localStorage.removeItem(GUEST_TOKEN_KEY)
        tokenRef.current = null
      }
    } catch {}
  }

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const tok = tokenRef.current
      if (!tok) return
      try {
        const res = await fetch(`/api/backend/guest/conversations/${tok}`)
        const data = await res.json()
        if (data?.success && data?.messages) {
          setMessages(data.messages)
        }
      } catch {}
    }, 5000)
  }, [])

  const handleSubmit = async () => {
    if (!name.trim() || !msg.trim()) return
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/backend/guest/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: msg.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to send")
      if (!data?.token) throw new Error("No token received")

      tokenRef.current = data.token
      localStorage.setItem(GUEST_TOKEN_KEY, data.token)
      setConversationId(data.conversation_id)
      setMessages([{ id: 0, sender_id: 0, content: msg.trim(), created_at: new Date().toISOString(), sender_name: name.trim() }])
      setMsg("")
      setStep("chat")
      startPolling()
    } catch (e: any) {
      setError(e?.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!msg.trim() || !tokenRef.current) return
    const content = msg.trim()
    setMsg("")
    setMessages(prev => [...prev, { id: Date.now(), sender_id: 0, content, created_at: new Date().toISOString(), sender_name: name || "You" }])

    try {
      const res = await fetch(`/api/backend/guest/conversations/${tokenRef.current}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error || "Failed to send")
      }
    } catch (e: any) {
      setError(e?.message || "Failed to send")
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  if (!isOpen) {
    return (
      <button
        onClick={() => !tokenRef.current ? setIsOpen(true) : (setIsOpen(true), setStep("chat"))}
        className="fixed bottom-24 left-4 z-50 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-full shadow-lg hover:bg-primary/90 transition-all"
      >
        <MessageSquareText size={20} />
        <span className="text-sm font-medium">Contact Admin</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 sm:w-96">
      <Card className="shadow-xl border-border">
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <CardTitle className="text-sm font-semibold">Contact Admin</CardTitle>
          <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {step === "form" ? (
            <div className="p-4 space-y-3">
              <Input placeholder="Your name *" value={name} onChange={e => setName(e.target.value)} />
              <Input placeholder="Email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <textarea
                placeholder="Your message *"
                className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={msg}
                onChange={e => setMsg(e.target.value)}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleSubmit} disabled={loading || !name.trim() || !msg.trim()}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                <span className="ml-2">Send Message</span>
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                No account needed. Your conversation will be saved for 30 days.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-[350px]">
              <ScrollArea className="flex-1 p-4">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center mt-8">No messages yet.</p>
                )}
                {messages.map((m, i) => (
                  <div key={m.id || i} className={`mb-3 flex ${m.sender_id === 0 ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.sender_id === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}>
                      <p className="text-[10px] opacity-70 mb-0.5">{m.sender_name}</p>
                      <p>{m.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </ScrollArea>
              <div className="border-t p-3 flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                />
                <Button size="icon" onClick={sendMessage} disabled={!msg.trim()}>
                  <Send size={16} />
                </Button>
              </div>
              {error && <p className="px-3 pb-2 text-xs text-destructive">{error}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
