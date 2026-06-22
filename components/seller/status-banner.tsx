"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle } from "lucide-react"

export function StatusBanner() {
  const [status, setStatus] = useState<{ isActive: boolean; isApproved: boolean } | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/backend/auth/me")
        const data = await res.json().catch(() => null)
        if (data?.user) {
          setStatus({
            isActive: data.user.is_active !== 0,
            isApproved: data.user.is_approved !== 0,
          })
        }
      } catch {
        // ignore
      }
    }
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  if (!status) return null

  if (!status.isActive) {
    return (
      <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
        <AlertTriangle size={16} />
        Your account has been suspended. Please contact admin.
      </div>
    )
  }

  if (!status.isApproved) {
    return (
      <div className="bg-yellow-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
        <AlertTriangle size={16} />
        Your account is pending approval. You may have limited access.
      </div>
    )
  }

  return null
}
