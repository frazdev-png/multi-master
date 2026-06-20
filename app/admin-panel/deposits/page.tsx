"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils"

type DepositRow = {
  id: number
  customer_id: number
  customer_name: string
  customer_email: string
  amount: number
  currency: string
  method: string
  status: string
  internal_note?: string | null
  created_by_email?: string | null
  approved_by_email?: string | null
  approved_at?: string | null
  created_ip?: string | null
  approved_ip?: string | null
  credited_at?: string | null
  instant_credit?: boolean
  instant_reason?: string | null
  created_at?: string | null
}

type CustomerSuggestion = {
  id: number
  email: string
  full_name?: string
}

export default function DepositsManagement() {
  const [rows, setRows] = useState<DepositRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const wsRef = useRef<WebSocket | null>(null)

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  const [formCustomerEmail, setFormCustomerEmail] = useState("")
  const [formCustomerId, setFormCustomerId] = useState<number | null>(null)
  const [formAmount, setFormAmount] = useState("")
  const [formMethod, setFormMethod] = useState<"manual" | "bank" | "crypto" | "adjustment">("manual")
  const [formStatus, setFormStatus] = useState<"pending" | "failed">("pending")
  const [formInternalNote, setFormInternalNote] = useState("")

  const [instantCredit, setInstantCredit] = useState(false)
  const [instantReason, setInstantReason] = useState("")
  const [showInstantDialog, setShowInstantDialog] = useState(false)

  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([])
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false)
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)

  const [approveDepositId, setApproveDepositId] = useState<number | null>(null)
  const [approveNote, setApproveNote] = useState("")
  const [showApproveDialog, setShowApproveDialog] = useState(false)

  const canInstantCredit = isSuperAdmin

  const normalizedCreateAmount = useMemo(() => {
    const n = Number(formAmount)
    return Number.isFinite(n) ? n : NaN
  }, [formAmount])

  const load = async (signal?: AbortSignal) => {
    const qs = new URLSearchParams()
    if (search.trim()) qs.set("search", search.trim())
    if (status !== "all") qs.set("status", status)
    qs.set("limit", "200")

    const res = await fetch(`/api/backend/admin/deposits?${qs.toString()}`, { signal })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || "Failed to load deposits")

    const list = Array.isArray(data?.deposits) ? data.deposits : []
    const mapped: DepositRow[] = list.map((x: any) => ({
      id: Number(x.id),
      customer_id: Number(x.customer_id),
      customer_name: String(x.customer_name || ""),
      customer_email: String(x.customer_email || ""),
      amount: Number(x.amount || 0) || 0,
      currency: String(x.currency || "USDT"),
      method: String(x.method || ""),
      status: String(x.status || ""),
      internal_note: x.internal_note ?? null,
      created_by_email: x.created_by_email ?? null,
      approved_by_email: x.approved_by_email ?? null,
      approved_at: x.approved_at ?? null,
      created_ip: x.created_ip ?? null,
      approved_ip: x.approved_ip ?? null,
      credited_at: x.credited_at ?? null,
      instant_credit: Boolean(x.instant_credit),
      instant_reason: x.instant_reason ?? null,
      created_at: x.created_at ?? null,
    }))
    setRows(mapped)
  }

  useEffect(() => {
    const ctrl = new AbortController()
    const run = async () => {
      try {
        const res = await fetch("/api/backend/auth/me", { signal: ctrl.signal })
        const data = await res.json().catch(() => null)
        if (!res.ok) return
        const u = data?.user || null
        setIsSuperAdmin(Boolean(u?.is_super_admin))
      } catch {
      }
    }
    run()
    return () => ctrl.abort()
  }, [])

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
        setError(e?.message || "Failed to load deposits")
      } finally {
        setIsLoading(false)
      }
    }
    run()
    return () => ctrl.abort()
  }, [search, status])

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
          if (msg.type === "deposit_created" || msg.type === "deposit_updated") {
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

  useEffect(() => {
    if (!showCustomerSuggestions) return
    const q = formCustomerEmail.trim()
    if (q.length < 2) {
      setCustomerSuggestions([])
      return
    }

    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        setCustomerLookupLoading(true)
        const qs = new URLSearchParams({ role: "customer", search: q, limit: "10" })
        const res = await fetch(`/api/backend/admin/users?${qs.toString()}`, { signal: ctrl.signal })
        const data = await res.json().catch(() => null)
        if (!res.ok) return

        const users = Array.isArray(data?.users) ? data.users : []
        setCustomerSuggestions(
          users.map((u: any) => ({
            id: Number(u.id),
            email: String(u.email || ""),
            full_name: String(u.full_name || ""),
          })),
        )
      } catch {
      } finally {
        setCustomerLookupLoading(false)
      }
    }, 250)

    return () => {
      ctrl.abort()
      clearTimeout(t)
    }
  }, [formCustomerEmail, showCustomerSuggestions])

  const resetCreateForm = () => {
    setFormCustomerEmail("")
    setFormCustomerId(null)
    setFormAmount("")
    setFormMethod("manual")
    setFormStatus("pending")
    setFormInternalNote("")
    setInstantCredit(false)
    setInstantReason("")
  }

  const submitCreateDeposit = async (opts?: { instant_credit?: boolean; instant_reason?: string }) => {
    if (!formCustomerId) {
      setError("Select a customer from the email suggestions")
      return
    }
    if (!Number.isFinite(normalizedCreateAmount) || normalizedCreateAmount <= 0) {
      setError("Valid amount is required")
      return
    }
    if (!formInternalNote.trim()) {
      setError("Internal note is required")
      return
    }

    try {
      setIsLoading(true)
      setError("")
      const payload: any = {
        customer_id: formCustomerId,
        amount: normalizedCreateAmount,
        method: formMethod,
        internal_note: formInternalNote.trim(),
        status: formStatus,
      }
      if (opts?.instant_credit) {
        payload.instant_credit = true
        payload.instant_reason = opts.instant_reason || ""
        payload.status = "completed"
      }

      const res = await fetch("/api/backend/admin/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to create deposit")

      resetCreateForm()
      await load()
    } catch (e: any) {
      setError(e?.message || "Failed to create deposit")
    } finally {
      setIsLoading(false)
    }
  }

  const onClickCreate = async () => {
    if (instantCredit) {
      if (!canInstantCredit) {
        setError("Instant credit is allowed only for super admins")
        return
      }
      setShowInstantDialog(true)
      return
    }
    await submitCreateDeposit()
  }

  const approveDeposit = async () => {
    if (!approveDepositId) return
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/deposits/${approveDepositId}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: approveNote.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to approve deposit")

      setShowApproveDialog(false)
      setApproveDepositId(null)
      setApproveNote("")
      await load()
    } catch (e: any) {
      setError(e?.message || "Failed to approve deposit")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customer Deposits</h1>
        <p className="text-muted-foreground mt-1">Manage customer wallet deposits</p>
      </div>

      {error ? <div className="rounded-lg border border-border bg-muted p-4 text-sm text-destructive">{error}</div> : null}

      <div className="admin-panel-table p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by customer email/name..." className="pl-10" />
          </div>

          <div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => load()} disabled={isLoading}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="admin-panel-table p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Create Deposit (Manual)</h2>
          <div className="text-xs text-muted-foreground">Default is pending (no wallet credit) until approved.</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium mb-2">Customer (email search)</label>
            <Input
              value={formCustomerEmail}
              onChange={(e) => {
                setFormCustomerEmail(e.target.value)
                setFormCustomerId(null)
                setShowCustomerSuggestions(true)
              }}
              onFocus={() => setShowCustomerSuggestions(true)}
              placeholder="Type customer email..."
            />
            {showCustomerSuggestions && (customerLookupLoading || customerSuggestions.length > 0) ? (
              <div className="absolute z-20 mt-2 w-full rounded-md border border-border bg-card shadow-lg max-h-56 overflow-auto">
                {customerLookupLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Searching...</div>
                ) : null}
                {customerSuggestions.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted"
                    onClick={() => {
                      setFormCustomerId(u.id)
                      setFormCustomerEmail(u.email)
                      setShowCustomerSuggestions(false)
                    }}
                  >
                    <div className="text-sm font-medium">{u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.full_name || `Customer #${u.id}`}</div>
                  </button>
                ))}
                {!customerLookupLoading && customerSuggestions.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No customers found.</div>
                ) : null}
              </div>
            ) : null}
            {formCustomerId ? <div className="mt-1 text-xs text-muted-foreground">Selected customer id: {formCustomerId}</div> : null}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <Input value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="e.g. 100" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Payment Method</label>
            <Select value={formMethod} onValueChange={(v) => setFormMethod(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="crypto">Crypto</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <Select value={formStatus} onValueChange={(v) => setFormStatus(v as any)} disabled={instantCredit}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            {instantCredit ? <div className="mt-1 text-xs text-muted-foreground">Instant credit forces status to completed.</div> : null}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Internal Note (required)</label>
            <Textarea value={formInternalNote} onChange={(e) => setFormInternalNote(e.target.value)} placeholder="Required note for audit trail" />
          </div>

          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={instantCredit}
                disabled={!canInstantCredit}
                onChange={(e) => setInstantCredit(e.target.checked)}
              />
              <span className="text-sm">Instant Credit (super admin only)</span>
              {!canInstantCredit ? <span className="text-xs text-muted-foreground">Not available</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={resetCreateForm} disabled={isLoading}>
                Clear
              </Button>
              <Button onClick={onClickCreate} disabled={isLoading}>
                Create Deposit
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-panel-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="admin-panel-table-header-cell">Customer</th>
                <th className="admin-panel-table-header-cell">Amount</th>
                <th className="admin-panel-table-header-cell">Method</th>
                <th className="admin-panel-table-header-cell">Status</th>
                <th className="admin-panel-table-header-cell">Internal Note</th>
                <th className="admin-panel-table-header-cell">Created By</th>
                <th className="admin-panel-table-header-cell">Approved By</th>
                <th className="admin-panel-table-header-cell">Date</th>
                <th className="admin-panel-table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="admin-panel-table-cell" colSpan={9}>Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="admin-panel-table-cell" colSpan={9}>No deposits found.</td>
                </tr>
              ) : (
                rows.map((d) => (
                  <tr key={d.id} className="admin-panel-table-row">
                    <td className="admin-panel-table-cell font-semibold">
                      <div className="space-y-1">
                        <div>{d.customer_name || `Customer #${d.customer_id}`}</div>
                        <div className="text-xs text-muted-foreground">{d.customer_email}</div>
                      </div>
                    </td>
                    <td className="admin-panel-table-cell font-bold text-primary">{formatCurrency(Number(d.amount || 0))}</td>
                    <td className="admin-panel-table-cell">{d.method || "-"}</td>
                    <td className="admin-panel-table-cell">{String(d.status || "")}</td>
                    <td className="admin-panel-table-cell">
                      <div className="max-w-[260px] truncate text-sm" title={d.internal_note || ""}>{d.internal_note || "-"}</div>
                    </td>
                    <td className="admin-panel-table-cell">
                      <div className="text-sm">{d.created_by_email || "-"}</div>
                      <div className="text-xs text-muted-foreground">{d.created_ip || ""}</div>
                    </td>
                    <td className="admin-panel-table-cell">
                      <div className="text-sm">{d.approved_by_email || "-"}</div>
                      <div className="text-xs text-muted-foreground">{d.approved_ip || ""}</div>
                    </td>
                    <td className="admin-panel-table-cell">{d.created_at ? String(d.created_at).slice(0, 16).replace("T", " ") : ""}</td>
                    <td className="admin-panel-table-cell">
                      {String(d.status || "").toLowerCase() === "pending" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setApproveDepositId(d.id)
                            setApproveNote("")
                            setShowApproveDialog(true)
                          }}
                          disabled={isLoading}
                        >
                          Approve
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showInstantDialog} onOpenChange={setShowInstantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instant Credit Confirmation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              This will create the deposit as <b>completed</b> and immediately credit the customer wallet.
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Mandatory Reason</label>
              <Textarea value={instantReason} onChange={(e) => setInstantReason(e.target.value)} placeholder="Why instant credit is justified" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInstantDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!instantReason.trim()) {
                  setError("Instant credit reason is required")
                  return
                }
                setShowInstantDialog(false)
                await submitCreateDeposit({ instant_credit: true, instant_reason: instantReason.trim() })
              }}
              disabled={isLoading}
            >
              Confirm Instant Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Approving will credit the customer wallet atomically.</div>
            <div>
              <label className="block text-sm font-medium mb-2">Approval Note (optional)</label>
              <Textarea value={approveNote} onChange={(e) => setApproveNote(e.target.value)} placeholder="Optional note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={approveDeposit} disabled={isLoading}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
