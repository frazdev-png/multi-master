"use client"

import { useEffect, useState } from "react"

export function useUnreadMessages() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let mounted = true
    let interval: ReturnType<typeof setInterval>

    const fetchCount = async () => {
      try {
        const res = await fetch("/api/backend/unread-messages")
        if (!res.ok) return
        const data = await res.json().catch(() => null)
        if (mounted && data && typeof data.count === "number") {
          setCount(data.count)
        }
      } catch {
        // ignore
      }
    }

    fetchCount()
    interval = setInterval(fetchCount, 15000)

    // Also re-fetch when a new message event is dispatched
    const onMessage = () => fetchCount()
    window.addEventListener("message:new", onMessage)

    return () => {
      mounted = false
      clearInterval(interval)
      window.removeEventListener("message:new", onMessage)
    }
  }, [])

  return count
}
