"use client"

import { Search, Plus, Edit2, Trash2, Copy, RefreshCw, Download, Eye, ToggleLeft, ToggleRight, Calendar, Tag, TrendingUp, Filter, Gift, Percent, DollarSign, Clock, CheckCircle, XCircle, AlertCircle, MoreVertical } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Coupon {
  id: number;
  code: string;
  type: "Percentage" | "Fixed Amount";
  value: string;
  minPurchase: string;
  maxUsage: number;
  used: number;
  startDate: string;
  endDate: string;
  status: "Active" | "Inactive" | "Expired";
  description: string;
  applicableProducts: string[];
  applicableCategories: string[];
  maxDiscountAmount?: string;
  usagePerCustomer: number;
  createdAt: string;
  createdBy: string;
}

const EMPTY_COUPON_DRAFT: Coupon = {
  id: 0,
  code: "",
  type: "Percentage",
  value: "",
  minPurchase: "0.00 USDT",
  maxUsage: 100,
  used: 0,
  startDate: "",
  endDate: "",
  status: "Active",
  description: "",
  applicableProducts: [],
  applicableCategories: ["All"],
  maxDiscountAmount: undefined,
  usagePerCustomer: 1,
  createdAt: "",
  createdBy: "Admin",
}

export default function CouponsManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created")
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [coupons, setCoupons] = useState<Coupon[]>([
    {
      id: 1,
      code: "SAVE20",
      type: "Percentage",
      value: "20%",
      minPurchase: "50.00 USDT",
      maxUsage: 500,
      used: 234,
      startDate: "Jan 1, 2024",
      endDate: "Dec 31, 2024",
      status: "Active",
      description: "Save 20% on orders above 50 USDT",
      applicableProducts: [],
      applicableCategories: ["Electronics", "Fashion"],
      maxDiscountAmount: "100.00 USDT",
      usagePerCustomer: 1,
      createdAt: "Dec 15, 2023",
      createdBy: "Admin"
    },
    {
      id: 2,
      code: "FLAT500",
      type: "Fixed Amount",
      value: "5.00 USDT",
      minPurchase: "100.00 USDT",
      maxUsage: 1000,
      used: 687,
      startDate: "Jan 1, 2024",
      endDate: "Dec 31, 2024",
      status: "Active",
      description: "Get 5 USDT off on orders above 100 USDT",
      applicableProducts: [],
      applicableCategories: ["All"],
      usagePerCustomer: 3,
      createdAt: "Dec 10, 2023",
      createdBy: "Admin"
    },
    {
      id: 3,
      code: "NEWYEAR50",
      type: "Percentage",
      value: "50%",
      minPurchase: "200.00 USDT",
      maxUsage: 100,
      used: 98,
      startDate: "Jan 1, 2024",
      endDate: "Jan 31, 2024",
      status: "Expired",
      description: "New Year special - 50% off",
      applicableProducts: [],
      applicableCategories: ["Fashion", "Home"],
      maxDiscountAmount: "200.00 USDT",
      usagePerCustomer: 1,
      createdAt: "Dec 25, 2023",
      createdBy: "Admin"
    },
  ])

  const filteredCoupons = coupons.filter(coupon => {
    const matchesSearch = coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         coupon.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || coupon.status === statusFilter
    const matchesType = typeFilter === "all" || coupon.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  }).sort((a, b) => {
    switch(sortBy) {
      case "code": return a.code.localeCompare(b.code)
      case "usage": return b.used - a.used
      case "created": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case "endDate": return new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
      default: return 0
    }
  })

  const handleView = (coupon: Coupon) => {
    setSelectedCoupon(coupon)
    setIsViewDialogOpen(true)
  }

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon({...coupon})
    setIsEditDialogOpen(true)
  }

  const handleDelete = (couponId: number) => {
    if (confirm("Are you sure you want to delete this coupon? This action cannot be undone.")) {
      setCoupons(coupons.filter(coupon => coupon.id !== couponId))
    }
  }

  const handleToggleStatus = (couponId: number) => {
    setCoupons(coupons.map(coupon => {
      if (coupon.id === couponId) {
        const statusFlow = {
          "Active": "Inactive",
          "Inactive": "Active",
          "Expired": "Active"
        }
        return { ...coupon, status: statusFlow[coupon.status] as any }
      }
      return coupon
    }))
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    alert(`Coupon code ${code} copied to clipboard!`)
  }

  const handleSaveEdit = () => {
    if (editingCoupon) {
      setCoupons(coupons.map(coupon => 
        coupon.id === editingCoupon.id ? editingCoupon : coupon
      ))
      setIsEditDialogOpen(false)
      setEditingCoupon(null)
    }
  }

  const handleAddCoupon = () => {
    const newCoupon: Coupon = {
      id: Math.max(...coupons.map(c => c.id)) + 1,
      code: editingCoupon?.code || "NEWCODE",
      type: editingCoupon?.type || "Percentage",
      value: editingCoupon?.value || "10%",
      minPurchase: editingCoupon?.minPurchase || "0.00 USDT",
      maxUsage: editingCoupon?.maxUsage || 100,
      used: 0,
      startDate: editingCoupon?.startDate || new Date().toLocaleDateString(),
      endDate: editingCoupon?.endDate || new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString(),
      status: "Active",
      description: editingCoupon?.description || "",
      applicableProducts: editingCoupon?.applicableProducts || [],
      applicableCategories: editingCoupon?.applicableCategories || ["All"],
      maxDiscountAmount: editingCoupon?.maxDiscountAmount,
      usagePerCustomer: editingCoupon?.usagePerCustomer || 1,
      createdAt: new Date().toLocaleDateString(),
      createdBy: "Admin"
    }
    setCoupons([...coupons, newCoupon])
    setIsAddDialogOpen(false)
    setEditingCoupon(null)
  }

  const handleRefresh = () => {
    alert("Coupons data refreshed!")
  }

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Code,Type,Value,Min Purchase,Usage,Status,Start Date,End Date\n" +
      coupons.map(coupon => 
        `${coupon.code},${coupon.type},${coupon.value},${coupon.minPurchase},${coupon.used}/${coupon.maxUsage},${coupon.status},${coupon.startDate},${coupon.endDate}`
      ).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "coupons.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case "Active": return "bg-green-100 text-green-800"
      case "Inactive": return "bg-gray-100 text-gray-800"
      case "Expired": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getTypeIcon = (type: string) => {
    return type === "Percentage" ? <Percent size={16} /> : <DollarSign size={16} />
  }

  const totalCoupons = coupons.length
  const activeCoupons = coupons.filter(c => c.status === "Active").length
  const totalUsage = coupons.reduce((sum, c) => sum + c.used, 0)
  const totalMaxUsage = coupons.reduce((sum, c) => sum + c.maxUsage, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Coupons Management</h1>
          <p className="text-muted-foreground mt-1">Create and manage discount coupons</p>
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
          <Button
            onClick={() => {
              setEditingCoupon({
                ...EMPTY_COUPON_DRAFT,
                id: Math.max(...coupons.map((c) => c.id)) + 1,
                startDate: new Date().toLocaleDateString(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                createdAt: new Date().toLocaleDateString(),
              })
              setIsAddDialogOpen(true)
            }}
          >
            <Plus size={18} className="mr-2" />
            Create Coupon
          </Button>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coupons</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCoupons}</div>
            <p className="text-xs text-muted-foreground">
              {activeCoupons} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Of {totalMaxUsage.toLocaleString()} available
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coupons</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCoupons}</div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usage Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalMaxUsage > 0 ? Math.round((totalUsage / totalMaxUsage) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Average usage
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
                placeholder="Search coupons..."
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
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Percentage">Percentage</SelectItem>
                <SelectItem value="Fixed Amount">Fixed Amount</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="code">Code</SelectItem>
                <SelectItem value="usage">Usage</SelectItem>
                <SelectItem value="created">Created Date</SelectItem>
                <SelectItem value="endDate">End Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Coupons Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Coupon Code</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Value</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Min Purchase</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Usage</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Valid Period</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoupons.map((coupon) => (
                  <tr key={coupon.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded font-mono text-sm font-bold text-primary">
                            {coupon.code}
                          </code>
                          <Button variant="ghost" size="sm" onClick={() => handleCopyCode(coupon.code)}>
                            <Copy size={14} className="text-muted-foreground" />
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {coupon.description}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(coupon.type)}
                        <span>{coupon.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-primary">{coupon.value}</div>
                      {coupon.maxDiscountAmount && (
                        <div className="text-xs text-muted-foreground">Max: {coupon.maxDiscountAmount}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{coupon.minPurchase}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="font-semibold">{coupon.used} / {coupon.maxUsage}</div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${Math.min((coupon.used / coupon.maxUsage) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="text-muted-foreground" />
                          <span>{coupon.startDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={12} className="text-muted-foreground" />
                          <span>{coupon.endDate}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(coupon.status)}>
                        {coupon.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleView(coupon)}>
                          <Eye size={16} className="text-primary" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(coupon)}>
                          <Edit2 size={16} className="text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(coupon.id)}>
                          {coupon.status === "Active" ? (
                            <ToggleLeft size={16} className="text-orange-500" />
                          ) : (
                            <ToggleRight size={16} className="text-green-500" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(coupon.id)}>
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCoupons.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No coupons found matching your criteria
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Coupon Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Coupon Details</DialogTitle>
            <DialogDescription>Complete coupon information and usage statistics</DialogDescription>
          </DialogHeader>
          {selectedCoupon && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Coupon Code</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="bg-muted px-2 py-1 rounded font-mono text-sm font-bold text-primary">
                      {selectedCoupon.code}
                    </code>
                    <Button variant="ghost" size="sm" onClick={() => handleCopyCode(selectedCoupon.code)}>
                      <Copy size={14} />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getTypeIcon(selectedCoupon.type)}
                    <span>{selectedCoupon.type}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Value</Label>
                  <p className="font-semibold text-primary">{selectedCoupon.value}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Min Purchase</Label>
                  <p>{selectedCoupon.minPurchase}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                  <p>{selectedCoupon.description}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Usage</Label>
                  <p className="font-semibold">{selectedCoupon.used} / {selectedCoupon.maxUsage}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Usage Per Customer</Label>
                  <p>{selectedCoupon.usagePerCustomer}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Start Date</Label>
                  <p>{selectedCoupon.startDate}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
                  <p>{selectedCoupon.endDate}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedCoupon.status)}>
                    {selectedCoupon.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created By</Label>
                  <p>{selectedCoupon.createdBy}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created At</Label>
                  <p>{selectedCoupon.createdAt}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">Applicable Categories</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedCoupon.applicableCategories.map((category, index) => (
                      <Badge key={index} variant="outline">{category}</Badge>
                    ))}
                  </div>
                </div>
                {selectedCoupon.maxDiscountAmount && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Max Discount Amount</Label>
                    <p>{selectedCoupon.maxDiscountAmount}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Coupon Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Coupon</DialogTitle>
            <DialogDescription>Update coupon information</DialogDescription>
          </DialogHeader>
          {editingCoupon && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-code">Coupon Code</Label>
                  <Input
                    id="edit-code"
                    value={editingCoupon.code}
                    onChange={(e) => setEditingCoupon({...editingCoupon, code: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-type">Type</Label>
                  <Select value={editingCoupon.type} onValueChange={(value: "Percentage" | "Fixed Amount") => setEditingCoupon({...editingCoupon, type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Percentage">Percentage</SelectItem>
                      <SelectItem value="Fixed Amount">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-value">Value</Label>
                  <Input
                    id="edit-value"
                    value={editingCoupon.value}
                    onChange={(e) => setEditingCoupon({...editingCoupon, value: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-minPurchase">Min Purchase</Label>
                  <Input
                    id="edit-minPurchase"
                    value={editingCoupon.minPurchase}
                    onChange={(e) => setEditingCoupon({...editingCoupon, minPurchase: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-maxUsage">Max Usage</Label>
                  <Input
                    id="edit-maxUsage"
                    type="number"
                    value={editingCoupon.maxUsage}
                    onChange={(e) => setEditingCoupon({...editingCoupon, maxUsage: e.target.value === "" ? "" : parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-usagePerCustomer">Usage Per Customer</Label>
                  <Input
                    id="edit-usagePerCustomer"
                    type="number"
                    value={editingCoupon.usagePerCustomer}
                    onChange={(e) => setEditingCoupon({...editingCoupon, usagePerCustomer: e.target.value === "" ? "" : parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-startDate">Start Date</Label>
                  <Input
                    id="edit-startDate"
                    value={editingCoupon.startDate}
                    onChange={(e) => setEditingCoupon({...editingCoupon, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-endDate">End Date</Label>
                  <Input
                    id="edit-endDate"
                    value={editingCoupon.endDate}
                    onChange={(e) => setEditingCoupon({...editingCoupon, endDate: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editingCoupon.description}
                    onChange={(e) => setEditingCoupon({...editingCoupon, description: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-maxDiscountAmount">Max Discount Amount</Label>
                  <Input
                    id="edit-maxDiscountAmount"
                    value={editingCoupon.maxDiscountAmount || ""}
                    onChange={(e) => setEditingCoupon({...editingCoupon, maxDiscountAmount: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editingCoupon.status} onValueChange={(value: "Active" | "Inactive" | "Expired") => setEditingCoupon({...editingCoupon, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
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

      {/* Add Coupon Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Coupon</DialogTitle>
            <DialogDescription>Create a new discount coupon</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-code">Coupon Code</Label>
                <Input
                  id="new-code"
                  value={editingCoupon?.code || ""}
                  onChange={(e) => setEditingCoupon((prev) => ({ ...(prev ?? EMPTY_COUPON_DRAFT), code: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="new-type">Type</Label>
                <Select value={editingCoupon?.type || "Percentage"} onValueChange={(value: "Percentage" | "Fixed Amount") => setEditingCoupon((prev) => ({ ...(prev ?? EMPTY_COUPON_DRAFT), type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Percentage">Percentage</SelectItem>
                    <SelectItem value="Fixed Amount">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="new-value">Value</Label>
                <Input
                  id="new-value"
                  value={editingCoupon?.value || ""}
                  onChange={(e) => setEditingCoupon((prev) => ({ ...(prev ?? EMPTY_COUPON_DRAFT), value: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="new-minPurchase">Min Purchase</Label>
                <Input
                  id="new-minPurchase"
                  value={editingCoupon?.minPurchase || ""}
                  onChange={(e) => setEditingCoupon((prev) => ({ ...(prev ?? EMPTY_COUPON_DRAFT), minPurchase: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="new-maxUsage">Max Usage</Label>
                <Input
                  id="new-maxUsage"
                  type="number"
                  value={editingCoupon?.maxUsage || 100}
                    onChange={(e) => { const val = e.target.value; setEditingCoupon((prev) => ({ ...(prev ?? EMPTY_COUPON_DRAFT), maxUsage: val === "" ? "" : parseInt(val) }))}}
                  />
                </div>
                <div>
                  <Label htmlFor="new-usagePerCustomer">Usage Per Customer</Label>
                  <Input
                    id="new-usagePerCustomer"
                    type="number"
                    value={editingCoupon?.usagePerCustomer || 1}
                    onChange={(e) => { const val = e.target.value; setEditingCoupon((prev) => ({ ...(prev ?? EMPTY_COUPON_DRAFT), usagePerCustomer: val === "" ? "" : parseInt(val) }))}}
                />
              </div>
              <div>
                <Label htmlFor="new-startDate">Start Date</Label>
                <Input
                  id="new-startDate"
                  value={editingCoupon?.startDate || new Date().toLocaleDateString()}
                  onChange={(e) => setEditingCoupon((prev) => ({ ...(prev ?? EMPTY_COUPON_DRAFT), startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="new-endDate">End Date</Label>
                <Input
                  id="new-endDate"
                  value={editingCoupon?.endDate || new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}
                  onChange={(e) => setEditingCoupon((prev) => ({ ...(prev ?? EMPTY_COUPON_DRAFT), endDate: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="new-description">Description</Label>
                <Textarea
                  id="new-description"
                  value={editingCoupon?.description || ""}
                  onChange={(e) => setEditingCoupon((prev) => ({ ...(prev ?? EMPTY_COUPON_DRAFT), description: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCoupon}>
                Create Coupon
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
