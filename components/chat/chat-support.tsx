"use client"

import { useEffect, useState } from "react"
import { ChatWidget } from "@/components/chat/chat-widget"
import { GuestChat } from "@/components/chat/guest-chat"

export function ChatSupport() {
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "guest">("loading")

  useEffect(() => {
    fetch("/api/backend/auth/me")
      .then(res => {
        if (res.ok) setAuthState("authenticated")
        else setAuthState("guest")
      })
      .catch(() => setAuthState("guest"))
  }, [])

  if (authState === "loading") return null

  if (authState === "authenticated") return <ChatWidget />

  return <GuestChat />
}
