"use client"

import { Bell, User, Menu, X, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useRealtime } from "@/contexts/RealtimeContext"
import { useRouter } from "next/navigation"

interface SellerHeaderProps {
  onMobileMenuToggle: () => void
  isMobileMenuOpen: boolean
}

interface NotificationItem {
  id: number
  type: string
  title: string
  message: string
  link: string
  is_read: number
  created_at: string
}

export function SellerHeader({ onMobileMenuToggle, isMobileMenuOpen }: SellerHeaderProps) {
  const { settings } = useRealtime()
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/backend/notifications?limit=10")
      const data = await res.json().catch(() => null)
      if (data?.notifications) {
        setNotifications(data.notifications)
        setUnreadCount(data.unread_count || 0)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const markAllRead = async () => {
    try {
      await fetch("/api/backend/notifications/read-all", { method: "PUT" })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
      setUnreadCount(0)
    } catch {
      // ignore
    }
  }

  const markOneRead = async (id: number) => {
    try {
      await fetch(`/api/backend/notifications/${id}/read`, { method: "PUT" })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // ignore
    }
  }

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "account_status": return <Info className="h-4 w-4 text-blue-500" />
      case "success": return <CheckCircle className="h-4 w-4 text-green-500" />
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case "error": return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  return (
    <header className="bg-card border-b border-border h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-muted transition-colors"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div>
          <h2 className="text-lg font-semibold text-foreground truncate">Welcome to {settings.website_name || "Sell1Mall"}</h2>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6" ref={notifRef}>
        <div className="relative">
          <button className="relative text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setShowNotifDropdown(!showNotifDropdown); if (!showNotifDropdown) fetchNotifications() }}>
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <button className="text-xs text-blue-600 hover:text-blue-800" onClick={markAllRead}>
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`} onClick={() => { markOneRead(n.id); if (n.link) router.push(n.link) }}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getNotifIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'} text-foreground truncate`}>{n.title}</p>
                          {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                        </div>
                        {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"></span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors">
          <User size={20} className="text-muted-foreground" />
          <span className="text-sm font-medium hidden sm:inline">Seller</span>
        </button>
      </div>
    </header>
  )
}
