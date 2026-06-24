"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AdminPanelSidebar } from "@/components/admin-panel/sidebar"
import { AdminPanelHeader } from "@/components/admin-panel/header"
import { usePermissions } from "@/lib/usePermissions"

import AdminMiddlewareCheck from "./middleware-check"
import "@/styles/admin-panel.css"

const permissionMap: Record<string, string> = {
  "/admin-panel": "dashboard.view",
  "/admin-panel/orders": "orders.view",
  "/admin-panel/categories": "categories.view",
  "/admin-panel/products": "products.view",
  "/admin-panel/customers": "customers.view",
  "/admin-panel/vendors": "vendors.view",
  "/admin-panel/riders": "riders.view",
  "/admin-panel/discussions": "discussions.view",
  "/admin-panel/coupons": "coupons.view",
  "/admin-panel/promo-codes": "promo_codes.view",
  "/admin-panel/blog": "blog.view",
  "/admin-panel/messages": "messages.view",
  "/admin-panel/settings/general": "settings.view",
  "/admin-panel/settings/homepage": "settings.view",
  "/admin-panel/settings/menu": "settings.view",
  "/admin-panel/settings/email": "settings.view",
  "/admin-panel/settings/font": "settings.view",
  "/admin-panel/settings/seo": "settings.view",
  "/admin-panel/settings/password": "settings.view",
  "/admin-panel/staff": "staff.view",
  "/admin-panel/roles": "roles.view",
  "/admin-panel/subscribers": "subscribers.view",
  "/admin-panel/deposits": "deposits.view",
  "/admin-panel/wallet": "wallet.view",
  "/admin-panel/withdrawals": "withdrawals.view",
  "/admin-panel/earnings": "earnings.view",
  "/admin-panel/cache": "cache.view",
  "/admin-panel/addons": "addons.view",
  "/admin-panel/system": "system.view",
}

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { loaded, hasPermission } = usePermissions()

  useEffect(() => {
    if (!loaded) return
    const requiredPerm = permissionMap[pathname]
    if (requiredPerm && !hasPermission(requiredPerm)) {
      router.push("/admin-panel")
    }
  }, [pathname, loaded, hasPermission, router])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    handleResize()

    window.addEventListener('resize', handleResize)
    window.addEventListener('toggleSidebar', () => setSidebarOpen(prev => !prev))
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('toggleSidebar', () => {})
    }
  }, [])

  return (
      <div className="flex h-screen bg-background">
        <AdminMiddlewareCheck />
        <AdminPanelSidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminPanelHeader />
          
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/20">
            {children}
          </main>
        </div>
      </div>
  )
}
