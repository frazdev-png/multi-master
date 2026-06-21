"use client"

import { CustomerNavbar } from "@/components/customer/navbar"
import { ShoppingCart, Heart, Package, Wallet } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/utils"

export default function CustomerDashboard() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [me, setMe] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setIsLoading(true)
        setError("")

        const [meRes, statsRes, ordersRes] = await Promise.all([
          fetch("/api/backend/auth/me"),
          fetch("/api/backend/orders/stats"),
          fetch("/api/backend/orders?limit=5"),
        ])

        const meData = await meRes.json().catch(() => null)
        const statsData = await statsRes.json().catch(() => null)
        const ordersData = await ordersRes.json().catch(() => null)

        if (!meRes.ok) {
          throw new Error(meData?.error || "Failed to load user")
        }

        if (!statsRes.ok) {
          throw new Error(statsData?.error || "Failed to load stats")
        }

        if (!ordersRes.ok) {
          throw new Error(ordersData?.error || "Failed to load orders")
        }

        if (cancelled) return
        setMe(meData?.user || null)
        setStats(statsData?.stats || null)
        setOrders(Array.isArray(ordersData?.orders) ? ordersData.orders : [])
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message || "Failed to load dashboard")
      } finally {
        if (cancelled) return
        setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const statCards = [
    { label: "Total Orders", value: stats?.total_orders ?? "—", icon: <Package size={24} /> },
    { label: "Wishlist Items", value: stats?.wishlist_items ?? "—", icon: <Heart size={24} /> },
    { label: "Cart Items", value: stats?.cart_items ?? "—", icon: <ShoppingCart size={24} /> },
    { label: "Wallet Balance", value: stats ? formatCurrency(Number(stats.wallet_balance || 0)) : "—", icon: <Wallet size={24} /> },
  ]

  return (
    <>
      <CustomerNavbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Customer Dashboard</h1>
          <p className="text-base sm:text-lg text-muted-foreground mb-2">Welcome back{me?.full_name ? `, ${me.full_name}` : ""}!</p>
          <p className="text-sm text-muted-foreground">Manage your account and view your purchases</p>
        </div>

        {error ? (
          <div className="card mb-6">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : null}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {statCards.map((stat) => (
            <div key={stat.label} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-2">{isLoading ? "…" : stat.value}</p>
                </div>
                <div className="text-primary">{stat.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Orders */}
        <div className="card mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Recent Orders</h2>
            <a href="/customer/orders" className="text-primary hover:underline font-medium">
              View All
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground">Order ID</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Seller</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Amount</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="py-3 px-4 text-muted-foreground" colSpan={6}>
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td className="py-3 px-4 text-muted-foreground" colSpan={6}>
                      No orders yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="py-3 px-4 font-medium text-primary">#{o.id}</td>
                      <td className="py-3 px-4">{o.created_at ? new Date(o.created_at).toLocaleDateString() : ""}</td>
                      <td className="py-3 px-4">{o.store_name || o.seller_name || ""}</td>
                      <td className="py-3 px-4 font-semibold">{formatCurrency(Number(o.total_amount || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                          {(o.status || "").toString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <a href="/customer/orders" className="text-primary hover:underline font-medium">
                          View
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: "Orders", desc: "Track & manage your orders", href: "/customer/orders" },
            { title: "Wishlist", desc: "Your favorite items", href: "/customer/wishlist" },
            { title: "Cart", desc: "View your shopping cart", href: "/customer/cart" },
            { title: "Shop", desc: "Browse all products", href: "/shop" },
          ].map((link) => (
            <button key={link.title} onClick={() => router.push(link.href)} className="card hover:shadow-lg hover:border-primary transition-all group cursor-pointer">
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{link.title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{link.desc}</p>
            </button>
          ))}
        </div>
      </main>
    </>
  )
}
