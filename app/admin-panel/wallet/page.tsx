"use client"

import { Search, Wallet, ArrowUpRight, ArrowDownRight, Lock, Unlock, DollarSign, RefreshCw, History } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils"

interface SellerWallet {
  id: number
  email: string
  full_name: string
  store_name: string | null
  pending_balance: number
  available_balance: number
  guarantee_balance: number
  total_earnings: number
  total_withdrawn: number
}

interface WalletDetail {
  seller: { id: number; email: string; full_name: string; store_name: string | null }
  wallet: { pending_balance: number; available_balance: number; guarantee_balance: number; total_earnings: number; total_withdrawn: number }
  transactions: any[]
}

export default function AdminWalletPage() {
  const [sellers, setSellers] = useState<SellerWallet[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedSeller, setSelectedSeller] = useState<WalletDetail | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: string; title: string }>({ open: false, action: "", title: "" })
  const [actionAmount, setActionAmount] = useState("")
  const [actionNote, setActionNote] = useState("")

  const loadSellers = async () => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/wallet/sellers${search ? `?search=${encodeURIComponent(search)}` : ""}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load sellers")
      setSellers(data?.sellers || [])
    } catch (e: any) {
      setError(e?.message || "Failed to load sellers")
    } finally {
      setIsLoading(false)
    }
  }

  const openSellerWallet = async (sellerId: number) => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/wallet/seller/${sellerId}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load wallet")
      setSelectedSeller(data)
      setIsDetailOpen(true)
    } catch (e: any) {
      setError(e?.message || "Failed to load wallet")
    } finally {
      setIsLoading(false)
    }
  }

  const performAction = async () => {
    if (!selectedSeller || !actionDialog.action || !actionAmount) return
    const amount = parseFloat(actionAmount)
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount"); return }

    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/admin/wallet/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionDialog.action, seller_id: selectedSeller.seller.id, amount, note: actionNote }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Action failed")
      setActionDialog({ open: false, action: "", title: "" })
      setActionAmount("")
      setActionNote("")
      await openSellerWallet(selectedSeller.seller.id)
      await loadSellers()
    } catch (e: any) {
      setError(e?.message || "Action failed")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadSellers() }, [])

  const actions = [
    { action: "add_funds", title: "Add Funds", icon: ArrowUpRight, color: "text-green-600" },
    { action: "deduct_funds", title: "Deduct Funds", icon: ArrowDownRight, color: "text-red-600" },
    { action: "add_guarantee", title: "Add Guarantee", icon: Lock, color: "text-blue-600" },
    { action: "remove_guarantee", title: "Remove Guarantee", icon: Unlock, color: "text-orange-600" },
    { action: "release_pending", title: "Release Pending", icon: DollarSign, color: "text-purple-600" },
    { action: "hold_funds", title: "Hold Funds", icon: RefreshCw, color: "text-yellow-600" },
    { action: "refund_funds", title: "Refund Funds", icon: History, color: "text-gray-600" },
  ]

  const typeLabels: Record<string, string> = {
    admin_credit: "Admin Credit", admin_debit: "Admin Debit", guarantee_add: "Guarantee Added",
    guarantee_remove: "Guarantee Removed", funds_released: "Funds Released", hold: "Funds Held",
    refund: "Funds Refunded", withdrawal: "Withdrawal", order_delivered: "Order Delivered",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Wallet Management</h1>
          <p className="text-muted-foreground">Manage seller wallets and balances</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
            <Input placeholder="Search sellers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 w-64" onKeyDown={(e) => e.key === "Enter" && loadSellers()} />
          </div>
          <Button onClick={loadSellers} variant="outline"><RefreshCw size={16} /></Button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Seller</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Pending</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Available</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Guarantee</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Total Earnings</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Withdrawn</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sellers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No sellers found</td></tr>
              ) : sellers.map((s) => (
                <tr key={s.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{s.full_name || s.email}</p>
                      <p className="text-xs text-muted-foreground">{s.store_name || s.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(s.pending_balance)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(s.available_balance)}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(s.guarantee_balance)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(s.total_earnings)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(s.total_withdrawn)}</td>
                  <td className="px-4 py-3 text-center">
                    <Button size="sm" variant="outline" onClick={() => openSellerWallet(s.id)}>
                      <Wallet size={16} className="mr-1" /> Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSeller?.seller?.full_name || "Seller"} Wallet</DialogTitle>
            <DialogDescription>{selectedSeller?.seller?.store_name || selectedSeller?.seller?.email}</DialogDescription>
          </DialogHeader>
          {selectedSeller && (
            <div className="space-y-6">
              <div className="grid grid-cols-5 gap-4">
                {[
                  { label: "Pending Balance", value: selectedSeller.wallet.pending_balance, color: "text-yellow-600" },
                  { label: "Available Balance", value: selectedSeller.wallet.available_balance, color: "text-green-600" },
                  { label: "Guarantee Balance", value: selectedSeller.wallet.guarantee_balance, color: "text-blue-600" },
                  { label: "Total Earnings", value: selectedSeller.wallet.total_earnings, color: "text-purple-600" },
                  { label: "Total Withdrawn", value: selectedSeller.wallet.total_withdrawn, color: "text-muted-foreground" },
                ].map((item) => (
                  <Card key={item.label}>
                    <CardHeader className="p-3 pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">{item.label}</CardTitle></CardHeader>
                    <CardContent className="p-3 pt-0"><p className={`text-xl font-bold ${item.color}`}>{formatCurrency(item.value)}</p></CardContent>
                  </Card>
                ))}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3">Admin Actions</h3>
                <div className="grid grid-cols-4 gap-2">
                  {actions.map((a) => (
                    <Button key={a.action} variant="outline" className="flex items-center gap-2 justify-start" onClick={() => { setActionDialog({ open: true, action: a.action, title: a.title }); setActionAmount(""); setActionNote("") }}>
                      <a.icon size={16} className={a.color} />
                      <span>{a.title}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3">Transaction History</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {selectedSeller.transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transactions yet</p>
                  ) : selectedSeller.transactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.direction === 'credit' ? 'bg-green-100' : 'bg-red-100'}`}>
                          {tx.direction === 'credit' ? <ArrowUpRight size={16} className="text-green-600" /> : <ArrowDownRight size={16} className="text-red-600" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{typeLabels[tx.type] || tx.type}</p>
                          <p className="text-xs text-muted-foreground">{tx.note || tx.description || ""}{tx.admin_name ? ` by ${tx.admin_name}` : ""}</p>
                          <p className="text-xs text-muted-foreground">{tx.created_at ? new Date(tx.created_at).toLocaleString() : ""}</p>
                        </div>
                      </div>
                      <div className={`text-right ${tx.direction === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        <p className="font-semibold">{tx.direction === 'credit' ? '+' : '-'}{formatCurrency(parseFloat(tx.amount))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog.open} onOpenChange={(o) => setActionDialog({ ...actionDialog, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog.title}</DialogTitle>
            <DialogDescription>Enter amount and reason for {selectedSeller?.seller?.full_name || "seller"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount (USDT)</label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Reason / Note</label>
              <Textarea placeholder="Optional note for transaction history" value={actionNote} onChange={(e) => setActionNote(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActionDialog({ open: false, action: "", title: "" })}>Cancel</Button>
              <Button onClick={performAction} disabled={isLoading}>{isLoading ? "Processing..." : "Confirm"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
