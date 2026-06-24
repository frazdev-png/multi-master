"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Store,
  Users2,
  Truck,
  MessageSquare,
  Tag,
  BookOpen,
  Mail,
  Settings,
  BarChart3,
  CreditCard,
  Database,
  Zap,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Wallet
} from "lucide-react"
import { useState, useEffect } from "react"
import { useRealtime } from "@/contexts/RealtimeContext"
import { useUnreadOrders } from "@/lib/useUnreadOrders"

interface MenuItem {
  href: string;
  icon: React.ElementType;
  label: string;
  permission?: string;
  items?: MenuItem[];
}

const PERMISSION_MAP: Record<string, string> = {
  "Dashboard": "dashboard.view",
  "Orders": "orders.view",
  "Categories": "categories.view",
  "Products": "products.view",
  "Customers": "customers.view",
  "Vendors": "vendors.view",
  "Riders": "riders.view",
  "Discussions": "discussions.view",
  "Coupons": "coupons.view",
  "Seller Promo Codes": "promo-codes.view",
  "Blog": "blog.view",
  "Messages": "messages.view",
  "General Settings": "settings.general",
  "Home Page": "settings.homepage",
  "Menu Settings": "settings.menu",
  "Email Settings": "settings.email",
  "Font Options": "settings.font",
  "SEO Tools": "settings.seo",
  "Staff Management": "staff.view",
  "Roles & Permissions": "roles.view",
  "Subscribers": "subscribers.view",
  "Customer Deposits": "deposits.view",
  "Wallet Management": "wallet.view",
  "Withdrawals": "withdrawals.view",
  "Vendor Earnings": "earnings.view",
  "Clear Cache": "cache.manage",
  "Addon Manager": "addons.manage",
  "System Activation": "system.manage",
}

