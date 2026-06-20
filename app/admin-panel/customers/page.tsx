"use client"

import { Search, Eye, Ban, RefreshCw, Download, Edit2, Trash2, Mail } from "lucide-react"
import { useState } from "react"
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
  const [customers, setCustomers] = useState<Customer[]>([
    {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      phone: "+1 234 567 8900",
      orders: 15,
      spent: "2,450.50 USDT",
      joined: "Jan 15, 2024",
      status: "Active",
      address: "123 Main St, City, State",
      lastOrder: "Dec 18, 2024"
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "+1 234 567 8901",
      orders: 8,
      spent: "890.25 USDT",
      joined: "Feb 20, 2024",
      status: "Active",
      address: "456 Oak Ave, City, State",
      lastOrder: "Dec 17, 2024"
    },
    {
      id: 3,
      name: "Mike Johnson",
      email: "mike@example.com",
      phone: "+1 234 567 8902",
      orders: 3,
      spent: "245.75 USDT",
      joined: "Mar 10, 2024",
      status: "Blocked",
      address: "789 Pine Rd, City, State",
      lastOrder: "Dec 15, 2024"
    },
  ])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  )

  const handleView = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsViewDialogOpen(true)
  }

  const handleToggleStatus = (customerId: number) => {
    setCustomers(customers.map(customer =>
      customer.id === customerId
        ? { ...customer, status: customer.status === "Active" ? "Blocked" : "Active" }
        : customer
    ))
  }

  const handleDelete = (customerId: number) => {
    if (confirm("Are you sure you want to delete this customer?")) {
      setCustomers(customers.filter(customer => customer.id !== customerId))
    }
  }

  const handleSendEmail = (customer: Customer) => {
    window.location.href = `mailto:${customer.email}`
  }

  const handleRefresh = () => {
    alert("Customers data refreshed!")
  }

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Email,Phone,Orders,Total Spent,Joined,Status\n" +
      customers.map(customer => 
        `${customer.name},${customer.email},${customer.phone},${customer.orders},${customer.spent},${customer.joined},${customer.status}`
      ).join("\n")
    
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

      {/* Search */}
      <div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Customers Table */}
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
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3 font-semibold">{customer.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{customer.email}</td>
                    <td className="px-4 py-3">{customer.phone}</td>
                    <td className="px-4 py-3">{customer.orders}</td>
                    <td className="px-4 py-3 text-primary font-semibold">{customer.spent}</td>
                    <td className="px-4 py-3 text-sm">{customer.joined}</td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(customer.status)}>
                        {customer.status}
                      </Badge>
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
                ))}
              </tbody>
            </table>
            {filteredCustomers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No customers found matching your search
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Customer Dialog */}
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
                  <Badge className={getStatusColor(selectedCustomer.status)}>
                    {selectedCustomer.status}
                  </Badge>
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
                <Button onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
