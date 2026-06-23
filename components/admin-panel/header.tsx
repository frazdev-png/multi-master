"use client"

import { Bell, User, Search, Settings, LogOut, Menu, X, CheckCircle, AlertCircle, Info, Package, DollarSign, Users, ShoppingCart, AlertTriangle, XCircle, MessageCircle } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useUnreadMessages } from "@/lib/useUnreadMessages"

interface Notification {
  id: number
  type: "success" | "warning" | "error" | "info"
  title: string
  message: string
  time: string
  read: boolean
  icon: React.ReactNode
  action?: {
    label: string
    href: string
  }
}

export function AdminPanelHeader() {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      type: "success",
      title: "New Order Received",
      message: "Order #12345 has been placed successfully",
      time: "2 minutes ago",
      read: false,
      icon: <ShoppingCart className="h-4 w-4 text-green-600" />,
      action: {
        label: "View Order",
        href: "/admin-panel/orders"
      }
    },
    {
      id: 2,
      type: "warning",
      title: "Low Stock Alert",
      message: "Product 'Wireless Headphones' is running low on stock (5 remaining)",
      time: "15 minutes ago",
      read: false,
      icon: <Package className="h-4 w-4 text-yellow-600" />,
      action: {
        label: "Manage Stock",
        href: "/admin-panel/products"
      }
    },
    {
      id: 3,
      type: "info",
      title: "New Vendor Registration",
      message: "Tech Store has applied to become a vendor",
      time: "1 hour ago",
      read: true,
      icon: <Users className="h-4 w-4 text-blue-600" />,
      action: {
        label: "Review Application",
        href: "/admin-panel/vendors"
      }
    },
    {
      id: 4,
      type: "error",
      title: "Payment Processing Failed",
      message: "Payment for order #12342 could not be processed",
      time: "2 hours ago",
      read: true,
      icon: <DollarSign className="h-4 w-4 text-red-600" />,
      action: {
        label: "Investigate",
        href: "/admin-panel/orders"
      }
    },
    {
      id: 5,
      type: "warning",
      title: "System Maintenance",
      message: "Scheduled maintenance in 6 hours",
      time: "3 hours ago",
      read: true,
      icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />
    }
  ])
  const [adminEmail, setAdminEmail] = useState("admin@sell1mall.com")
  const unreadMessages = useUnreadMessages()
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    
    checkIfMobile()
    window.addEventListener('resize', checkIfMobile)
    
    return () => window.removeEventListener('resize', checkIfMobile)
  }, [])

  useEffect(() => {
    const cookies = document.cookie.split(";")
    const emailCookie = cookies.find((c) => c.trim().startsWith("admin_email="))
    if (emailCookie) {
      setAdminEmail(decodeURIComponent(emailCookie.split("=")[1]))
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNotifications) {
        const target = event.target as HTMLElement
        if (!target.closest('.notification-dropdown')) {
          setShowNotifications(false)
        }
      }
      if (showUserMenu) {
        const target = event.target as HTMLElement
        if (!target.closest('.user-menu')) {
          setShowUserMenu(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifications, showUserMenu])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/auth/admin-login"
  }

  const markAsRead = (notificationId: number) => {
    setNotifications(notifications.map(notif =>
      notif.id === notificationId ? { ...notif, read: true } : notif
    ))
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map(notif => ({ ...notif, read: true })))
  }

  const deleteNotification = (notificationId: number) => {
    setNotifications(notifications.filter(notif => notif.id !== notificationId))
  }

  const clearAllNotifications = () => {
    setNotifications([])
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const getNotificationIcon = (type: string) => {
    switch(type) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-600" />
      case "warning": return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case "error": return <XCircle className="h-4 w-4 text-red-600" />
      case "info": return <Info className="h-4 w-4 text-blue-600" />
      default: return <Info className="h-4 w-4 text-gray-600" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch(type) {
      case "success": return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
      case "warning": return "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
      case "error": return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
      case "info": return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
      default: return "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Mobile menu button - only show on mobile */}
        <button
          className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => {
            // This will be handled by the sidebar component
            const event = new CustomEvent('toggleSidebar')
            window.dispatchEvent(event)
          }}
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Search bar - hidden on mobile when search is not active */}
        <div className={`${showMobileSearch ? 'block' : 'hidden'} lg:block flex-1 max-w-2xl mx-4`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search orders, products, users..."
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              onBlur={() => isMobile && setShowMobileSearch(false)}
              autoFocus={showMobileSearch}
            />
            {isMobile && showMobileSearch && (
              <button
                onClick={() => setShowMobileSearch(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Search button - only show on mobile */}
          <button
            className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setShowMobileSearch(!showMobileSearch)}
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Messages */}
          <Link
            href="/messaging"
            className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Chat"
            title="Chat"
          >
            <MessageCircle className="h-5 w-5" />
            {unreadMessages > 0 ? (
              <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            ) : null}
          </Link>

          {/* Notifications */}
          <div className="relative notification-dropdown">
            <button 
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500"></span>
              )}
            </button>

            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-96 rounded-md shadow-lg bg-card border border-border z-50 max-h-96 overflow-hidden">
                  {/* Header */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Notifications</h3>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {unreadCount} unread
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={markAllAsRead}
                          className="text-xs"
                        >
                          Mark all read
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Notifications List */}
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors ${
                            !notification.read ? 'bg-muted/30' : ''
                          }`}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {notification.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {notification.title}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteNotification(notification.id)
                                  }}
                                  className="flex-shrink-0 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {notification.message}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-muted-foreground">
                                  {notification.time}
                                </span>
                                {notification.action && (
                                  <Link href={notification.action.href}>
                                    <Button variant="ghost" size="sm" className="text-xs h-auto py-1 px-2">
                                      {notification.action.label}
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No notifications</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="p-3 border-t border-border bg-muted/30">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllNotifications}
                        className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        Clear all notifications
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Settings */}
          <Link 
            href="/admin-panel/settings" 
            className={`p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted ${
              pathname === '/admin-panel/settings' ? 'text-foreground bg-muted' : ''
            }`}
          >
            <Settings className="h-5 w-5" />
          </Link>

          {/* Theme Toggle */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {/* User Menu */}
          <div className="relative ml-2 user-menu">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-1 rounded-full hover:bg-muted"
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">Admin</span>
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-card border border-border z-50">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium">{adminEmail}</p>
                    <p className="text-xs text-muted-foreground">Administrator</p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
