"use client"

import { AdminSidebar } from "@/components/admin/sidebar"
import { AdminHeader } from "@/components/admin/header"
import { StatCard } from "@/components/admin/stat-card"
import { Users, ShoppingCart, TrendingUp, AlertCircle, Clock, CheckCircle, XCircle, MoreHorizontal } from "lucide-react"
import { useState, useEffect } from "react"
import { formatCurrency } from "@/lib/utils"

export default function AdminDashboard() {
  const [isClient, setIsClient] = useState(false)
  const [statsData, setStatsData] = useState<any>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [frozenAccounts, setFrozenAccounts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  
  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setIsLoading(true)
        setError("")

        const [statsRes, ordersRes, frozenRes] = await Promise.all([
          fetch("/api/backend/admin/dashboard/stats"),
          fetch("/api/backend/admin/orders/recent?limit=10"),
          fetch("/api/backend/admin/accounts/frozen"),
        ])

        const statsJson = await statsRes.json().catch(() => null)
        const ordersJson = await ordersRes.json().catch(() => null)
        const frozenJson = await frozenRes.json().catch(() => null)

        if (!statsRes.ok) throw new Error(statsJson?.error || "Failed to load stats")
        if (!ordersRes.ok) throw new Error(ordersJson?.error || "Failed to load recent orders")
        if (!frozenRes.ok) throw new Error(frozenJson?.error || "Failed to load frozen accounts")

        if (!cancelled) {
          setStatsData(statsJson?.stats || null)
          setRecentOrders(ordersJson?.orders || [])
          setFrozenAccounts(frozenJson?.accounts || [])
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load dashboard")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (isClient) {
      load()
    }

    return () => {
      cancelled = true
    }
  }, [isClient])

  const stats = [
    {
      title: "Total Users",
      value: Number(statsData?.total_users || 0).toLocaleString(),
      subtitle: `+${Number(statsData?.new_users || 0).toLocaleString()} (30d)`,
      icon: <Users className="w-6 h-6 md:w-7 md:h-7" />,
      trend: "up" as const,
      trendValue: "",
    },
    {
      title: "Total Orders",
      value: Number(statsData?.total_orders || 0).toLocaleString(),
      subtitle: `${formatCurrency(Number(statsData?.total_revenue || 0))} revenue`,
      icon: <ShoppingCart className="w-6 h-6 md:w-7 md:h-7" />,
      trend: "up" as const,
      trendValue: "",
    },
    {
      title: "Active Sellers",
      value: Number(statsData?.active_sellers || 0).toLocaleString(),
      subtitle: `+${Number(statsData?.new_sellers || 0).toLocaleString()} (30d)`,
      icon: <TrendingUp className="w-6 h-6 md:w-7 md:h-7" />,
      trend: "up" as const,
      trendValue: "",
    },
    {
      title: "Frozen Accounts",
      value: Number(statsData?.frozen_accounts || 0).toLocaleString(),
      subtitle: "Requires action",
      icon: <AlertCircle className="w-6 h-6 md:w-7 md:h-7" />,
      trend: "down" as const,
      trendValue: "",
    },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" /> Delivered
          </span>
        )
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Clock className="w-3 h-3 mr-1" /> Processing
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XCircle className="w-3 h-3 mr-1" /> Cancelled
          </span>
        )
      default:
        return null
    }
  }

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row bg-background min-h-screen">
      <AdminSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">Welcome back! Here's your platform overview.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            {stats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </div>

          {isLoading && <div className="text-muted-foreground mb-6">Loading dashboard...</div>}
          {!isLoading && error && <div className="text-red-600 mb-6">{error}</div>}

          {/* Recent Orders Section */}
          <div className="bg-card rounded-lg shadow-sm border border-border mb-6 md:mb-8 overflow-hidden">
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-bold">Recent Orders</h2>
                <button className="text-sm text-primary hover:text-primary/80 transition-colors">
                  View All
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {/* Table for desktop */}
                  <div className="hidden md:block">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-muted-foreground border-b border-border">
                          <th className="py-3 px-4 font-medium">Order ID</th>
                          <th className="py-3 px-4 font-medium">Customer</th>
                          <th className="py-3 px-4 font-medium text-right">Amount</th>
                          <th className="py-3 px-4 font-medium">Status</th>
                          <th className="py-3 px-4 font-medium text-right">Date</th>
                          <th className="py-3 pl-4 pr-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {recentOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-4 font-medium">#{order.id}</td>
                            <td className="py-3 px-4">{order.customer_name || order.customer}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(Number(order.total_amount || 0))}</td>
                            <td className="py-3 px-4">
                              {getStatusBadge((order.status || "").toString().toLowerCase())}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-right">
                              {order.created_at ? new Date(order.created_at).toLocaleDateString() : order.date}
                            </td>
                            <td className="py-3 pl-4 pr-2 text-right">
                              <button className="p-1 rounded-full hover:bg-muted">
                                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Cards for mobile */}
                  <div className="md:hidden space-y-3">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="bg-background border border-border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">#{order.id}</p>
                            <p className="text-sm text-muted-foreground">{order.customer_name || order.customer}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(Number(order.total_amount || 0))}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.created_at ? new Date(order.created_at).toLocaleDateString() : order.date}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-between items-center">
                          {getStatusBadge((order.status || "").toString().toLowerCase())}
                          <button className="p-1 -mr-2">
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Frozen Accounts */}
          <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
            <div className="p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold mb-4">Frozen Accounts Requiring Action</h2>
              <div className="space-y-3">
                {frozenAccounts.slice(0, 3).map((acc) => (
                  <div
                    key={acc.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 md:p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="mb-2 sm:mb-0">
                      <p className="font-medium">{acc.full_name}</p>
                      <p className="text-sm text-muted-foreground">Frozen account ({acc.role})</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button className="btn-outline w-full sm:w-auto text-sm py-1.5 px-3">View Details</button>
                      <button className="btn-primary w-full sm:w-auto text-sm py-1.5 px-3">Review</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
