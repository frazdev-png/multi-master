"use client"

import { useEffect, useRef, useState } from "react"

import { Download, Mail, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type SubscriberRow = {
  id: number
  email: string
  status: string
  subscribed_at?: string | null
  unsubscribed_at?: string | null
  created_at?: string | null
}

export default function SubscribersManagement() {
  const [rows, setRows] = useState<SubscriberRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const wsRef = useRef<WebSocket | null>(null)

  const load = async (signal?: AbortSignal) => {
    const qs = new URLSearchParams()
    if (search.trim()) qs.set("search", search.trim())
    if (status !== "all") qs.set("status", status)
    qs.set("limit", "200")

    const res = await fetch(`/api/backend/admin/subscribers?${qs.toString()}`, { signal })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || "Failed to load subscribers")

    const list = Array.isArray(data?.subscribers) ? data.subscribers : []
    const mapped: SubscriberRow[] = list.map((x: any) => ({
      id: Number(x.id),
      email: String(x.email || ""),
      status: String(x.status || "subscribed"),
      subscribed_at: x.subscribed_at ?? null,
      unsubscribed_at: x.unsubscribed_at ?? null,
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
        const msg = String(e?.message || "")
        if (e?.name === "AbortError" || e?.code === "ERR_ABORTED" || /aborted/i.test(msg)) return
        setError(e?.message || "Failed to load subscribers")
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
          if (msg.type === "subscriber_created" || msg.type === "subscriber_updated" || msg.type === "subscriber_deleted") {
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

  const exportCsv = () => {
    const header = "Email,Status,SubscribedAt,UnsubscribedAt\n"
    const rowsCsv = rows
      .map((r) => `${r.email},${r.status},${r.subscribed_at || ""},${r.unsubscribed_at || ""}`)
      .join("\n")
    const csvContent = `data:text/csv;charset=utf-8,${encodeURIComponent(header + rowsCsv)}`
    const link = document.createElement("a")
    link.setAttribute("href", csvContent)
    link.setAttribute("download", "subscribers.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const addSubscriber = async () => {
    const email = (window.prompt("Subscriber email:") || "").trim()
    if (!email) return
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/admin/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, status: "subscribed" }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to add subscriber")
      await load()
    } catch (e: any) {
      setError(e?.message || "Failed to add subscriber")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleStatus = async (row: SubscriberRow) => {
    const next = String(row.status).toLowerCase() === "subscribed" ? "unsubscribed" : "subscribed"
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/subscribers/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to update subscriber")
      await load()
    } catch (e: any) {
      setError(e?.message || "Failed to update subscriber")
    } finally {
      setIsLoading(false)
    }
  }

  const deleteSubscriber = async (id: number) => {
    if (!confirm("Delete this subscriber?")) return
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/subscribers/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to delete subscriber")
      await load()
    } catch (e: any) {
      setError(e?.message || "Failed to delete subscriber")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Subscribers</h1>
          <p className="text-muted-foreground mt-1">Manage newsletter subscribers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addSubscriber} disabled={isLoading}>
            Add Subscriber
          </Button>
          <Button className="flex items-center gap-2" disabled>
            <Mail size={18} />
            Send Newsletter
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-border bg-muted p-4 text-sm text-destructive">{error}</div> : null}

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subscribers..." className="pl-10" />
        </div>
        <div className="w-48">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="subscribed">Subscribed</SelectItem>
              <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="flex items-center gap-2" onClick={exportCsv}>
          <Download size={18} />
          Export
        </Button>
      </div>

      <div className="admin-panel-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="admin-panel-table-header-cell">Email</th>
                <th className="admin-panel-table-header-cell">Status</th>
                <th className="admin-panel-table-header-cell">Joined Date</th>
                <th className="admin-panel-table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="admin-panel-table-cell" colSpan={4}>Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="admin-panel-table-cell" colSpan={4}>No subscribers found.</td>
                </tr>
              ) : (
                rows.map((sub) => (
                  <tr key={sub.id} className="admin-panel-table-row">
                    <td className="admin-panel-table-cell">{sub.email}</td>
                    <td className="admin-panel-table-cell">
                      <button
                        className={`admin-panel-badge ${
                          String(sub.status).toLowerCase() === "subscribed" ? "admin-panel-badge-success" : "admin-panel-badge-warning"
                        }`}
                        onClick={() => toggleStatus(sub)}
                        disabled={isLoading}
                      >
                        {sub.status}
                      </button>
                    </td>
                    <td className="admin-panel-table-cell">{sub.created_at ? String(sub.created_at).slice(0, 10) : ""}</td>
                    <td className="admin-panel-table-cell">
                      <button className="p-2 hover:bg-muted rounded-md transition-colors" onClick={() => deleteSubscriber(sub.id)} disabled={isLoading}>
                        <Trash2 size={16} className="text-red-500" />
                      </button>
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
