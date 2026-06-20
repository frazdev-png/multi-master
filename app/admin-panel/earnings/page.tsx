"use client"

import { useEffect, useRef, useState } from "react"
import { TrendingUp, Wallet, DollarSign, Download, RefreshCw, Search, Filter, Eye, CheckCircle, Clock, AlertCircle, Calendar, BarChart3, PieChart, Activity, CreditCard, ArrowUpRight, ArrowDownRight, MoreVertical, FileText, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"

interface VendorEarning {
  id: number;
  name: string;
  totalSales: string;
  commission: number;
  adminEarnings: string;
  pendingWithdrawal: string;
  status: "Active" | "Pending" | "Suspended";
  lastWithdrawal: string;
  totalWithdrawn: string;
  monthlySales: number[];
  paymentMethod: string;
  bankAccount: string;
  email: string;
  phone: string;
  joinDate: string;
  performance: {
    avgOrderValue: string;
    totalOrders: number;
    conversionRate: number;
    refundRate: number;
  };
}

export default function EarningsManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("sales")
  const [selectedVendor, setSelectedVendor] = useState<VendorEarning | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [globalCommission, setGlobalCommission] = useState(10)
  const [autoApproveWithdrawals, setAutoApproveWithdrawals] = useState(false)
  const [vendors, setVendors] = useState<VendorEarning[]>([])
  const [summary, setSummary] = useState({ platform_sales: 0, admin_commission_earned: 0, pending_withdrawals: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const wsRef = useRef<WebSocket | null>(null)

  const parseAmount = (v: string) => {
    const n = Number(String(v || "").replace(/[^0-9.-]+/g, ""))
    return Number.isFinite(n) ? n : 0
  }

  const load = async (signal?: AbortSignal) => {
    const qs = new URLSearchParams()
    if (searchTerm.trim()) qs.set("search", searchTerm.trim())
    qs.set("limit", "200")

    const res = await fetch(`/api/backend/admin/earnings?${qs.toString()}`, { signal })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.error || "Failed to load earnings")
    }

    const s = data?.summary || {}
    setSummary({
      platform_sales: Number(s.platform_sales || 0) || 0,
      admin_commission_earned: Number(s.admin_commission_earned || 0) || 0,
      pending_withdrawals: Number(s.pending_withdrawals || 0) || 0,
    })

    const list = Array.isArray(data?.vendors) ? data.vendors : []
    const mapped: VendorEarning[] = list.map((x: any) => {
      const storeName = String(x.store_name || x.email || "Vendor")
      const totalSalesNum = Number(x.total_sales || 0) || 0
      const adminEarnNum = Number(x.admin_earnings || 0) || 0
      const pendingNum = Number(x.pending_withdrawals || 0) || 0

      return {
        id: Number(x.seller_id),
        name: storeName,
        totalSales: formatCurrency(totalSalesNum),
        commission: Number(x.commission_rate || 0) || 0,
        adminEarnings: formatCurrency(adminEarnNum),
        pendingWithdrawal: formatCurrency(pendingNum),
        status: "Active",
        lastWithdrawal: "",
        totalWithdrawn: formatCurrency(Number(x.total_withdrawn || 0)),
        monthlySales: [],
        paymentMethod: "",
        bankAccount: "",
        email: String(x.email || ""),
        phone: "",
        joinDate: String(x.created_at || ""),
        performance: {
          avgOrderValue: "",
          totalOrders: 0,
          conversionRate: 0,
          refundRate: 0,
        },
      }
    })
    setVendors(mapped)
  }

  useEffect(() => {
    const ctrl = new AbortController()
    const run = async () => {
      try {
        setIsLoading(true)
        setError("")
        await load(ctrl.signal)
      } catch (e: any) {
        const msg = String(e?.message || "")
        if (e?.name === "AbortError" || e?.code === "ERR_ABORTED" || /aborted/i.test(msg)) return
        setError(e?.message || "Failed to load earnings")
      } finally {
        setIsLoading(false)
      }
    }
    run()
    return () => ctrl.abort()
  }, [searchTerm])

  useEffect(() => {
    let cancelled = false

    const connectWs = async () => {
      if (wsRef.current) return
      try {
        const tokenRes = await fetch("/api/ws-token")
        const tokenData = await tokenRes.json().catch(() => null)
        if (!tokenRes.ok || !tokenData?.token) return

        const baseUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080"
        const wsUrl = `${baseUrl}?token=${encodeURIComponent(tokenData.token)}`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onmessage = async (ev) => {
          if (cancelled) return
          let msg: any = null
          try {
            msg = JSON.parse(ev.data || "{}")
          } catch {
            msg = null
          }
          if (!msg || typeof msg !== "object") return
          if (msg.type === "withdrawal_created" || msg.type === "withdrawal_updated") {
            try {
              await load()
            } catch {
            }
          }
        }

        ws.onclose = () => {
          wsRef.current = null
        }
      } catch {
      }
    }

    connectWs()
    return () => {
      cancelled = true
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || vendor.status === statusFilter
    return matchesSearch && matchesStatus
  }).sort((a, b) => {
    switch(sortBy) {
      case "sales": return parseAmount(b.totalSales) - parseAmount(a.totalSales)
      case "earnings": return parseAmount(b.adminEarnings) - parseAmount(a.adminEarnings)
      case "pending": return parseAmount(b.pendingWithdrawal) - parseAmount(a.pendingWithdrawal)
      case "commission": return b.commission - a.commission
      default: return 0
    }
  })

  const handleView = (vendor: VendorEarning) => {
    setSelectedVendor(vendor)
    setIsViewDialogOpen(true)
  }

  const handleApproveWithdrawal = (vendorId: number) => {
    if (confirm("Approve this withdrawal request?")) {
      setVendors(vendors.map(vendor => 
        vendor.id === vendorId 
          ? { ...vendor, pendingWithdrawal: formatCurrency(0), totalWithdrawn: 
              formatCurrency(parseAmount(vendor.totalWithdrawn) + parseAmount(vendor.pendingWithdrawal)) }
          : vendor
      ))
      alert("Withdrawal approved and processed!")
    }
  }

  const handleRejectWithdrawal = (vendorId: number) => {
    if (confirm("Reject this withdrawal request?")) {
      setVendors(vendors.map(vendor => 
        vendor.id === vendorId ? { ...vendor, pendingWithdrawal: formatCurrency(0) } : vendor
      ))
      alert("Withdrawal rejected!")
    }
  }

  const handleUpdateCommission = () => {
    if (confirm(`Update global commission rate to ${globalCommission}% for all vendors?`)) {
      setVendors(vendors.map(vendor => ({ ...vendor, commission: globalCommission })))
      alert("Commission rates updated!")
    }
  }

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Vendor,Total Sales,Commission,Admin Earnings,Pending Withdrawal,Status,Total Withdrawn\n" +
      filteredVendors.map(vendor => 
        `${vendor.name},${vendor.totalSales},${vendor.commission}%,${vendor.adminEarnings},${vendor.pendingWithdrawal},${vendor.status},${vendor.totalWithdrawn}`
      ).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "earnings.csv")
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

  const totalSales = vendors.reduce((sum, v) => sum + parseAmount(v.totalSales), 0)
  const totalAdminEarnings = vendors.reduce((sum, v) => sum + parseAmount(v.adminEarnings), 0)
  const totalPendingWithdrawals = vendors.reduce((sum, v) => sum + parseAmount(v.pendingWithdrawal), 0)
  const totalWithdrawn = vendors.reduce((sum, v) => sum + parseAmount(v.totalWithdrawn), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Vendor Earnings & Withdrawals</h1>
        <p className="text-muted-foreground mt-1">Manage commission and vendor payments</p>
      </div>

      {error ? <div className="rounded-lg border border-border bg-muted p-4 text-sm text-destructive">{error}</div> : null}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="admin-panel-table p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Platform Sales</p>
              <h3 className="text-2xl font-bold">{formatCurrency(Number(summary.platform_sales || 0))}</h3>
            </div>
            <TrendingUp size={32} className="text-primary" />
          </div>
        </div>
        <div className="admin-panel-table p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Admin Commission Earned</p>
              <h3 className="text-2xl font-bold">{formatCurrency(Number(summary.admin_commission_earned || 0))}</h3>
            </div>
            <Wallet size={32} className="text-green-600" />
          </div>
        </div>
        <div className="admin-panel-table p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pending Withdrawals</p>
              <h3 className="text-2xl font-bold">{formatCurrency(Number(summary.pending_withdrawals || 0))}</h3>
            </div>
            <DollarSign size={32} className="text-orange-600" />
          </div>
        </div>
      </div>

      {/* Commission Configuration */}
      <div className="admin-panel-table p-6">
        <h2 className="text-lg font-bold mb-4">Commission Rates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Global Commission Rate (%)</label>
            <input type="number" defaultValue="10" className="admin-panel-search-input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Apply to All Categories</label>
            <button className="admin-panel-btn-primary">Apply</button>
          </div>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="admin-panel-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="admin-panel-table-header-cell">Vendor</th>
                <th className="admin-panel-table-header-cell">Total Sales</th>
                <th className="admin-panel-table-header-cell">Commission</th>
                <th className="admin-panel-table-header-cell">Admin Earnings</th>
                <th className="admin-panel-table-header-cell">Pending Withdrawal</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="admin-panel-table-cell" colSpan={5}>Loading...</td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td className="admin-panel-table-cell" colSpan={5}>No vendors found.</td>
                </tr>
              ) : filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="admin-panel-table-row">
                  <td className="admin-panel-table-cell font-semibold">{vendor.name}</td>
                  <td className="admin-panel-table-cell">{vendor.totalSales}</td>
                  <td className="admin-panel-table-cell">{vendor.commission}</td>
                  <td className="admin-panel-table-cell text-green-600 font-bold">{vendor.adminEarnings}</td>
                  <td className="admin-panel-table-cell text-orange-600 font-bold">{vendor.pendingWithdrawal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
