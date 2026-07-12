"use client"

import { useEffect, useRef } from "react"
import { useRealtime } from "@/contexts/RealtimeContext"

const DEFAULT_ICONS = [
  { rel: "icon", url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
  { rel: "icon", url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
  { rel: "icon", url: "/icon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", url: "/apple-icon.png" },
]

function addFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (!link) {
    link = document.createElement("link")
    link.rel = "icon"
    document.head.appendChild(link)
  }
  link.href = href
}

export function DynamicFavicon() {
  const { settings } = useRealtime()
  const prevUrl = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const url = settings.favicon_url
    if (url === prevUrl.current) return
    prevUrl.current = url

    if (url) {
      addFavicon(url + "?v=" + Date.now())
    } else {
      const existing = document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']")
      existing.forEach((el) => el.remove())
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
