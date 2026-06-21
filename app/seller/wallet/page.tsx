"use client"

import { useEffect, useRef, useState } from "react"
import { SellerSidebar } from "@/components/seller/sidebar"
import { SellerHeader } from "@/components/seller/header"
import { ArrowUpRight, ArrowDownRight, Lock, Wallet, Clock, DollarSign, History } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type WalletData = {
  available_balance: number
  raw_available_balance?: number
  pending_balance: number
  guarantee_balance: number
  total_earnings: number
  total_withdrawn: number
  currency: string
}

type Transaction = {
  id: number
  type: string
  direction: string
  amount: string
  description: string
  note: string | null
  admin_name: string | null
  created_at: string
}

type Withdrawal = {
  id: number
  request_email: string
  payment_method: string
  payout_account: string
  account_holder_name: string
  amount: number | string
  currency: string
  status: string
  admin_notes?: string | null
  decided_at?: string | null
  created_at?: string
}

const typeLabels: Record<string, string> = {
  admin_credit: "Admin Credit",
  admin_debit: "Admin Debit",
  guarantee_add: "Guarantee Added",
  guarantee_remove: "Guarantee Removed",
  funds_released: "Funds Released",
  hold: "Funds Held",
  refund: "Funds Refunded",
  withdrawal: "Withdrawal",
  order_delivered: "Order Delivered",
}

export default function SellerWalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const [withdrawForm, setWithdrawForm] = useState({
    email: "",
    payment_method: "binance" as "binance" | "paypal",
    payout_account: "",
    account_holder_name: "",
    amount: "",
  })

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError("")
      const [walletRes, withdrawalsRes] = await Promise.all([
        fetch("/api/backend/seller/wallet"),
        fetch("/api/backend/seller/withdrawals?limit=50"),
      ])
      const walletData = await walletRes.json().catch(() => null)
      const withdrawalsData = await withdrawalsRes.json().catch(() => null)

      if (!walletRes.ok) throw new Error(walletData?.error || "Failed to load wallet")
      if (walletData?.wallet) setWallet(walletData.wallet)
      if (walletData?.transactions) setTransactions(walletData.transactions)
      if (withdrawalsData?.withdrawals) setWithdrawals(withdrawalsData.withdrawals)
    } catch (e: any) {
      setError(e?.message || "Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const ws = new WebSocket(`${proto}//${host}/ws`)
    wsRef.current = ws
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data?.event === "wallet_updated" || data?.event === "withdrawal_created" || data?.event === "withdrawal_updated") {
          loadData()
        }
      } catch {}
    }
    ws.onclose = () => {}
    return () => ws.close()
  }, [])

  const handleWithdraw = async () => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/seller/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withdrawForm),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Withdrawal request failed")
      setShowWithdrawDialog(false)
      setWithdrawForm({ email: "", payment_method: "binance", payout_account: "", account_holder_name: "", amount: "" })
      await loadData()
    } catch (e: any) {
      setError(e?.message || "Withdrawal failed")
    } finally {
      setIsLoading(false)
    }
  }

  const balanceCards = wallet ? [
    { label: "Pending Balance", value: wallet.pending_balance, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Available Balance", value: wallet.available_balance, icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
    { label: "Guarantee Balance", value: wallet.guarantee_balance, icon: Lock, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total Earnings", value: wallet.total_earnings, icon: Wallet, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Total Withdrawn", value: wallet.total_withdrawn, icon: History, color: "text-muted-foreground", bg: "bg-gray-50" },
  ] : []

  const statusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-100 text-green-700"
      case "rejected": return "bg-red-100 text-red-700"
      default: return "bg-yellow-100 text-yellow-700"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SellerSidebar isMobileMenuOpen={isMobileMenuOpen} onMobileMenuClose={() => setIsMobileMenuOpen(false)} />
      <div className="lg:pl-64">
        <SellerHeader title="Wallet" onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="p-4 md:p-6 space-y-6">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {balanceCards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
                  <div className={`w-7 h-7 rounded-full ${card.bg} flex items-center justify-center`}>
                    <card.icon size={14} className={card.color} />
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <p className={`text-lg font-bold ${card.color}`}>{formatCurrency(card.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setShowWithdrawDialog(true)}>
              <ArrowUpRight size={16} className="mr-1" /> Request Withdrawal
            </Button>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Transaction History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No transactions yet</p>
              ) : (
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
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
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Withdrawal History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {withdrawals.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No withdrawals yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Method</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Account</th>
                        <th className="px-3 py-2 text-right text-xs font-medium">Amount</th>
                        <th className="px-3 py-2 text-center text-xs font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {withdrawals.map((w) => (
                        <tr key={w.id} className="hover:bg-muted/50">
                          <td className="px-3 py-2 text-sm">{w.created_at ? new Date(w.created_at).toLocaleDateString() : "-"}</td>
                          <td className="px-3 py-2 text-sm capitalize">{w.payment_method}</td>
                          <td className="px-3 py-2 text-sm">{w.payout_account}</td>
                          <td className="px-3 py-2 text-sm text-right font-medium">{formatCurrency(parseFloat(String(w.amount)))}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(w.status)}`}>{w.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Available for withdrawal: {formatCurrency(wallet?.available_balance ?? 0)} USDT
              {wallet?.guarantee_balance ? ` (${formatCurrency(wallet.guarantee_balance)} locked in guarantees)` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input value={withdrawForm.email} onChange={(e) => setWithdrawForm({ ...withdrawForm, email: e.target.value })} placeholder="your@email.com" />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={withdrawForm.payment_method} onValueChange={(v) => setWithdrawForm({ ...withdrawForm, payment_method: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="binance">Binance</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Payout Account</label>
              <Input value={withdrawForm.payout_account} onChange={(e) => setWithdrawForm({ ...withdrawForm, payout_account: e.target.value })} placeholder="Account ID / Email" />
            </div>
            <div>
              <label className="text-sm font-medium">Account Holder Name</label>
              <Input value={withdrawForm.account_holder_name} onChange={(e) => setWithdrawForm({ ...withdrawForm, account_holder_name: e.target.value })} placeholder="Full name" />
            </div>
            <div>
              <label className="text-sm font-medium">Amount (USDT)</label>
              <Input type="number" step="0.01" min="0" max={wallet?.available_balance ?? 0} value={withdrawForm.amount} onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>Cancel</Button>
              <Button onClick={handleWithdraw} disabled={isLoading}>{isLoading ? "Processing..." : "Submit Withdrawal"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
