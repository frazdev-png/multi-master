"use client"

import { Trash2, RotateCw } from "lucide-react"
import { useEffect, useState } from "react"

export default function CacheManagement() {
  const [clearing, setClearing] = useState(false)

  const [cacheItems, setCacheItems] = useState<Array<{ name: string; description: string; last_cleared_at?: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const defaultCacheItems = () => [
    { name: "Page Cache", description: "Cached page content" },
    { name: "Product Cache", description: "Product listings and details" },
    { name: "Image Cache", description: "Optimized product images" },
    { name: "Database Cache", description: "Query results" },
  ]

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setIsLoading(true)
        setError("")
        setSuccess("")
        const res = await fetch("/api/settings")
        const data = await res.json().catch(() => null)
        if (!data?.success) {
          throw new Error(data?.message || "Failed to load settings")
        }
        const cs = data?.data?.cache_settings || {}
        const list = Array.isArray(cs.cacheItems) ? cs.cacheItems : []
        if (!cancelled) setCacheItems(list)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load settings")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const touchClear = async (name: string) => {
    try {
      setError("")
      setSuccess("")
      const now = new Date().toISOString()
      const base = cacheItems.length ? cacheItems : defaultCacheItems()
      const next = base.map((it) => (it.name === name ? { ...it, last_cleared_at: now } : it))
      setCacheItems(next)
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cache_settings: { cacheItems: next },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!data?.success) {
        throw new Error(data?.message || "Failed to update settings")
      }
      setSuccess("Updated")
    } catch (e: any) {
      setError(e?.message || "Failed")
    }
  }

  const effectiveItems = cacheItems.length ? cacheItems : defaultCacheItems()

  const clearAll = async () => {
    try {
      setClearing(true)
      setError("")
      setSuccess("")
      const now = new Date().toISOString()
      const next = effectiveItems.map((it) => ({ ...it, last_cleared_at: now }))
      setCacheItems(next)

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cache_settings: { cacheItems: next },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!data?.success) {
        throw new Error(data?.message || "Failed")
      }
      setSuccess("Updated")
    } catch (e: any) {
      setError(e?.message || "Failed")
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Clear Cache</h1>
        <p className="text-muted-foreground mt-1">Improve performance by managing system cache</p>
      </div>

      {isLoading ? <div className="text-muted-foreground">Loading...</div> : null}
      {error ? <div className="rounded-lg border border-border bg-muted p-4 text-sm text-destructive">{error}</div> : null}
      {success ? <div className="rounded-lg border border-border bg-muted p-4 text-sm">{success}</div> : null}

      {/* Cache Items */}
      <div className="space-y-4">
        {effectiveItems.map((item) => (
          <div key={item.name} className="admin-panel-table p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold">{item.name}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Last cleared: {item.last_cleared_at ? new Date(item.last_cleared_at).toLocaleString() : "—"}
              </p>
            </div>
            <button
              className="admin-panel-btn-danger flex items-center gap-2"
              onClick={() => touchClear(item.name)}
              disabled={isLoading}
            >
              <Trash2 size={18} />
              Clear
            </button>
          </div>
        ))}
      </div>

      {/* Clear All */}
      <div className="admin-panel-table p-6 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-200 dark:border-orange-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Clear All Cache</h3>
            <p className="text-sm text-muted-foreground">This will clear all cached data. Use cautiously.</p>
          </div>
          <button className="admin-panel-btn-danger flex items-center gap-2" onClick={clearAll} disabled={clearing || isLoading}>
            {clearing ? (
              <>
                <RotateCw size={18} className="animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 size={18} />
                Clear All
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
