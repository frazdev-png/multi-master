"use client"

import { Search, Eye, Edit2, Trash2, RefreshCw, Download } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"

interface AdminOrder {
  orderId: number
  id: string
  customer: string
  vendor: string
  amount: string
  status: string
  paymentStatus: string
  paymentMethod: string
  items: number
  date: string
  email: string
  phone: string
  address: string
}

export default function OrdersManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [editingOrder, setEditingOrder] = useState<AdminOrder | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const loadOrders = async () => {
    try {
      setIsLoading(true)
      setError("")

      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter.toLowerCase())
      if (searchTerm.trim()) params.set("search", searchTerm.trim())

      const url = params.size ? `/api/backend/admin/orders?${params.toString()}` : "/api/backend/admin/orders"
      const res = await fetch(url)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load orders")
      }

      const mapStatus = (s: string) => {
        const v = (s || "").toLowerCase()
        if (v === "pending") return "Pending"
        if (v === "processing") return "Processing"
        if (v === "shipped") return "Shipped"
        if (v === "delivered") return "Delivered"
        return "Cancelled"
      }

      const mapPaymentStatus = (s: string) => {
        const v = (s || "").toLowerCase()
        if (v === "paid") return "Paid"
        if (v === "failed") return "Failed"
        if (v === "refunded") return "Refunded"
        if (v === "cancelled") return "Cancelled"
        return "Pending"
      }

      const mapped: AdminOrder[] = (data?.orders || []).map((o: any) => ({
        orderId: Number(o.id),
        id: `#ORD-${String(o.id).padStart(3, "0")}`,
        customer: o.customer_name || "",
        vendor: o.store_name || o.seller_name || "",
        amount: formatCurrency(Number(o.total_amount ?? 0)),
        status: mapStatus(o.status),
        paymentStatus: mapPaymentStatus(o.payment_status),
        paymentMethod: o.payment_method || "",
        items: Number(o.item_count ?? 0),
        date: o.created_at ? new Date(o.created_at).toLocaleDateString() : "",
        email: o.customer_email || "",
        phone: o.customer_phone || "",
        address: o.shipping_address || "",
      }))

      setOrders(mapped)
    } catch (e: any) {
      setError(e?.message || "Failed to load orders")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [statusFilter])

  useEffect(() => {
    const t = setTimeout(() => {
      loadOrders()
    }, 350)
    return () => clearTimeout(t)
  }, [searchTerm])

  const filteredOrders = orders.filter((o) => {
    if (paymentFilter !== "all" && o.paymentStatus.toLowerCase() !== paymentFilter) return false
    return true
  })

  const handleView = (order: AdminOrder) => {
    setSelectedOrder(order)
    setIsViewDialogOpen(true)
  }

  const handleEdit = (order: AdminOrder) => {
    setEditingOrder({...order})
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (orderId: number) => {
    if (!confirm("Cancel this order?")) return
    await handleStatusChange(orderId, "Cancelled")
  }

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus.toLowerCase() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update status")
      }
      await loadOrders()
    } catch (e: any) {
      setError(e?.message || "Failed to update status")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaymentStatusChange = async (orderId: number, newPaymentStatus: string) => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_status: newPaymentStatus.toLowerCase() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update payment status")
      }
      await loadOrders()
    } catch (e: any) {
      setError(e?.message || "Failed to update payment status")
    } finally {
      setIsLoading(false)
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'refunded': return 'bg-purple-100 text-purple-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleSaveEdit = async () => {
    if (!editingOrder) return
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/orders/${editingOrder.orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_status: editingOrder.paymentStatus.toLowerCase(),
          payment_method: editingOrder.paymentMethod || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save changes")
      setIsEditDialogOpen(false)
      setEditingOrder(null)
      await loadOrders()
    } catch (e: any) {
      setError(e?.message || "Failed to save changes")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    loadOrders()
  }

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Order ID,Customer,Vendor,Amount,Status,Payment Status,Items,Date\n" +
      orders.map(order => 
        `${order.id},${order.customer},${order.vendor},${order.amount},${order.status},${order.paymentStatus},${order.items},${order.date}`
      ).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "orders.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'shipped': return 'bg-purple-100 text-purple-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders Management</h1>
          <p className="text-muted-foreground mt-1">Manage and track all orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">Search Orders</label>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by order ID or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Filter by Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Payment Status</label>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Payment Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
          <Button onClick={() => {setSearchTerm(""); setStatusFilter("all"); setPaymentFilter("all")}}>
            Clear Filters
          </Button>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Order ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Vendor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Items</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Payment</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3 font-semibold text-primary">{order.id}</td>
                    <td className="px-4 py-3">{order.customer}</td>
                    <td className="px-4 py-3">{order.vendor}</td>
                    <td className="px-4 py-3 font-semibold">{order.amount}</td>
                    <td className="px-4 py-3">{order.items}</td>
                    <td className="px-4 py-3">
                      <Select value={order.status} onValueChange={(v) => handleStatusChange(order.orderId, v)}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Processing">Processing</SelectItem>
                          <SelectItem value="Shipped">Shipped</SelectItem>
                          <SelectItem value="Delivered">Delivered</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="mt-2">
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={order.paymentStatus} onValueChange={(v) => handlePaymentStatusChange(order.orderId, v)}>
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Paid">Paid</SelectItem>
                          <SelectItem value="Failed">Failed</SelectItem>
                          <SelectItem value="Refunded">Refunded</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="mt-2">
                        <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                          {order.paymentStatus}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{order.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleView(order)}>
                          <Eye size={16} className="text-primary" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(order)}>
                          <Edit2 size={16} className="text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(order.orderId)}>
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && filteredOrders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No orders found</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>View complete order information</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Order ID</label>
                  <p className="font-semibold">{selectedOrder.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className={getStatusColor(selectedOrder.status)}>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Customer</label>
                  <p className="font-semibold">{selectedOrder.customer}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Vendor</label>
                  <p className="font-semibold">{selectedOrder.vendor}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <p className="font-semibold text-lg">{selectedOrder.amount}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Items</label>
                  <p>{selectedOrder.items} items</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payment Status</label>
                  <Badge className={getPaymentStatusColor(selectedOrder.paymentStatus)}>
                    {selectedOrder.paymentStatus}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
                  <p>{selectedOrder.paymentMethod || "—"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date</label>
                  <p>{selectedOrder.date}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p>{selectedOrder.email}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p>{selectedOrder.phone}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p>{selectedOrder.address}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription>Update order information</DialogDescription>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Customer</label>
                  <Input
                    value={editingOrder.customer}
                    onChange={(e) => setEditingOrder({...editingOrder, customer: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Vendor</label>
                  <Input
                    value={editingOrder.vendor}
                    onChange={(e) => setEditingOrder({...editingOrder, vendor: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <Input
                    value={editingOrder.amount}
                    onChange={(e) => setEditingOrder({...editingOrder, amount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Items</label>
                  <Input
                    type="number"
                    value={editingOrder.items}
                    onChange={(e) => setEditingOrder({...editingOrder, items: e.target.value === "" ? "" : parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <Input
                    value={editingOrder.email}
                    onChange={(e) => setEditingOrder({...editingOrder, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <Input
                    value={editingOrder.phone}
                    onChange={(e) => setEditingOrder({...editingOrder, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payment Status</label>
                  <Select value={editingOrder.paymentStatus} onValueChange={(v) => setEditingOrder({...editingOrder, paymentStatus: v})}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                      <SelectItem value="Refunded">Refunded</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
                  <Input
                    value={editingOrder.paymentMethod}
                    onChange={(e) => setEditingOrder({...editingOrder, paymentMethod: e.target.value})}
                    placeholder="e.g. Credit Card, Bank Transfer"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <Input
                    value={editingOrder.address}
                    onChange={(e) => setEditingOrder({...editingOrder, address: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
