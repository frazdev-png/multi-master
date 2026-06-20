"use client"

import { useEffect, useState } from "react"
import { AdminPanelSidebar } from "@/components/admin-panel/sidebar"
import { AdminPanelHeader } from "@/components/admin-panel/header"

import AdminMiddlewareCheck from "./middleware-check"
import "@/styles/admin-panel.css"

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    // Set initial state
    handleResize()

    // Add event listener
    window.addEventListener('resize', handleResize)
    window.addEventListener('toggleSidebar', () => setSidebarOpen(prev => !prev))
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('toggleSidebar', () => {})
    }
  }, [])

  return (
      <div className="flex h-screen bg-background">
        <AdminMiddlewareCheck />
        <AdminPanelSidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminPanelHeader />
          
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/20">
            {children}
          </main>
        </div>
      </div>
  )
}
