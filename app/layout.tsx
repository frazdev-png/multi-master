import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { RealtimeProvider } from "@/contexts/RealtimeContext"
import { DynamicFavicon } from "@/components/dynamic-favicon"
import { Heartbeat } from "@/components/heartbeat"
import { ChatSupport } from "@/components/chat/chat-support"
import { ToastContainer } from "@/components/ui/toast"

const inter = Inter({ subsets: ["latin"] })

export const viewport = {
  themeColor: "#2563eb",
  userScalable: "no",
}

async function getInitialSettings() {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/settings", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    if (data?.success && data?.data) {
      return data.data
    }
  } catch {}
  return null
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getInitialSettings()
  const faviconUrl = settings?.favicon_url || "/icon.svg"

  return {
    title: "Sell1Mall - Multi-Vendor Marketplace",
    description: "Multi-vendor e-commerce platform for vendors and customers",
    icons: {
      icon: faviconUrl,
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const initialSettings = await getInitialSettings()

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <RealtimeProvider initialSettings={initialSettings}>
            {children}
            <Heartbeat />
            <DynamicFavicon />
            <ChatSupport />
            <ToastContainer />
          </RealtimeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
