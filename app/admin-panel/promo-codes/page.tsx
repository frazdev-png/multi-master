"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type PromoCode = {
  id: number
  code: string
  is_used: boolean
  is_expired?: boolean
  status?: string
  used_by_user_id?: number | null
  used_by_email?: string | null
  used_by_name?: string | null
  used_at?: string | null
  expires_at?: string | null
  created_at?: string | null
}

export default function AdminPromoCodesPage() {
  const [rows, setRows] = useState<PromoCode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")

  const wsRef = useRef<WebSocket | null>(null)

  const queryString = useMemo(() => {
    const qs = new URLSearchParams()
    if (status && status !== "all") qs.set("status", status)
    if (search.trim()) qs.set("search", search.trim())
    qs.set("limit", "200")
    return qs.toString()
  }, [search, status])

  const load = async (signal?: AbortSignal) => {
    const res = await fetch(`/api/backend/admin/promo-codes?${queryString}`, { signal })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.error || "Failed to load promo codes")
    }

    const list = Array.isArray(data?.promo_codes) ? data.promo_codes : []
    const mapped: PromoCode[] = list.map((x: any) => ({
      id: Number(x.id),
      code: String(x.code || ""),
      is_used: Boolean(x.is_used),
      is_expired: Boolean(x.is_expired),
      status: String(x.status || ""),
      used_by_user_id: x.used_by_user_id ?? null,
      used_by_email: x.used_by_email ?? null,
      used_by_name: x.used_by_name ?? null,
      used_at: x.used_at ?? null,
      expires_at: x.expires_at ?? null,
      created_at: x.created_at ?? null,
    }))

    setRows(mapped)
  }

  useEffect(() => {
    const ctrl = new AbortController()
    const run = async () => {
      try {
        setIsLoading(true)
        setError("")
        await load(ctrl.signal)
      } catch (e: any) {
        if (e?.name === "AbortError") return
        setError(e?.message || "Failed to load promo codes")
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
            // keep admin lists current; promo codes may be used as part of seller registrations
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
  }, [queryString])

  const createPromoCode = async () => {
    const input = window.prompt("Enter 4-digit promo code (leave blank to auto-generate):")
    const code = (input || "").trim()

    const expiresInput = window.prompt("Expires at (optional, e.g. 2026-12-31):")
    const expires_at = (expiresInput || "").trim()

    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, expires_at }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create promo code")
      }
      await load()
    } catch (e: any) {
      setError(e?.message || "Failed to create promo code")
    } finally {
      setIsLoading(false)
    }
  }

  const deletePromoCode = async (id: number) => {
    if (!confirm("Delete this promo code?")) return

    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/promo-codes/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete promo code")
      }
      await load()
    } catch (e: any) {
      setError(e?.message || "Failed to delete promo code")
    } finally {
      setIsLoading(false)
    }
  }

  const statusBadgeClass = (s: string) => {
    const v = String(s || "").toLowerCase()
    if (v === "used") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
    if (v === "expired") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Seller Promo Codes</h1>
          <p className="text-muted-foreground mt-1">Manage 4-digit promo codes for free store creation</p>
        </div>
        <Button onClick={createPromoCode} disabled={isLoading}>
          Create Promo Code
        </Button>
      </div>

      {error ? <div className="rounded-lg border border-border bg-muted p-4 text-sm text-destructive">{error}</div> : null}

      <div className="admin-panel-table p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="used">Used</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Search</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code or used by email..." />
          </div>
        </div>
      </div>

      <div className="admin-panel-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="admin-panel-table-header-cell">Code</th>
                <th className="admin-panel-table-header-cell">Status</th>
                <th className="admin-panel-table-header-cell">Used By</th>
                <th className="admin-panel-table-header-cell">Expires</th>
                <th className="admin-panel-table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="admin-panel-table-cell" colSpan={5}>Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="admin-panel-table-cell" colSpan={5}>No promo codes found.</td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="admin-panel-table-row">
                    <td className="admin-panel-table-cell">
                      <code className="bg-muted px-2 py-1 rounded font-mono text-sm font-bold text-primary">{p.code}</code>
                    </td>
                    <td className="admin-panel-table-cell">
                      <Badge className={statusBadgeClass(p.status || "active")}>{p.status || "active"}</Badge>
                    </td>
                    <td className="admin-panel-table-cell">
                      <div className="text-sm">{p.used_by_email || "-"}</div>
                      {p.used_at ? <div className="text-xs text-muted-foreground">{String(p.used_at).slice(0, 16).replace("T", " ")}</div> : null}
                    </td>
                    <td className="admin-panel-table-cell">
                      <div className="text-sm">{p.expires_at ? String(p.expires_at).slice(0, 10) : "-"}</div>
                    </td>
                    <td className="admin-panel-table-cell">
                      {p.is_used ? (
                        <span className="text-xs text-muted-foreground">Locked</span>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => deletePromoCode(p.id)} disabled={isLoading}>
                          Delete
                        </Button>
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
