"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { SellerSidebar } from "@/components/seller/sidebar"
import { SellerHeader } from "@/components/seller/header"
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package, Eye, Calendar, Download, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"

interface AnalyticsData {
  revenue: number
  orders: number
  customers: number
  products: number
  views: number
  conversionRate: number
  avgOrderValue: number
  growth: {
    revenue: number
    orders: number
    customers: number
    views: number
  }
}

interface TopProduct {
  id: number
  name: string
  sales: number
  revenue: number
  views: number
  conversionRate: number
}

type SellerOrder = {
  id: number
  status?: string
  total_amount?: number | string
  created_at?: string
  customer_name?: string
  items?: Array<{
    id?: number
    product_id?: number
    product_name?: string
    quantity?: number | string
    price?: number | string
  }>
}

type SellerProduct = {
  id: number
  name?: string
}

function rangeDaysFromKey(key: string) {
  if (key === "24hours") return 1
  if (key === "7days") return 7
  if (key === "30days") return 30
  if (key === "90days") return 90
  if (key === "1year") return 365
  return 7
}

function percentGrowth(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0
  }
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function timeAgo(dateIso?: string) {
  if (!dateIso) return ""
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return ""
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return `${days} days ago`
}

export default function SellerAnalyticsPage() {
  const [timeRange, setTimeRange] = useState("7days")
  const [selectedMetric, setSelectedMetric] = useState("revenue")

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((v) => !v)
  }

  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [products, setProducts] = useState<SellerProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setIsLoading(true)
        setError("")
        const [ordersRes, productsRes] = await Promise.all([
          fetch("/api/backend/seller/orders?limit=200"),
          fetch("/api/backend/seller/products?limit=200"),
        ])

        const ordersJson = await ordersRes.json().catch(() => null)
        const productsJson = await productsRes.json().catch(() => null)

        if (!ordersRes.ok) throw new Error(ordersJson?.error || "Failed to load analytics")
        if (!productsRes.ok) throw new Error(productsJson?.error || "Failed to load products")

        if (cancelled) return
        setOrders(Array.isArray(ordersJson?.orders) ? ordersJson.orders : [])
        setProducts(Array.isArray(productsJson?.products) ? productsJson.products : [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load analytics")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const analytics: AnalyticsData = useMemo(() => {
    const days = rangeDaysFromKey(timeRange)
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - days)

    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - days)
    const prevEnd = new Date(start)

    const within = (o: SellerOrder, a: Date, b: Date) => {
      if (!o.created_at) return false
      const d = new Date(o.created_at)
      if (Number.isNaN(d.getTime())) return false
      return d >= a && d < b
    }

    const curOrders = orders.filter((o) => within(o, start, now))
    const prevOrders = orders.filter((o) => within(o, prevStart, prevEnd))

    const sumRevenue = (list: SellerOrder[]) =>
      list.reduce((sum, o) => sum + (String(o.status || "").toLowerCase() === "cancelled" ? 0 : Number(o.total_amount || 0) || 0), 0)

    const countCustomers = (list: SellerOrder[]) => {
      const s = new Set<string>()
      for (const o of list) {
        if (o.customer_name) s.add(String(o.customer_name))
      }
      return s.size
    }

    const revenueCur = sumRevenue(curOrders)
    const revenuePrev = sumRevenue(prevOrders)
    const ordersCur = curOrders.length
    const ordersPrev = prevOrders.length
    const customersCur = countCustomers(curOrders)
    const customersPrev = countCustomers(prevOrders)

    const avgOrderValue = ordersCur > 0 ? revenueCur / ordersCur : 0
    const conversionRate = 0

    return {
      revenue: revenueCur,
      orders: ordersCur,
      customers: customersCur,
      products: products.length,
      views: 0,
      conversionRate,
      avgOrderValue,
      growth: {
        revenue: percentGrowth(revenueCur, revenuePrev),
        orders: percentGrowth(ordersCur, ordersPrev),
        customers: percentGrowth(customersCur, customersPrev),
        views: 0,
      },
    }
  }, [orders, products.length, timeRange])

  const topProducts: TopProduct[] = useMemo(() => {
    const mapName = new Map<number, string>()
    for (const p of products) {
      if (p?.id) mapName.set(Number(p.id), p.name || `Product #${p.id}`)
    }

    const agg = new Map<number, { sales: number; revenue: number }>()
    for (const o of orders) {
      if (String(o.status || "").toLowerCase() === "cancelled") continue
      for (const it of o.items || []) {
        const pid = Number(it.product_id || 0)
        if (!pid) continue
        const qty = Number(it.quantity || 0) || 0
        const price = Number(it.price || 0) || 0
        const entry = agg.get(pid) || { sales: 0, revenue: 0 }
        entry.sales += qty
        entry.revenue += qty * price
        agg.set(pid, entry)
        if (!mapName.has(pid) && it.product_name) mapName.set(pid, it.product_name)
      }
    }

    const list: TopProduct[] = Array.from(agg.entries())
      .map(([id, v]) => ({
        id,
        name: mapName.get(id) || `Product #${id}`,
        sales: v.sales,
        revenue: v.revenue,
        views: 0,
        conversionRate: 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    return list
  }, [orders, products])

  const recentOrders = useMemo(() => {
    const mapStatus = (s: string) => {
      const v = (s || "").toLowerCase()
      if (v === "delivered") return "Completed"
      if (v === "processing") return "Processing"
      if (v === "pending") return "Pending"
      if (v === "shipped") return "Processing"
      return "Cancelled"
    }

    return [...orders]
      .sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0
        const db = b.created_at ? new Date(b.created_at).getTime() : 0
        return db - da
      })
      .slice(0, 4)
      .map((o) => ({
        id: `#${o.id}`,
        customer: o.customer_name || "",
        amount: Number(o.total_amount || 0) || 0,
        status: mapStatus(String(o.status || "")),
        time: timeAgo(o.created_at),
      }))
  }, [orders])

  const getGrowthIcon = (growth: number) => {
    return growth >= 0 ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    )
  }

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? "text-green-600" : "text-red-600"
  }

  const MetricCard = ({ title, value, growth, icon, prefix = "", suffix = "" }: {
    title: string
    value: string | number
    growth: number
    icon: ReactNode
    prefix?: string
    suffix?: string
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-2">
              {prefix}{value}{suffix}
            </p>
            <div className="flex items-center gap-1 mt-2">
              {getGrowthIcon(growth)}
              <span className={`text-sm font-medium ${getGrowthColor(growth)}`}>
                {growth >= 0 ? "+" : ""}{growth}%
              </span>
              <span className="text-sm text-muted-foreground">vs last period</span>
            </div>
          </div>
          <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="flex bg-background">
      <SellerSidebar isMobileMenuOpen={isMobileMenuOpen} onMobileMenuClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col">
        <SellerHeader onMobileMenuToggle={toggleMobileMenu} isMobileMenuOpen={isMobileMenuOpen} />

        <main className="flex-1 p-8">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Analytics</h1>
              <p className="text-muted-foreground">Track your store performance and sales insights</p>
            </div>
            <div className="flex gap-4 items-center">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24hours">Last 24 hours</SelectItem>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="90days">Last 90 days</SelectItem>
                  <SelectItem value="1year">Last year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {isLoading ? <div className="text-muted-foreground mb-6">Loading...</div> : null}
          {error ? <div className="text-red-600 mb-6">{error}</div> : null}

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(analytics.revenue)}
              growth={analytics.growth.revenue}
              icon={<DollarSign className="h-6 w-6" />}
            />
            <MetricCard
              title="Total Orders"
              value={analytics.orders}
              growth={analytics.growth.orders}
              icon={<ShoppingCart className="h-6 w-6" />}
            />
            <MetricCard
              title="Total Customers"
              value={analytics.customers}
              growth={analytics.growth.customers}
              icon={<Users className="h-6 w-6" />}
            />
            <MetricCard
              title="Product Views"
              value={analytics.views.toLocaleString()}
              growth={analytics.growth.views}
              icon={<Eye className="h-6 w-6" />}
            />
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <MetricCard
              title="Conversion Rate"
              value={analytics.conversionRate}
              growth={2.1}
              icon={<TrendingUp className="h-6 w-6" />}
              suffix="%"
            />
            <MetricCard
              title="Avg Order Value"
              value={formatCurrency(analytics.avgOrderValue)}
              growth={-1.2}
              icon={<Package className="h-6 w-6" />}
            />
            <MetricCard
              title="Active Products"
              value={analytics.products}
              growth={5.0}
              icon={<Package className="h-6 w-6" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Performing Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.sales} sales • {product.views.toLocaleString()} views
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(product.revenue)}</p>
                        <p className="text-sm text-muted-foreground">{product.conversionRate}% conv.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{order.id}</p>
                          <p className="text-sm text-muted-foreground">{order.customer}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(Number(order.amount || 0))}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={order.status === "Completed" ? "default" : "secondary"} className="text-xs">
                            {order.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{order.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart Placeholder */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Revenue Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Revenue chart will be displayed here</p>
                  <p className="text-sm text-muted-foreground mt-2">Integration with charting library needed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
