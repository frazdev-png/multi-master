"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"

type AdminWithdrawal = {
  id: number
  seller_id: number
  request_email: string
  payment_method: string
  payout_account: string
  account_holder_name: string
  amount: number
  currency: string
  status: string
  admin_notes?: string | null
  decided_at?: string | null
  created_at?: string | null
  seller_email?: string | null
  seller_name?: string | null
  seller_store_name?: string | null
}

function statusBadgeClass(status: string) {
  const s = String(status || "").toLowerCase()
  if (s === "approved") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
  if (s === "rejected") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
}

export default function AdminWithdrawalsPage() {
  const [rows, setRows] = useState<AdminWithdrawal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [status, setStatus] = useState("pending")
  const [paymentMethod, setPaymentMethod] = useState("all")
  const [search, setSearch] = useState("")

  const wsRef = useRef<WebSocket | null>(null)

  const queryString = useMemo(() => {
    const qs = new URLSearchParams()
    if (status && status !== "all") qs.set("status", status)
    if (paymentMethod && paymentMethod !== "all") qs.set("payment_method", paymentMethod)
    if (search.trim()) qs.set("search", search.trim())
    qs.set("limit", "200")
    return qs.toString()
  }, [paymentMethod, search, status])

  const queryStringRef = useRef(queryString)
  useEffect(() => {
    queryStringRef.current = queryString
  }, [queryString])

  const load = useCallback(async (qs: string, signal?: AbortSignal) => {
    const res = await fetch(`/api/backend/admin/withdrawals?${qs}`, { signal })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.error || "Failed to load withdrawals")
    }

    const list = Array.isArray(data?.withdrawals) ? data.withdrawals : []
    const mapped: AdminWithdrawal[] = list.map((x: any) => ({
      id: Number(x.id),
      seller_id: Number(x.seller_id),
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
      seller_email: x.seller_email ?? null,
      seller_name: x.seller_name ?? null,
      seller_store_name: x.seller_store_name ?? null,
    }))

    setRows(mapped)
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    const run = async () => {
      try {
        setIsLoading(true)
        setError("")
        await load(queryString, ctrl.signal)
      } catch (e: any) {
        const msg = String(e?.message || "")
        if (e?.name === "AbortError" || e?.code === "ERR_ABORTED" || /aborted/i.test(msg)) return
        setError(e?.message || "Failed to load withdrawals")
      } finally {
        setIsLoading(false)
      }
    }

    run()
    return () => ctrl.abort()
  }, [queryString])

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
              await load(queryStringRef.current)
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
  }, [load])

  const decide = async (withdrawalId: number, decision: "approved" | "rejected") => {
    const notes = window.prompt(decision === "approved" ? "Admin notes (optional):" : "Reason / notes (optional):")

    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/withdrawals/${withdrawalId}/decision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, admin_notes: notes || "" }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update withdrawal")
      }

      await load(queryStringRef.current)
    } catch (e: any) {
      setError(e?.message || "Failed to update withdrawal")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Withdrawals</h1>
        <p className="text-muted-foreground mt-1">Manage seller withdrawal requests</p>
      </div>

      {error ? <div className="rounded-lg border border-border bg-muted p-4 text-sm text-destructive">{error}</div> : null}

      <div className="admin-panel-table p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Payment Method</label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="binance">Binance</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Search</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Seller email, store, withdrawal id..." />
          </div>
        </div>
      </div>

      <div className="admin-panel-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="admin-panel-table-header-cell">ID</th>
                <th className="admin-panel-table-header-cell">Seller</th>
                <th className="admin-panel-table-header-cell">Method</th>
                <th className="admin-panel-table-header-cell">Account / Wallet</th>
                <th className="admin-panel-table-header-cell">Amount</th>
                <th className="admin-panel-table-header-cell">Status</th>
                <th className="admin-panel-table-header-cell">Requested</th>
                <th className="admin-panel-table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="admin-panel-table-cell" colSpan={8}>
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="admin-panel-table-cell" colSpan={8}>
                    No withdrawals found.
                  </td>
                </tr>
              ) : (
                rows.map((w) => (
                  <tr key={w.id} className="admin-panel-table-row">
                    <td className="admin-panel-table-cell font-semibold">#{w.id}</td>
                    <td className="admin-panel-table-cell">
                      <div className="space-y-1">
                        <div className="font-medium">{w.seller_store_name || w.seller_name || `Seller #${w.seller_id}`}</div>
                        <div className="text-xs text-muted-foreground">{w.seller_email || ""}</div>
                      </div>
                    </td>
                    <td className="admin-panel-table-cell">{String(w.payment_method || "").toUpperCase()}</td>
                    <td className="admin-panel-table-cell">
                      <div className="max-w-[320px] break-all text-sm text-muted-foreground">{w.payout_account}</div>
                      <div className="text-xs text-muted-foreground">{w.account_holder_name}</div>
                    </td>
                    <td className="admin-panel-table-cell text-primary font-semibold">{formatCurrency(w.amount)}</td>
                    <td className="admin-panel-table-cell">
                      <Badge className={statusBadgeClass(w.status)}>{w.status}</Badge>
                    </td>
                    <td className="admin-panel-table-cell">{w.created_at ? String(w.created_at).slice(0, 16).replace("T", " ") : ""}</td>
                    <td className="admin-panel-table-cell">
                      {String(w.status).toLowerCase() === "pending" ? (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => decide(w.id, "approved")} disabled={isLoading}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => decide(w.id, "rejected")} disabled={isLoading}>
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No actions</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
