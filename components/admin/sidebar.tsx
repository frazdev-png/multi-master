"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { LayoutDashboard, Users, Store, Package, ShoppingCart, MessageSquare, Settings, LogOut, Menu, X } from "lucide-react"
import { useRealtime } from "@/contexts/RealtimeContext"

export function AdminSidebar() {
  const { settings } = useRealtime()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) {
        setIsOpen(true)
      } else {
        setIsOpen(false)
      }
    }
    
    checkIfMobile()
    window.addEventListener('resize', checkIfMobile)
    
    return () => window.removeEventListener('resize', checkIfMobile)
  }, [])

  const menuItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/users", icon: Users, label: "Users" },
    { href: "/admin/sellers", icon: Store, label: "Sellers" },
    { href: "/admin/products", icon: Package, label: "Products" },
    { href: "/admin/orders", icon: ShoppingCart, label: "Orders" },
    { href: "/admin/messages", icon: MessageSquare, label: "Messages" },
    { href: "/admin/settings", icon: Settings, label: "Settings" },
  ]

  const toggleSidebar = () => {
    if (isMobile) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <>
      {/* Mobile menu button */}
      <button 
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-2 rounded-md bg-card border border-border md:hidden"
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {isOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed md:static z-50 w-64 bg-card border-r border-border min-h-screen flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <img
              src={settings.logo_url || "/sell1mall-logo.png"}
              alt={settings.website_name || "Sell1Mall"}
              className="w-64 object-contain"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).src = "/placeholder-logo.png"
              }}
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-primary truncate">{settings.website_name || "Sell1Mall"}</h1>
              <p className="text-sm text-muted-foreground mt-1">Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={toggleSidebar}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button 
            className="flex items-center justify-center md:justify-start gap-3 w-full px-4 py-3 text-danger hover:bg-muted rounded-lg transition-colors"
            onClick={() => {
              // Add logout logic here
              console.log('Logout clicked')
            }}
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}
