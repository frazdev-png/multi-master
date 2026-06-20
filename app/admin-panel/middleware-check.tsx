"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminMiddlewareCheck() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch("/api/backend/auth/me")
        const data = await res.json().catch(() => null)

        if (cancelled) return

        const role = data?.user?.role
        if (!res.ok || !role) {
          router.push("/auth/admin-login")
          return
        }

        if (role !== "admin") {
          if (role === "seller") {
            router.push("/seller")
          } else {
            router.push("/customer")
          }
          return
        }

        setIsAuthenticated(true)
      } catch {
        if (cancelled) return
        router.push("/auth/admin-login")
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [router])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return null
}