export function AdminPanelSidebar() {
  const { settings } = useRealtime()
  const pathname = usePathname()
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [permsLoaded, setPermsLoaded] = useState(false)
  const unreadOrders = useUnreadOrders()

  useEffect(() => {
    fetch("/api/backend/admin/my-permissions")
      .then(r => r.json())
      .then(data => {
        setUserPermissions(Array.isArray(data?.permissions) ? data.permissions : [])
        setPermsLoaded(true)
      })
      .catch(() => setPermsLoaded(true))
  }, [])

  const hasPermission = (label: string) => {
    const perm = PERMISSION_MAP[label]
    if (!perm) return true
    return userPermissions.includes(perm)
  }

  const filterItems = (items: MenuItem[]): MenuItem[] =>
    items.filter(item => hasPermission(item.label))

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    handleResize()

    // Add event listener
    window.addEventListener('resize', handleResize)
    
    // Add event listener for custom toggle event
    const handleToggleSidebar = () => {
      setSidebarOpen(prev => !prev)
    }
    window.addEventListener('toggleSidebar', handleToggleSidebar)
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('toggleSidebar', handleToggleSidebar)
    }
  }, [])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const handleLogout = () => {
    window.location.href = "/api/auth/logout"
  }

  const menuGroups: { label: string; items: MenuItem[] }[] = [
    {
      label: "Main",
      items: [{ href: "/admin-panel", icon: LayoutDashboard, label: "Dashboard" }],
    },
    {
      label: "Management",
      items: [
        { href: "/admin-panel/orders", icon: ShoppingCart, label: "Orders" },
        { href: "/admin-panel/categories", icon: Package, label: "Categories" },
        { href: "/admin-panel/products", icon: Package, label: "Products" },
        { href: "/admin-panel/customers", icon: Users, label: "Customers" },
        { href: "/admin-panel/vendors", icon: Store, label: "Vendors" },
        { href: "/admin-panel/riders", icon: Truck, label: "Riders" },
      ],
    },
    {
      label: "Content & Communication",
      items: [
        { href: "/admin-panel/discussions", icon: MessageSquare, label: "Discussions" },
        { href: "/admin-panel/coupons", icon: Tag, label: "Coupons" },
        { href: "/admin-panel/promo-codes", icon: Tag, label: "Seller Promo Codes" },
        { href: "/admin-panel/blog", icon: BookOpen, label: "Blog" },
        { href: "/admin-panel/messages", icon: Mail, label: "Messages" },
      ],
    },
    {
      label: "Configuration",
      items: [
        { href: "/admin-panel/settings/general", icon: Settings, label: "General Settings" },
        { href: "/admin-panel/settings/homepage", icon: BarChart3, label: "Home Page" },
        { href: "/admin-panel/settings/menu", icon: Menu, label: "Menu Settings" },
        { href: "/admin-panel/settings/email", icon: Mail, label: "Email Settings" },
        { href: "/admin-panel/settings/font", icon: BarChart3, label: "Font Options" },
        { href: "/admin-panel/settings/seo", icon: BarChart3, label: "SEO Tools" },
      ],
    },
    {
      label: "Advanced",
      items: [
        { href: "/admin-panel/staff", icon: Users2, label: "Staff Management" },
        { href: "/admin-panel/roles", icon: Users2, label: "Roles & Permissions" },
        { href: "/admin-panel/subscribers", icon: Users, label: "Subscribers" },
        { href: "/admin-panel/deposits", icon: CreditCard, label: "Customer Deposits" },
        { href: "/admin-panel/wallet", icon: Wallet, label: "Wallet Management" },
        { href: "/admin-panel/withdrawals", icon: CreditCard, label: "Withdrawals" },
        { href: "/admin-panel/earnings", icon: CreditCard, label: "Vendor Earnings" },
        { href: "/admin-panel/cache", icon: Database, label: "Clear Cache" },
        { href: "/admin-panel/addons", icon: Zap, label: "Addon Manager" },
        { href: "/admin-panel/system", icon: Settings, label: "System Activation" },
      ],
    },
  ]

  return (
    <>
      {/* Mobile menu button */}
      <button 
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-2 rounded-md bg-card border border-border lg:hidden"
        aria-label="Toggle menu"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {sidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside 
        className={`admin-panel-sidebar ${sidebarOpen ? 'open' : ''}`}
      >
        <div className="admin-panel-sidebar-header">
          <div className="flex items-center gap-3">
            <img
              src="/sell1mall-logo.png"
              alt="Sell1Mall"
              className="w-64 object-contain"
            />
          </div>
          <p className="admin-panel-subtitle">Admin Dashboard</p>
        </div>

      {!permsLoaded ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
      ) : (
      <nav className="admin-panel-nav flex-1 overflow-y-auto">
        {menuGroups.map((group) => {
          const filteredItems = filterItems(group.items)
          if (filteredItems.length === 0) return null
          return (
          <div key={group.label} className="admin-panel-menu-group">
          <h3 className="admin-panel-menu-group-title">{group.label}</h3>
          <div className="admin-panel-menu-items">
            {filteredItems.map((item) => {
              const isActive = pathname === item.href
              const hasChildren = item.items && item.items.length > 0
              const isExpanded = expandedMenu === group.label

              if (hasChildren) {
                return (
                  <div key={item.href} className="w-full">
                    <button
                      onClick={() => setExpandedMenu(isExpanded ? null : group.label)}
                      className={`admin-panel-menu-item w-full text-left justify-between ${
                        isActive ? 'active' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon size={18} className="mr-3" />
                        <span>{item.label}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <div className="pl-11 pr-2 py-1 space-y-1">
                        {item.items?.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={`block px-3 py-2 text-sm rounded-md ${
                              pathname === subItem.href
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-muted'
                            }`}
                            onClick={() => isMobile && toggleSidebar()}
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-panel-menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => isMobile && toggleSidebar()}
                >
                  <item.icon size={18} className="mr-3" />
                  <span>{item.label}</span>
                  {item.label === "Orders" && unreadOrders > 0 && (
                    <span className="ml-auto min-w-5 h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadOrders > 99 ? "99+" : unreadOrders}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
        )})}
      </nav>
      )}

        <div className="mt-auto p-4 border-t border-border">
          <button 
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
