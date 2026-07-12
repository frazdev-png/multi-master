"use client"

import { useEffect, useRef } from "react"
import { useRealtime } from "@/contexts/RealtimeContext"

const DEFAULT_ICONS = [
  { rel: "icon", url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
  { rel: "icon", url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
  { rel: "icon", url: "/icon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", url: "/apple-icon.png" },
]

export function DynamicFavicon() {
  const { settings } = useRealtime()
  const injectedRef = useRef(false)

  useEffect(() => {
    const url = settings.favicon_url

    const existing = document.querySelectorAll<HTMLLinkElement>("link[rel~='icon'], link[rel='apple-touch-icon']")
    existing.forEach((el) => el.remove())

    injectedRef.current = false

    if (url) {
      const link = document.createElement("link")
      link.rel = "icon"
      link.href = url
      document.head.appendChild(link)
    } else {
      DEFAULT_ICONS.forEach(({ rel, url, media, type }) => {
        const link = document.createElement("link")
        link.rel = rel
        link.href = url
        if (media) link.media = media
        if (type) link.type = type
        document.head.appendChild(link)
      })
    }
  }, [settings.favicon_url])

  return null
}
