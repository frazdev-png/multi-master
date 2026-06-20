"use client"

import { useEffect, useMemo, useState } from "react"
import { SellerSidebar } from "@/components/seller/sidebar"
import { SellerHeader } from "@/components/seller/header"
import { Package, Truck, CheckCircle, Eye, Edit, Trash2, MoreVertical, Search, Filter, Download, RefreshCw, X, Check, Clock, AlertCircle, Printer, Mail, Phone, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatCurrency } from "@/lib/utils"

interface Order {
  id: string
  customer: {
    name: string
    email: string
    phone: string
    address: string
  }
  items: {
    id: number
    name: string
    quantity: number
    price: number
    image: string
  }[]
  amount: number
  status: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled"
  date: string
  paymentMethod: string
  paymentStatus: "Paid" | "Pending" | "Failed"
  trackingNumber?: string
  notes?: string
}

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(false)

  const loadOrders = async () => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/seller/orders")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load orders")
      }

      const mapStatus = (s: string): Order["status"] => {
        const v = (s || "").toLowerCase()
        if (v === "pending") return "Pending"
        if (v === "processing") return "Processing"
        if (v === "shipped") return "Shipped"
        if (v === "delivered") return "Delivered"
        return "Cancelled"
      }

      const mapped: Order[] = (data?.orders || []).map((o: any) => ({
        id: `#${o.id}`,
        customer: {
          name: o.customer_name || "",
          email: o.customer_email || "",
          phone: o.customer_phone || "",
          address: o.shipping_address || "",
        },
        items: (o.items || []).map((it: any) => ({
          id: Number(it.id),
          name: it.product_name || "",
          quantity: Number(it.quantity || 0),
          price: Number(it.price || 0),
          image: it.image_url || "/placeholder.svg",
        })),
        amount: Number(o.total_amount || 0),
        status: mapStatus(o.status),
        date: o.created_at ? new Date(o.created_at).toLocaleDateString() : "",
        paymentMethod: o.payment_method || "",
        paymentStatus: (o.payment_status || "pending").toString().toLowerCase() === "paid" ? "Paid" : "Pending",
        trackingNumber: o.tracking_number || undefined,
        notes: o.notes || undefined,
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
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pending":
        return <Clock size={16} />
      case "Processing":
        return <Package size={16} />
      case "Shipped":
        return <Truck size={16} />
      case "Delivered":
        return <Check size={16} />
      case "Cancelled":
        return <AlertCircle size={16} />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "Processing":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "Shipped":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "Delivered":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "Cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "Pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "Failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      setIsLoading(true)
      setError("")
      const numericId = orderId.startsWith("#") ? orderId.slice(1) : orderId
      const res = await fetch(`/api/backend/seller/orders/${numericId}/status`, {
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

  const deleteOrder = (orderId: string) => {
    if (confirm(`Are you sure you want to cancel order ${orderId}?`)) {
      updateOrderStatus(orderId, "Cancelled")
    }
  }

  const exportOrders = () => {
    const csvContent = [
      ["Order ID", "Customer", "Amount", "Status", "Date", "Payment Method"],
      ...filteredOrders.map(order => [
        order.id,
        order.customer.name,
        order.amount.toString(),
        order.status,
        order.date,
        order.paymentMethod
      ])
    ].map(row => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "orders.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const refreshOrders = () => {
    loadOrders()
  }

  const printOrder = (order: Order) => {
    const printContent = `
      Order Details: ${order.id}
      Customer: ${order.customer.name}
      Email: ${order.customer.email}
      Phone: ${order.customer.phone}
      Address: ${order.customer.address}
      Amount: ${formatCurrency(order.amount)}
      Status: ${order.status}
      Payment Method: ${order.paymentMethod}
      Payment Status: ${order.paymentStatus}
      Date: ${order.date}
      Items:
      ${order.items.map(item => `- ${item.name} x${item.quantity} - ${formatCurrency(item.price)}`).join('\n')}
    `
    window.print()
  }

  const sendEmail = (order: Order) => {
    alert(`Sending email to ${order.customer.email} regarding order ${order.id}`)
  }

  const callCustomer = (order: Order) => {
    alert(`Calling ${order.customer.phone} for order ${order.id}`)
  }

  return (
    <div className="flex bg-background">
      <SellerSidebar isMobileMenuOpen={isMobileMenuOpen} onMobileMenuClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col">
        <SellerHeader onMobileMenuToggle={() => setIsMobileMenuOpen((v) => !v)} isMobileMenuOpen={isMobileMenuOpen} />

        <main className="flex-1 p-8">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Orders</h1>
              <p className="text-muted-foreground">Manage and fulfill customer orders</p>
            </div>

          {error && <div className="text-red-600 mb-4">{error}</div>}
            <div className="flex gap-4 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                  <SelectItem value="Shipped">Shipped</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={refreshOrders} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={exportOrders}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-muted-foreground">Order ID</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Customer</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Items</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Amount</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Payment</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b border-border hover:bg-muted transition-colors">
                        <td className="py-3 px-4 font-medium text-primary">{order.id}</td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{order.customer.name}</p>
                            <p className="text-xs text-muted-foreground">{order.customer.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">{order.items.length} item(s)</td>
                        <td className="py-3 px-4 font-semibold">{formatCurrency(order.amount)}</td>
                        <td className="py-3 px-4">
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusIcon(order.status)} {order.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={getPaymentStatusColor(order.paymentStatus)}>
                            {order.paymentStatus}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{order.date}</td>
                        <td className="py-3 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order)
                                setShowDetails(true)
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order)
                                setShowEdit(true)
                              }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Order
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printOrder(order)}>
                                <Printer className="mr-2 h-4 w-4" />
                                Print Order
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => sendEmail(order)}>
                                <Mail className="mr-2 h-4 w-4" />
                                Send Email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => callCustomer(order)}>
                                <Phone className="mr-2 h-4 w-4" />
                                Call Customer
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deleteOrder(order.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Cancel Order
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

          {/* Order Details Modal */}
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Order Details - {selectedOrder?.id}</DialogTitle>
              </DialogHeader>
              {selectedOrder && (
                <div className="space-y-6">
                  {/* Customer Information */}
                  <div>
                    <h3 className="font-medium mb-3">Customer Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{selectedOrder.customer.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{selectedOrder.customer.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{selectedOrder.customer.phone}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Address</p>
                        <p className="font-medium">{selectedOrder.customer.address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <h3 className="font-medium mb-3">Order Items</h3>
                    <div className="space-y-3">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                            </div>
                          </div>
                          <p className="font-medium">{formatCurrency(item.price)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div>
                    <h3 className="font-medium mb-3">Order Summary</h3>
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(selectedOrder.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Shipping</span>
                        <span>{formatCurrency(0)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>{formatCurrency(selectedOrder.amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Management */}
                  <div>
                    <h3 className="font-medium mb-3">Status Management</h3>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => updateOrderStatus(selectedOrder.id, "Processing")}
                        disabled={selectedOrder.status !== "Pending"}
                      >
                        Start Processing
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => updateOrderStatus(selectedOrder.id, "Shipped")}
                        disabled={selectedOrder.status !== "Processing"}
                      >
                        Mark as Shipped
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => updateOrderStatus(selectedOrder.id, "Delivered")}
                        disabled={selectedOrder.status !== "Shipped"}
                      >
                        Mark as Delivered
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
