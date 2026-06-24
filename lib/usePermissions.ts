"use client"

import { useEffect, useState } from "react"

const permissionCache: { [key: string]: string[] } = {}
const loadedCache: { [key: string]: boolean } = {}

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>(() => permissionCache["admin_permissions"] || [])
  const [loaded, setLoaded] = useState<boolean>(() => loadedCache["admin_permissions"] || false)

  useEffect(() => {
    const cacheKey = "admin_permissions"
    if (permissionCache[cacheKey]) {
      setPermissions(permissionCache[cacheKey])
      setLoaded(true)
      return
    }

    fetch("/api/backend/admin/permissions/user")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          permissionCache[cacheKey] = data.permissions
          setPermissions(data.permissions)
        } else {
          setPermissions([])
        }
        loadedCache[cacheKey] = true
        setLoaded(true)
      })
      .catch(() => {
        setPermissions([])
        loadedCache[cacheKey] = true
        setLoaded(true)
      })
  }, [])

  return { permissions, loaded, hasPermission: (slug: string) => permissions.includes(slug) }
}
