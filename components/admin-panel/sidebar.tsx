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
import { usePermissions } from "@/lib/usePermissions"

interface MenuItem {
  href: string;
  icon: React.ElementType;
  label: string;
  permissionSlug?: string;
  items?: MenuItem[];
}

export function AdminPanelSidebar() {
  const { settings } = useRealtime()
  const pathname = usePathname()
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const unreadOrders = useUnreadOrders()
  const { hasPermission } = usePermissions()

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
      items: [{ href: "/admin-panel", icon: LayoutDashboard, label: "Dashboard", permissionSlug: "dashboard.view" }],
    },
    {
      label: "Management",
      items: [
        { href: "/admin-panel/orders", icon: ShoppingCart, label: "Orders", permissionSlug: "orders.view" },
        { href: "/admin-panel/categories", icon: Package, label: "Categories", permissionSlug: "categories.view" },
        { href: "/admin-panel/products", icon: Package, label: "Products", permissionSlug: "products.view" },
        { href: "/admin-panel/customers", icon: Users, label: "Customers", permissionSlug: "customers.view" },
        { href: "/admin-panel/vendors", icon: Store, label: "Vendors", permissionSlug: "vendors.view" },
        { href: "/admin-panel/riders", icon: Truck, label: "Riders", permissionSlug: "riders.view" },
      ],
    },
    {
      label: "Content & Communication",
      items: [
        { href: "/admin-panel/discussions", icon: MessageSquare, label: "Discussions", permissionSlug: "discussions.view" },
        { href: "/admin-panel/coupons", icon: Tag, label: "Coupons", permissionSlug: "coupons.view" },
        { href: "/admin-panel/promo-codes", icon: Tag, label: "Seller Promo Codes", permissionSlug: "promo_codes.view" },
        { href: "/admin-panel/blog", icon: BookOpen, label: "Blog", permissionSlug: "blog.view" },
        { href: "/admin-panel/messages", icon: Mail, label: "Messages", permissionSlug: "messages.view" },
      ],
    },
    {
      label: "Configuration",
      items: [
        { href: "/admin-panel/settings/general", icon: Settings, label: "General Settings", permissionSlug: "settings.view" },
        { href: "/admin-panel/settings/homepage", icon: BarChart3, label: "Home Page", permissionSlug: "settings.view" },
        { href: "/admin-panel/settings/menu", icon: Menu, label: "Menu Settings", permissionSlug: "settings.view" },
        { href: "/admin-panel/settings/email", icon: Mail, label: "Email Settings", permissionSlug: "settings.view" },
        { href: "/admin-panel/settings/font", icon: BarChart3, label: "Font Options", permissionSlug: "settings.view" },
        { href: "/admin-panel/settings/seo", icon: BarChart3, label: "SEO Tools", permissionSlug: "settings.view" },
      ],
    },
    {
      label: "Advanced",
      items: [
        { href: "/admin-panel/staff", icon: Users2, label: "Staff Management", permissionSlug: "staff.view" },
        { href: "/admin-panel/roles", icon: Users2, label: "Roles & Permissions", permissionSlug: "roles.view" },
        { href: "/admin-panel/subscribers", icon: Users, label: "Subscribers", permissionSlug: "subscribers.view" },
        { href: "/admin-panel/deposits", icon: CreditCard, label: "Customer Deposits", permissionSlug: "deposits.view" },
        { href: "/admin-panel/wallet", icon: Wallet, label: "Wallet Management", permissionSlug: "wallet.view" },
        { href: "/admin-panel/withdrawals", icon: CreditCard, label: "Withdrawals", permissionSlug: "withdrawals.view" },
        { href: "/admin-panel/earnings", icon: CreditCard, label: "Vendor Earnings", permissionSlug: "earnings.view" },
        { href: "/admin-panel/cache", icon: Database, label: "Clear Cache", permissionSlug: "cache.view" },
        { href: "/admin-panel/addons", icon: Zap, label: "Addon Manager", permissionSlug: "addons.view" },
        { href: "/admin-panel/system", icon: Settings, label: "System Activation", permissionSlug: "system.view" },
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

      <nav className="admin-panel-nav flex-1 overflow-y-auto">
        {menuGroups
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => !item.permissionSlug || hasPermission(item.permissionSlug)),
          }))
          .filter((group) => group.items.length > 0)
          .map((group) => (
          <div key={group.label} className="admin-panel-menu-group">
          <h3 className="admin-panel-menu-group-title">{group.label}</h3>
          <div className="admin-panel-menu-items">
            {group.items.map((item) => {
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
        ))}
      </nav>

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
