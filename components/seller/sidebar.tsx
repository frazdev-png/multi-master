"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  MessageSquare,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  X,
} from "lucide-react"
import { useRealtime } from "@/contexts/RealtimeContext"

interface SellerSidebarProps {
  isMobileMenuOpen: boolean
  onMobileMenuClose: () => void
}

export function SellerSidebar({ isMobileMenuOpen, onMobileMenuClose }: SellerSidebarProps) {
  const { settings } = useRealtime()
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/auth/login?role=seller")
  }

  const menuItems = [
    { href: "/seller", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/seller/products", icon: Package, label: "Products" },
    { href: "/seller/orders", icon: ShoppingCart, label: "Orders" },
    { href: "/seller/messages", icon: MessageSquare, label: "Messages" },
    { href: "/seller/wallet", icon: Wallet, label: "Wallet" },
    { href: "/seller/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/seller/settings", icon: Settings, label: "Settings" },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileMenuClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 
        w-64 bg-card border-r border-border min-h-screen flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Mobile close button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/sell1mall-logo.png"
              alt="Sell1Mall"
              className="w-64 object-contain"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-primary truncate">{settings.website_name || "Sell1Mall"}</h1>
            </div>
          </div>
          <button
            onClick={onMobileMenuClose}
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Desktop header */}
        <div className="hidden lg:block p-6 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/sell1mall-logo.png"
              alt="Sell1Mall"
              className="w-64 object-contain"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-primary truncate">{settings.website_name || "Sell1Mall"}</h1>
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
                onClick={onMobileMenuClose}
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
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-danger hover:bg-muted rounded-lg transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}
