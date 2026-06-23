"use client"

import { useEffect, useState } from "react"

export function useUnreadOrders() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let mounted = true
    let interval: ReturnType<typeof setInterval>

    const fetchCount = async () => {
      try {
        const res = await fetch("/api/backend/unread-orders")
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

    // Re-fetch when an order event is dispatched
    const onOrder = () => fetchCount()
    window.addEventListener("order:new", onOrder)

    return () => {
      mounted = false
      clearInterval(interval)
      window.removeEventListener("order:new", onOrder)
    }
  }, [])

  return count
}
