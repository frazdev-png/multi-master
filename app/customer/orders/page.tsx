"use client"

import { CustomerNavbar } from "@/components/customer/navbar"
import { Truck, Package, CheckCircle, Clock } from "lucide-react"
import { useEffect, useState } from "react"
import { formatCurrency } from "@/lib/utils"

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<
    {
      id: string
      date: string
      seller: string
      amount: number
      status: string
      items: number
    }[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    const mapStatus = (status: string) => {
      const s = (status || "").toLowerCase()
      if (s === "delivered") return "Delivered"
      if (s === "shipped" || s === "in_transit" || s === "in transit") return "In Transit"
      if (s === "pending" || s === "processing") return "Processing"
      return status || "Processing"
    }

    const load = async () => {
      try {
        setIsLoading(true)
        setError("")

        const res = await fetch("/api/backend/orders")
        const data = await res.json().catch(() => null)

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load orders")
        }

        const mapped = (data?.orders || []).map((o: any) => ({
          id: `#${o.id}`,
          date: o.created_at ? new Date(o.created_at).toLocaleDateString() : "",
          seller: o.store_name || o.seller_name || "",
          amount: Number(o.total_amount || 0),
          status: mapStatus(o.status),
          items: Number(o.item_count || 0),
        }))

        if (!cancelled) {
          setOrders(mapped)
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load orders")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Delivered":
        return <CheckCircle size={16} />
      case "In Transit":
        return <Truck size={16} />
      case "Processing":
        return <Clock size={16} />
      default:
        return <Package size={16} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered":
        return "bg-success/10 text-success"
      case "In Transit":
        return "bg-primary/10 text-primary"
      case "Processing":
        return "bg-warning/10 text-warning"
      default:
        return "bg-muted text-foreground"
    }
  }

  return (
    <>
      <CustomerNavbar />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Orders</h1>
          <p className="text-muted-foreground">Track and manage all your orders</p>
        </div>

        {isLoading && <div className="text-muted-foreground">Loading orders...</div>}
        {!isLoading && error && <div className="text-red-600">{error}</div>}

        {!isLoading && !error && (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="card hover:shadow-lg transition-shadow">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Order ID</p>
                    <p className="font-bold text-primary text-lg">{order.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{order.date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">From</p>
                    <p className="font-medium">{order.seller}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-bold text-foreground">{formatCurrency(order.amount)}</p>
                  </div>
                  <div className="flex items-end justify-between md:flex-col md:items-end">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                    >
                      {getStatusIcon(order.status)} {order.status}
                    </span>
                    <button className="mt-2 md:mt-4 text-primary hover:underline font-medium text-sm">Details</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
