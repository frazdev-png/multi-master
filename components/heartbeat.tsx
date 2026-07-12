"use client"

import { useEffect } from "react"

export function Heartbeat() {
  useEffect(() => {
    const ping = async () => {
      try {
        await fetch("/api/backend/auth/heartbeat", { method: "POST" })
      } catch {}
    }

    ping()
    const interval = setInterval(ping, 30000)

    const handleUnload = () => {
      try {
        fetch("/api/backend/auth/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offline: true }),
          keepalive: true,
        })
      } catch {}
    }
    window.addEventListener("beforeunload", handleUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener("beforeunload", handleUnload)
    }
  }, [])

  return null
}
