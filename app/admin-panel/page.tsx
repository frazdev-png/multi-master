"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"
import { Users, Store, ShoppingCart, DollarSign, AlertCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { useRealtime } from "@/contexts/RealtimeContext"

export default function AdminPanelDashboard() {
  const { settings } = useRealtime()
  const [stats, setStats] = useState<any>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setIsLoading(true)
        setError("")

        const [statsRes, ordersRes] = await Promise.all([
          fetch("/api/backend/admin/dashboard/stats"),
          fetch("/api/backend/admin/orders/recent?limit=200"),
        ])

        const statsJson = await statsRes.json().catch(() => null)
        const ordersJson = await ordersRes.json().catch(() => null)

        if (!statsRes.ok) throw new Error(statsJson?.error || "Failed to load dashboard stats")
        if (!ordersRes.ok) throw new Error(ordersJson?.error || "Failed to load recent orders")

        if (!cancelled) {
          setStats(statsJson?.stats || null)
          setRecentOrders(ordersJson?.orders || [])
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load dashboard")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const statCards = useMemo(() => {
    const totalUsers = Number(stats?.total_users || 0)
    const newUsers = Number(stats?.new_users || 0)
    const totalOrders = Number(stats?.total_orders || 0)
    const newOrders = Number(stats?.new_orders || 0)
    const activeSellers = Number(stats?.active_sellers || 0)
    const newSellers = Number(stats?.new_sellers || 0)
    const frozenAccounts = Number(stats?.frozen_accounts || 0)
    const totalRevenue = Number(stats?.total_revenue || 0)

    return [
      {
        icon: Users,
        label: "Total Users",
        value: totalUsers.toLocaleString(),
        change: `+${newUsers.toLocaleString()}`,
        positive: newUsers >= 0,
        color: "from-green-500 to-green-600",
      },
      {
        icon: ShoppingCart,
        label: "Total Orders",
        value: totalOrders.toLocaleString(),
        change: `+${newOrders.toLocaleString()}`,
        positive: newOrders >= 0,
        color: "from-blue-500 to-blue-600",
      },
      {
        icon: Store,
        label: "Active Sellers",
        value: activeSellers.toLocaleString(),
        change: `+${newSellers.toLocaleString()}`,
        positive: newSellers >= 0,
        color: "from-purple-500 to-purple-600",
      },
      {
        icon: AlertCircle,
        label: "Frozen Accounts",
        value: frozenAccounts.toLocaleString(),
        change: "",
        positive: false,
        color: "from-orange-500 to-orange-600",
      },
      {
        icon: DollarSign,
        label: "Total Revenue",
        value: formatCurrency(totalRevenue),
        change: "",
        positive: true,
        color: "from-emerald-500 to-emerald-600",
      },
    ]
  }, [stats])

  const chartData = useMemo(() => {
    const today = new Date()
    const days: { date: string; orders: number; revenue: number; key: string }[] = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString(undefined, { weekday: "short" })
      days.push({ date: label, orders: 0, revenue: 0, key })
    }

    const map = new Map(days.map((d) => [d.key, d]))
    for (const o of recentOrders) {
      if (!o?.created_at) continue
      const key = new Date(o.created_at).toISOString().slice(0, 10)
      const bucket = map.get(key)
      if (!bucket) continue
      bucket.orders += 1
      bucket.revenue += Number(o.total_amount || 0)
    }

    return days.map(({ date, orders, revenue }) => ({ date, orders, revenue }))
  }, [recentOrders])

  const recentOrdersRows = useMemo(() => {
    return recentOrders.slice(0, 10).map((o) => ({
      id: `#${o.id}`,
      customer: o.customer_name || "",
      amount: formatCurrency(Number(o.total_amount || 0)),
      status: (o.status || "").toString(),
      date: o.created_at ? new Date(o.created_at).toLocaleDateString() : "",
    }))
  }, [recentOrders])

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">Welcome to the {settings.website_name || "Sell1Mall"} Admin Panel</p>
      </div>

      {isLoading && <div className="text-muted-foreground">Loading dashboard...</div>}
      {!isLoading && error && <div className="text-red-600">{error}</div>}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="admin-panel-stat-card">
              <div className={`admin-panel-stat-card-icon bg-gradient-to-br ${stat.color}`}>
                <Icon size={24} className="text-white" />
              </div>
              <div className="admin-panel-stat-card-label">{stat.label}</div>
              <div className="admin-panel-stat-card-value">{stat.value}</div>
              <div className={`admin-panel-stat-card-change ${stat.positive ? "positive" : "negative"}`}>
                <span>{stat.change}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <div className="admin-panel-table">
          <div className="p-4 md:p-6 border-b border-border">
            <h2 className="text-base md:text-lg font-bold">Orders Overview</h2>
          </div>
          <div className="p-4 md:p-6">
            <ResponsiveContainer width="100%" height={250} minHeight={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="orders" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-panel-table">
          <div className="p-4 md:p-6 border-b border-border">
            <h2 className="text-base md:text-lg font-bold">Revenue Trend</h2>
          </div>
          <div className="p-4 md:p-6">
            <ResponsiveContainer width="100%" height={250} minHeight={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={{ fill: "#2563eb" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="admin-panel-table">
        <div className="p-4 md:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-base md:text-lg font-bold">Recent Orders</h2>
          <a href="/admin-panel/orders" className="text-primary text-sm font-semibold hover:underline">
            View All →
          </a>
        </div>
        
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="admin-panel-table-header-cell">Order ID</th>
                <th className="admin-panel-table-header-cell">Customer</th>
                <th className="admin-panel-table-header-cell">Amount</th>
                <th className="admin-panel-table-header-cell">Status</th>
                <th className="admin-panel-table-header-cell">Date</th>
                <th className="admin-panel-table-header-cell">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentOrdersRows.map((order) => (
                <tr key={order.id} className="admin-panel-table-row">
                  <td className="admin-panel-table-cell font-semibold">{order.id}</td>
                  <td className="admin-panel-table-cell">{order.customer}</td>
                  <td className="admin-panel-table-cell text-primary font-semibold">{order.amount}</td>
                  <td className="admin-panel-table-cell">
                    <span
                      className={`admin-panel-badge ${
                        order.status === "Delivered"
                          ? "admin-panel-badge-success"
                          : order.status === "Processing"
                            ? "admin-panel-badge-warning"
                            : "admin-panel-badge-info"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="admin-panel-table-cell">{order.date}</td>
                  <td className="admin-panel-table-cell">
                    <a
                      href={`/admin-panel/orders/${order.id}`}
                      className="text-primary hover:underline text-sm font-semibold"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3 p-4">
          {recentOrdersRows.map((order) => (
            <div key={order.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-sm">{order.id}</span>
                <span
                  className={`admin-panel-badge ${
                    order.status === "Delivered"
                      ? "admin-panel-badge-success"
                      : order.status === "Processing"
                        ? "admin-panel-badge-warning"
                        : "admin-panel-badge-info"
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span>{order.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="text-primary font-semibold">{order.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{order.date}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <a
                  href={`/admin-panel/orders/${order.id}`}
                  className="text-primary hover:underline text-sm font-semibold"
                >
                  View Details →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
