"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface WebsiteSettings {
  website_name: string
  tagline: string
  logo_url: string | null
  favicon_url: string | null
  homepage_settings?: any
  currency: string
  timezone: string
  email: string
  phone: string
  address: string
  refund_policy: string
  return_policy: string
  terms_conditions: string
}

interface RealtimeContextType {
  settings: WebsiteSettings
  updateSettings: (newSettings: Partial<WebsiteSettings>) => Promise<void>
  isConnected: boolean
}

const defaultSettings: WebsiteSettings = {
  website_name: "Sell1Mall",
  tagline: "Your Premier Multi-Vendor Marketplace",
  logo_url: null,
  favicon_url: null,
  homepage_settings: {},
  currency: "USDT",
  timezone: "UTC",
  email: "admin@sell1mall.com",
  phone: "+1 234 567 8900",
  address: "123 Business Street, City, Country",
  refund_policy: "",
  return_policy: "",
  terms_conditions: ""
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

export const useRealtime = () => {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context
}

interface RealtimeProviderProps {
  children: ReactNode
  initialSettings?: WebsiteSettings | null
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({ children, initialSettings }) => {
  const [settings, setSettings] = useState<WebsiteSettings>(initialSettings || defaultSettings)
  const [isConnected, setIsConnected] = useState(!!initialSettings)

  useEffect(() => {
    if (initialSettings) return

    let isMounted = true

    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        const data = await res.json().catch(() => null)

        if (!res.ok || !data?.success || !data?.data) {
          if (isMounted) setIsConnected(false)
          return
        }

        if (isMounted) {
          setSettings((prev) => ({
            ...prev,
            ...data.data,
          }))
          setIsConnected(true)
        }
      } catch {
        if (isMounted) setIsConnected(false)
      }
    }

    loadSettings()
    return () => {
      isMounted = false
    }
  }, [initialSettings])

  const updateSettings = async (newSettings: Partial<WebsiteSettings>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.success) {
        setIsConnected(false)
        return
      }

      if (data?.data) {
        setSettings((prev) => ({
          ...prev,
          ...data.data,
        }))
      }
      setIsConnected(true)
    } catch {
      setIsConnected(false)
    }
  }

  const value: RealtimeContextType = {
    settings,
    updateSettings,
    isConnected
  }

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}
