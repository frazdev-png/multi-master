"use client"

import { useEffect, useState } from "react"

type Toast = { id: number; message: string; type: "success" | "error" }

let toastId = 0
let listeners: ((t: Toast) => void)[] = []

export function notify(message: string, type: "success" | "error" = "success") {
  const t: Toast = { id: ++toastId, message, type }
  listeners.forEach((fn) => fn(t))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<(Toast & { visible: boolean })[]>([])

  useEffect(() => {
    const handler = (t: Toast) => {
      const entry = { ...t, visible: true }
      setToasts((prev) => [...prev, entry])
      setTimeout(() => {
        setToasts((prev) => prev.map((x) => (x.id === t.id ? { ...x, visible: false } : x)))
        setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== t.id))
        }, 300)
      }, 2200)
    }
    listeners.push(handler)
    return () => {
      listeners = listeners.filter((fn) => fn !== handler)
    }
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium transition-opacity duration-300 ${
            t.visible ? "opacity-100" : "opacity-0"
          } ${t.type === "success" ? "bg-green-600" : "bg-red-600"}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
