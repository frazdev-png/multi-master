"use client"

import { Search, Eye, Ban, RefreshCw, Download, Edit2, Trash2, Mail } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Customer = {
  id: number
  name: string
  email: string
  phone: string
  orders: number
  spent: string
  joined: string
  status: string
  address: string
  lastOrder: string
}

export default function CustomersManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const cancelRef = useRef(false)

  const fetchCustomers = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ role: "customer", limit: "200" })
      if (searchTerm.trim()) params.set("search", searchTerm.trim())
      const res = await fetch(`/api/backend/admin/users?${params}`, { signal })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load customers")

      const users = Array.isArray(data?.users) ? data.users : []
      const mapped: Customer[] = users.map((u: any) => ({
        id: Number(u.id),
        name: u.full_name || "Unknown",
        email: u.email || "",
        phone: u.phone || "-",
        orders: Number(u.order_count || 0),
        spent: (Number(u.total_spent || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USDT",
        joined: u.created_at ? String(u.created_at).slice(0, 10) : "-",
        status: u.is_active == 1 || u.is_active == null ? "Active" : "Blocked",
        address: "-",
        lastOrder: "-",
      }))
      if (!cancelRef.current) setCustomers(mapped)
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error("Failed to load customers:", e)
    } finally {
      if (!cancelRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    cancelRef.current = false
    const ctrl = new AbortController()
    fetchCustomers(ctrl.signal)
    return () => {
      cancelRef.current = true
      ctrl.abort()
    }
  }, [searchTerm])

  const handleView = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsViewDialogOpen(true)
  }

  const handleToggleStatus = async (customerId: number) => {
    const target = customers.find((c) => c.id === customerId)
    if (!target) return
    const isBlocking = target.status === "Active"
    let blockReason: string | null = null
    if (isBlocking) {
      blockReason = window.prompt("Enter reason for blocking this customer (optional):")
      if (blockReason === null) return // user cancelled
    }
    const newActive = isBlocking ? 0 : 1
    try {
      const res = await fetch("/api/backend/admin/users/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: customerId, is_active: newActive, block_reason: blockReason || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data?.error || "Failed to update status")
        return
      }
      setCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? { ...c, status: newActive ? "Active" : "Blocked" } : c)),
      )
    } catch {
      alert("Failed to update status")
    }
  }

  const handleDelete = async (customerId: number) => {
    if (!confirm("Are you sure you want to permanently delete this customer? This action cannot be undone.")) return
    try {
      const res = await fetch(`/api/backend/admin/users/${customerId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        alert(data?.error || "Failed to delete customer")
        return
      }
      setCustomers((prev) => prev.filter((c) => c.id !== customerId))
    } catch {
      alert("Failed to delete customer")
    }
  }

  const handleSendEmail = (customer: Customer) => {
    window.location.href = `mailto:${customer.email}`
  }

  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Name,Email,Phone,Orders,Total Spent,Joined,Status\n" +
      customers
        .map(
          (customer) =>
            `${customer.name},${customer.email},${customer.phone},${customer.orders},${customer.spent},${customer.joined},${customer.status}`,
        )
        .join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "customers.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusColor = (status: string) => {
    return status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Customers Management</h1>
          <p className="text-muted-foreground mt-1">Manage all registered customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchCustomers()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Orders</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Total Spent</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Joined</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                      Loading customers...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                      No customers found
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-4 py-3 font-semibold">{customer.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{customer.email}</td>
                      <td className="px-4 py-3">{customer.phone}</td>
                      <td className="px-4 py-3">{customer.orders}</td>
                      <td className="px-4 py-3 text-primary font-semibold">{customer.spent}</td>
                      <td className="px-4 py-3 text-sm">{customer.joined}</td>
                      <td className="px-4 py-3">
                        <Badge className={getStatusColor(customer.status)}>{customer.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleView(customer)}>
                            <Eye size={16} className="text-primary" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleSendEmail(customer)}>
                            <Mail size={16} className="text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(customer.id)}>
                            <Ban size={16} className={customer.status === "Active" ? "text-red-500" : "text-green-500"} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(customer.id)}>
                            <Trash2 size={16} className="text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
            <DialogDescription>View complete customer information</DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="font-semibold">{selectedCustomer.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className={getStatusColor(selectedCustomer.status)}>{selectedCustomer.status}</Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p>{selectedCustomer.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p>{selectedCustomer.phone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total Orders</label>
                  <p className="font-semibold">{selectedCustomer.orders}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total Spent</label>
                  <p className="font-semibold text-lg text-primary">{selectedCustomer.spent}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Joined Date</label>
                  <p>{selectedCustomer.joined}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Order</label>
                  <p>{selectedCustomer.lastOrder}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p>{selectedCustomer.address}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleSendEmail(selectedCustomer)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
