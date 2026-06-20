"use client"

import { Search, CheckCircle, AlertCircle, Eye, Ban, RotateCw, Download, RefreshCw, Filter, TrendingUp, Users, Package, DollarSign, Mail, Phone, MapPin, Star, Calendar, MoreVertical, Edit2, Trash2, CreditCard, FileText } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { formatCurrency } from "@/lib/utils"

interface Vendor {
  id: number;
  name: string;
  owner: string;
  email: string;
  phone: string;
  address: string;
  products: number;
  orders: number;
  earnings: string;
  verified: boolean;
  status: "Active" | "Pending" | "Suspended";
  rating: number;
  joinDate: string;
  lastActive: string;
  commission: number;
  paymentMethod: string;
  documents: {
    idVerified: boolean;
    businessLicense: boolean;
    taxId: boolean;
  };
  performance: {
    avgResponseTime: string;
    fulfillmentRate: number;
    returnRate: number;
    customerSatisfaction: number;
  };
}

export default function VendorsManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [verificationFilter, setVerificationFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const parseAmount = (v: string) => {
    const n = Number(String(v || "").replace(/[^0-9.-]+/g, ""))
    return Number.isFinite(n) ? n : 0
  }

  const loadVendors = async () => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/admin/vendors")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load vendors")
      }

      const mapped: Vendor[] = (data?.vendors || []).map((v: any) => {
        const earningsNumber = Number(v.earnings ?? 0)
        const joinDate = v.joinDate ? new Date(v.joinDate).toLocaleDateString() : ""
        const lastActive = v.lastActive ? new Date(v.lastActive).toLocaleString() : ""
        return {
          id: Number(v.id),
          name: v.name || "",
          owner: v.owner || "",
          email: v.email || "",
          phone: v.phone || "",
          address: v.address || "",
          products: Number(v.products ?? 0),
          orders: Number(v.orders ?? 0),
          earnings: formatCurrency(earningsNumber),
          verified: Boolean(v.verified),
          status: (v.status || "Pending") as Vendor["status"],
          rating: 0,
          joinDate,
          lastActive,
          commission: Number(v.commission ?? 10),
          paymentMethod: "",
          documents: { idVerified: false, businessLicense: false, taxId: false },
          performance: { avgResponseTime: "", fulfillmentRate: 0, returnRate: 0, customerSatisfaction: 0 },
        }
      })

      setVendors(mapped)
    } catch (e: any) {
      setError(e?.message || "Failed to load vendors")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadVendors()
  }, [])

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.owner.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || vendor.status === statusFilter
    const matchesVerification = verificationFilter === "all" || 
                              (verificationFilter === "verified" && vendor.verified) ||
                              (verificationFilter === "unverified" && !vendor.verified)
    return matchesSearch && matchesStatus && matchesVerification
  }).sort((a, b) => {
    switch(sortBy) {
      case "name": return a.name.localeCompare(b.name)
      case "earnings": return parseAmount(b.earnings) - parseAmount(a.earnings)
      case "orders": return b.orders - a.orders
      case "rating": return b.rating - a.rating
      case "joinDate": return new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime()
      default: return 0
    }
  })

  const handleView = (vendor: Vendor) => {
    setSelectedVendor(vendor)
    setIsViewDialogOpen(true)
  }

  const handleToggleStatus = async (vendorId: number) => {
    const current = vendors.find((v) => v.id === vendorId)
    if (!current) return
    const nextStatus: Vendor["status"] = current.status === "Suspended" ? "Active" : "Suspended"

    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/vendors/${vendorId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update vendor status")
      }
      await loadVendors()
    } catch (e: any) {
      setError(e?.message || "Failed to update vendor status")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async (vendorId: number) => {
    const current = vendors.find((v) => v.id === vendorId)
    if (!current) return
    const nextStatus: Vendor["status"] = current.verified ? "Pending" : "Active"

    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/vendors/${vendorId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update vendor")
      }
      await loadVendors()
    } catch (e: any) {
      setError(e?.message || "Failed to update vendor")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = (vendorId: number) => {
    if (confirm("Suspend this vendor?")) {
      handleToggleStatus(vendorId)
    }
  }

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Owner,Email,Phone,Products,Orders,Earnings,Status,Verified,Rating,Join Date\n" +
      filteredVendors.map(vendor => 
        `${vendor.name},${vendor.owner},${vendor.email},${vendor.phone},${vendor.products},${vendor.orders},${vendor.earnings},${vendor.status},${vendor.verified},${vendor.rating},${vendor.joinDate}`
      ).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "vendors.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case "Active": return "bg-green-100 text-green-800"
      case "Pending": return "bg-yellow-100 text-yellow-800"
      case "Suspended": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const totalVendors = vendors.length
  const activeVendors = vendors.filter(v => v.status === "Active").length
  const pendingVendors = vendors.filter(v => v.status === "Pending").length
  const totalEarnings = vendors.reduce((sum, v) => sum + parseAmount(v.earnings), 0)
  const totalProducts = vendors.reduce((sum, v) => sum + v.products, 0)
  const totalOrders = vendors.reduce((sum, v) => sum + v.orders, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendors Management</h1>
          <p className="text-muted-foreground mt-1">Manage vendor accounts and earnings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVendors}</div>
            <p className="text-xs text-muted-foreground">
              {activeVendors} active, {pendingVendors} pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all vendors
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              All time orders
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalEarnings)}</div>
            <p className="text-xs text-muted-foreground">
              Vendor earnings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={verificationFilter} onValueChange={setVerificationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verification</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="earnings">Earnings</SelectItem>
                <SelectItem value="orders">Orders</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="joinDate">Join Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vendors Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Vendor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Contact</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Performance</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Earnings</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{vendor.name}</span>
                          {vendor.verified && (
                            <CheckCircle size={16} className="text-green-600" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Star size={12} className="fill-yellow-400 text-yellow-400" />
                          <span>{vendor.rating}</span>
                          <span>•</span>
                          <span>{vendor.products} products</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-1">
                          <Mail size={12} className="text-muted-foreground" />
                          <span className="truncate max-w-[150px]">{vendor.email}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone size={12} className="text-muted-foreground" />
                          <span>{vendor.phone}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="text-muted-foreground" />
                          <span>{vendor.joinDate}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-sm">
                        <div>{vendor.orders} orders</div>
                        <div className="flex items-center gap-1">
                          <span className={`${vendor.performance.fulfillmentRate >= 95 ? 'text-green-600' : 'text-orange-600'}`}>
                            {vendor.performance.fulfillmentRate}% fulfillment
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Response: {vendor.performance.avgResponseTime}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="font-semibold text-primary">{vendor.earnings}</div>
                        <div className="text-sm text-muted-foreground">{vendor.commission}% commission</div>
                        <div className="text-xs text-muted-foreground">{vendor.paymentMethod}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <Badge className={getStatusColor(vendor.status)}>
                          {vendor.status}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Last active: {vendor.lastActive}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleView(vendor)}>
                          <Eye size={16} className="text-primary" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleVerify(vendor.id)}>
                          <CheckCircle size={16} className={vendor.verified ? "text-orange-500" : "text-green-500"} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(vendor.id)}>
                          <Ban size={16} className="text-red-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(vendor.id)}>
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredVendors.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No vendors found matching your criteria
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vendor Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
            <DialogDescription>Complete vendor information and performance metrics</DialogDescription>
          </DialogHeader>
          {selectedVendor && (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Business Name</label>
                    <p className="font-semibold">{selectedVendor.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Owner</label>
                    <p>{selectedVendor.owner}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p>{selectedVendor.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p>{selectedVendor.phone}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <div className="flex items-center gap-1">
                      <MapPin size={14} className="text-muted-foreground" />
                      <p>{selectedVendor.address}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Join Date</label>
                    <p>{selectedVendor.joinDate}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Active</label>
                    <p>{selectedVendor.lastActive}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Rating</label>
                    <div className="flex items-center gap-1">
                      <Star size={14} className="fill-yellow-400 text-yellow-400" />
                      <span>{selectedVendor.rating}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <Badge className={getStatusColor(selectedVendor.status)}>
                      {selectedVendor.status}
                    </Badge>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Total Orders</label>
                    <p className="font-semibold">{selectedVendor.orders}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Total Products</label>
                    <p className="font-semibold">{selectedVendor.products}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fulfillment Rate</label>
                    <p className={`font-semibold ${selectedVendor.performance.fulfillmentRate >= 95 ? 'text-green-600' : 'text-orange-600'}`}>
                      {selectedVendor.performance.fulfillmentRate}%
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Return Rate</label>
                    <p className="font-semibold">{selectedVendor.performance.returnRate}%</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Avg Response Time</label>
                    <p>{selectedVendor.performance.avgResponseTime}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Customer Satisfaction</label>
                    <div className="flex items-center gap-1">
                      <Star size={14} className="fill-yellow-400 text-yellow-400" />
                      <span>{selectedVendor.performance.customerSatisfaction}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="documents" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">ID Verification</label>
                      <p className="text-sm text-muted-foreground">Government-issued ID verification</p>
                    </div>
                    <Switch checked={selectedVendor.documents.idVerified} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Business License</label>
                      <p className="text-sm text-muted-foreground">Valid business license document</p>
                    </div>
                    <Switch checked={selectedVendor.documents.businessLicense} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Tax ID</label>
                      <p className="text-sm text-muted-foreground">Tax identification number</p>
                    </div>
                    <Switch checked={selectedVendor.documents.taxId} />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="financial" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Total Earnings</label>
                    <p className="font-semibold text-primary">{selectedVendor.earnings}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Commission Rate</label>
                    <p>{selectedVendor.commission}%</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
                    <div className="flex items-center gap-1">
                      <CreditCard size={14} className="text-muted-foreground" />
                      <p>{selectedVendor.paymentMethod}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Account Status</label>
                    <Badge className={getStatusColor(selectedVendor.status)}>
                      {selectedVendor.status}
                    </Badge>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
