"use client"

import { useEffect, useMemo, useState } from "react"
import { SellerSidebar } from "@/components/seller/sidebar"
import { SellerHeader } from "@/components/seller/header"
import { StatCard } from "@/components/admin/stat-card"
import { Package, ShoppingCart, Wallet, Star } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default function SellerDashboard() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setIsLoading(true)
        setError("")

        const [ordersRes, productsRes] = await Promise.all([
          fetch("/api/backend/seller/orders?limit=20"),
          fetch("/api/backend/seller/products?limit=200"),
        ])

        const ordersData = await ordersRes.json().catch(() => null)
        const productsData = await productsRes.json().catch(() => null)

        if (!ordersRes.ok) {
          throw new Error(ordersData?.error || "Failed to load seller orders")
        }

        if (!productsRes.ok) {
          throw new Error(productsData?.error || "Failed to load seller products")
        }

        if (cancelled) return
        setOrders(Array.isArray(ordersData?.orders) ? ordersData.orders : [])
        setProducts(Array.isArray(productsData?.products) ? productsData.products : [])
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

  const stats = useMemo(() => {
    const totalProducts = products.length
    const activeListings = products.filter((p) => (p?.status || "").toLowerCase() === "active").length

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const monthOrders = orders.filter((o) => {
      const createdAt = o?.created_at ? new Date(o.created_at) : null
      return createdAt && createdAt >= monthStart
    })

    const monthSales = monthOrders.reduce((sum, o) => sum + Number(o?.total_amount || 0), 0)

    return [
      {
        title: "Total Products",
        value: totalProducts,
        subtitle: `${activeListings} active listings`,
        icon: <Package size={28} />,
      },
      {
        title: "This Month Sales",
        value: formatCurrency(monthSales),
        subtitle: `${monthOrders.length} orders`,
        icon: <ShoppingCart size={28} />,
      },
      {
        title: "Wallet Balance",
        value: "—",
        subtitle: "Not available",
        icon: <Wallet size={28} />,
      },
      {
        title: "Store Rating",
        value: "—",
        subtitle: "Not available",
        icon: <Star size={28} />,
      },
    ]
  }, [orders, products])

  const recentOrders = useMemo(() => {
    return [...orders].slice(0, 4)
  }, [orders])

  const topProducts = useMemo(() => {
    return [...products].slice(0, 5)
  }, [products])

  return (
    <div className="flex bg-background min-h-screen">
      <SellerSidebar 
        isMobileMenuOpen={isMobileMenuOpen} 
        onMobileMenuClose={closeMobileMenu} 
      />

      <div className="flex-1 flex flex-col min-w-0">
        <SellerHeader 
          onMobileMenuToggle={toggleMobileMenu} 
          isMobileMenuOpen={isMobileMenuOpen} 
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-auto">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Monitor your store performance and sales</p>
          </div>

          {error ? (
            <div className="card mb-6 sm:mb-8">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : null}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {stats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </div>

          {/* Recent Orders */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="xl:col-span-2 card">
              <h2 className="text-lg sm:text-xl font-bold mb-4">Recent Orders</h2>
              <div className="space-y-3">
                {isLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading orders...</div>
                ) : recentOrders.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No orders yet.</div>
                ) : (
                  recentOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">#{o.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {o.customer_name || "Customer"} • {Number(o.item_count || 0)} items
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(Number(o.total_amount || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <span className="text-xs inline-block mt-1 px-2 py-1 rounded bg-warning/10 text-warning">
                          {(o.status || "pending").toString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button className="w-full btn-primary">Add New Product</button>
                <button className="w-full btn-secondary">View All Orders</button>
                <button className="w-full btn-secondary">Withdraw Funds</button>
                <button className="w-full btn-secondary">View Analytics</button>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Top Performing Products</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground">Product</th>
                    <th className="text-left py-3 px-4 text-muted-foreground">Price</th>
                    <th className="text-left py-3 px-4 text-muted-foreground">Stock</th>
                    <th className="text-left py-3 px-4 text-muted-foreground">Category</th>
                    <th className="text-left py-3 px-4 text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="py-3 px-4 text-muted-foreground" colSpan={5}>
                        Loading products...
                      </td>
                    </tr>
                  ) : topProducts.length === 0 ? (
                    <tr>
                      <td className="py-3 px-4 text-muted-foreground" colSpan={5}>
                        No products yet.
                      </td>
                    </tr>
                  ) : (
                    topProducts.map((p) => (
                      <tr key={p.id} className="border-b border-border hover:bg-muted transition-colors">
                        <td className="py-3 px-4 font-medium">{p.name || ""}</td>
                        <td className="py-3 px-4">{formatCurrency(Number(p.price || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4">{Number(p.stock || 0)} units</td>
                        <td className="py-3 px-4 text-muted-foreground">{p.category || ""}</td>
                        <td className="py-3 px-4 font-medium">{p.status || ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
