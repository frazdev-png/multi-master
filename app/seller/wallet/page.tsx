"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { SellerSidebar } from "@/components/seller/sidebar"
import { SellerHeader } from "@/components/seller/header"
import { ArrowUp, ArrowDown, Download, Send } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type SellerWallet = {
  balance: number
  locked: number
  available: number
  currency: string
  promo_exempt_guarantee: boolean
  promo_code_used: string | null
}

type Withdrawal = {
  id: number
  request_email: string
  payment_method: "binance" | "paypal" | string
  payout_account: string
  account_holder_name: string
  amount: number | string
  currency: string
  status: "pending" | "approved" | "rejected" | string
  admin_notes?: string | null
  decided_at?: string | null
  created_at?: string
}

export default function SellerWalletPage() {
  const [wallet, setWallet] = useState<SellerWallet | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)

  const [withdrawForm, setWithdrawForm] = useState({
    email: "",
    payment_method: "binance" as "binance" | "paypal",
    payout_account: "",
    account_holder_name: "",
    amount: "",
  })

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((v) => !v)
  }

  const loadWalletAndWithdrawals = async (signal?: AbortSignal) => {
    const [walletRes, withdrawalsRes] = await Promise.all([
      fetch("/api/backend/seller/wallet", { signal }),
      fetch("/api/backend/seller/withdrawals", { signal }),
    ])

    const walletData = await walletRes.json().catch(() => null)
    const withdrawalsData = await withdrawalsRes.json().catch(() => null)

    if (!walletRes.ok) {
      throw new Error(walletData?.error || "Failed to load wallet")
    }
    if (!withdrawalsRes.ok) {
      throw new Error(withdrawalsData?.error || "Failed to load withdrawals")
    }

    const w = walletData?.wallet
    const wl: SellerWallet | null = w
      ? {
          balance: Number(w.balance || 0) || 0,
          locked: Number(w.locked || 0) || 0,
          available: Number(w.available || 0) || 0,
          currency: String(w.currency || "USDT"),
          promo_exempt_guarantee: Boolean(w.promo_exempt_guarantee),
          promo_code_used: w.promo_code_used ? String(w.promo_code_used) : null,
        }
      : null

    const list = Array.isArray(withdrawalsData?.withdrawals) ? withdrawalsData.withdrawals : []
    const mapped: Withdrawal[] = list.map((x: any) => ({
      id: Number(x.id),
      request_email: String(x.request_email || ""),
      payment_method: String(x.payment_method || ""),
      payout_account: String(x.payout_account || ""),
      account_holder_name: String(x.account_holder_name || ""),
      amount: Number(x.amount || 0) || 0,
      currency: String(x.currency || "USDT"),
      status: String(x.status || "pending"),
      admin_notes: x.admin_notes ?? null,
      decided_at: x.decided_at ?? null,
      created_at: x.created_at ?? null,
    }))

    setWallet(wl)
    setWithdrawals(mapped)
  }

  useEffect(() => {
    const ctrl = new AbortController()
    const load = async () => {
      try {
        setIsLoading(true)
        setError("")
        await loadWalletAndWithdrawals(ctrl.signal)
      } catch (e: any) {
        const msg = String(e?.message || "")
        if (e?.name === "AbortError" || e?.code === "ERR_ABORTED" || /aborted/i.test(msg)) return
        setError(e?.message || "Failed to load wallet")
      } finally {
        setIsLoading(false)
      }
    }

    load()
    return () => {
      ctrl.abort()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const connectWs = async () => {
      if (wsRef.current) return
      try {
        const tokenRes = await fetch("/api/ws-token")
        const tokenData = await tokenRes.json().catch(() => null)
        if (!tokenRes.ok || !tokenData?.token) {
          return
        }

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
          if (msg.type === "withdrawal_updated" || msg.type === "withdrawal_created") {
            try {
              await loadWalletAndWithdrawals()
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

  const onSubmitWithdrawal = async () => {
    const email = withdrawForm.email.trim()
    const method = withdrawForm.payment_method
    const payout = withdrawForm.payout_account.trim()
    const holder = withdrawForm.account_holder_name.trim()
    const amountNum = Number(withdrawForm.amount)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Valid email is required")
      return
    }
    if (!payout) {
      setError("Account number / wallet address is required")
      return
    }
    if (!holder) {
      setError("Account holder name is required")
      return
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Valid withdrawal amount is required")
      return
    }

    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/seller/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          payment_method: method,
          payout_account: payout,
          account_holder_name: holder,
          amount: amountNum,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit withdrawal")
      }

      setWithdrawForm((p) => ({ ...p, amount: "" }))
      await loadWalletAndWithdrawals()
    } catch (e: any) {
      setError(e?.message || "Failed to submit withdrawal")
    } finally {
      setIsLoading(false)
    }
  }

  const statusBadge = (status: string) => {
    const s = String(status || "").toLowerCase()
    if (s === "approved") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    if (s === "rejected") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
  }

  return (
    <div className="flex bg-background">
      <SellerSidebar isMobileMenuOpen={isMobileMenuOpen} onMobileMenuClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col">
        <SellerHeader onMobileMenuToggle={toggleMobileMenu} isMobileMenuOpen={isMobileMenuOpen} />

        <main className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Wallet</h1>
            <p className="text-muted-foreground">Manage your funds and transactions</p>
          </div>

          {error ? (
            <div className="mb-6 rounded-lg border border-border bg-muted p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {/* Wallet Balance Card */}
          <div className="card bg-gradient-to-br from-primary to-primary-dark text-primary-foreground mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm opacity-90">Available Balance (USDT)</p>
                <p className="text-4xl font-bold mt-2">{formatCurrency(wallet?.available || 0)}</p>
              </div>
              <div>
                <p className="text-sm opacity-90">Wallet Balance (USDT)</p>
                <p className="text-4xl font-bold mt-2">{formatCurrency(wallet?.balance || 0)}</p>
              </div>
              <div>
                <p className="text-sm opacity-90">Locked (Guarantee) (USDT)</p>
                <p className="text-4xl font-bold mt-2">{formatCurrency(wallet?.locked || 0)}</p>
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-8 border-t border-primary-foreground/20">
              <div className="text-sm">
                {wallet?.promo_exempt_guarantee ? (
                  <div>
                    <div className="font-medium">Guarantee money exempt</div>
                    <div className="opacity-90">Promo code: {wallet?.promo_code_used || "-"}</div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">Guarantee money policy applies</div>
                    <div className="opacity-90">Locked amount reduces withdrawable balance.</div>
                  </div>
                )}
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-white text-primary rounded-lg hover:bg-muted transition-colors font-medium"
                  onClick={() => {
                    const el = document.getElementById("withdraw-form")
                    el?.scrollIntoView({ behavior: "smooth" })
                  }}
                  type="button"
                >
                  <Send size={18} />
                  Withdraw Funds
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-primary-foreground rounded-lg hover:bg-primary-foreground/10 transition-colors font-medium" type="button">
                  <Download size={18} />
                  Export Statement
                </button>
              </div>
            </div>
          </div>

          <div id="withdraw-form" className="card mb-8">
            <h2 className="text-xl font-bold mb-6">Withdrawal Request</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email (required)</label>
                <input
                  className="input w-full"
                  value={withdrawForm.email}
                  onChange={(e) => setWithdrawForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com"
                  type="email"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Select Payment Method</label>
                <select
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={withdrawForm.payment_method}
                  onChange={(e) => setWithdrawForm((p) => ({ ...p, payment_method: e.target.value as any }))}
                >
                  <option value="binance">Binance</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Account Number / Wallet Address</label>
                <input
                  className="input w-full"
                  value={withdrawForm.payout_account}
                  onChange={(e) => setWithdrawForm((p) => ({ ...p, payout_account: e.target.value }))}
                  placeholder={withdrawForm.payment_method === "binance" ? "Binance wallet address" : "PayPal email"}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Account Holder Name</label>
                <input
                  className="input w-full"
                  value={withdrawForm.account_holder_name}
                  onChange={(e) => setWithdrawForm((p) => ({ ...p, account_holder_name: e.target.value }))}
                  placeholder="Account holder"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Withdrawal Amount (USDT only)</label>
                <input
                  className="input w-full"
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  inputMode="decimal"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Method (auto-linked)</label>
                <input className="input w-full" value={withdrawForm.payment_method === "binance" ? "Binance" : "PayPal"} readOnly />
              </div>
            </div>
            <div className="mt-6">
              <button className="btn-primary" type="button" onClick={onSubmitWithdrawal} disabled={isLoading}>
                {isLoading ? "Submitting..." : "Submit Withdrawal Request"}
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-6">Withdrawal History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground">Payment Method</th>
                    <th className="text-left py-3 px-4 text-muted-foreground">Account / Wallet</th>
                    <th className="text-left py-3 px-4 text-muted-foreground">Amount (USDT)</th>
                    <th className="text-left py-3 px-4 text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-4 text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="py-6 px-4 text-muted-foreground" colSpan={5}>
                        Loading...
                      </td>
                    </tr>
                  ) : withdrawals.length === 0 ? (
                    <tr>
                      <td className="py-6 px-4 text-muted-foreground" colSpan={5}>
                        No withdrawal requests found.
                      </td>
                    </tr>
                  ) : (
                    withdrawals.map((w) => (
                      <tr key={w.id} className="border-b border-border hover:bg-muted transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {String(w.payment_method).toLowerCase() === "binance" ? (
                              <ArrowDown className="text-primary" size={16} />
                            ) : (
                              <ArrowDown className="text-primary" size={16} />
                            )}
                            <span className="font-medium">{String(w.payment_method).toUpperCase()}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground break-all">{w.payout_account}</td>
                        <td className="py-3 px-4 font-semibold">{formatCurrency(Number(w.amount || 0) || 0)}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {w.created_at ? String(w.created_at).slice(0, 10) : ""}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusBadge(String(w.status))}`}>{w.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
