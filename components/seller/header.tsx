"use client"

import { Bell, User, Menu, X } from "lucide-react"
import { useState } from "react"
import { useRealtime } from "@/contexts/RealtimeContext"

interface SellerHeaderProps {
  onMobileMenuToggle: () => void
  isMobileMenuOpen: boolean
}

export function SellerHeader({ onMobileMenuToggle, isMobileMenuOpen }: SellerHeaderProps) {
  const { settings } = useRealtime()
  return (
    <header className="bg-card border-b border-border h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle */}
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-muted transition-colors"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        
        <div>
          <h2 className="text-lg font-semibold text-foreground truncate">Welcome to {settings.website_name || "Sell1Mall"}</h2>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <button className="relative text-muted-foreground hover:text-foreground transition-colors">
          <Bell size={20} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-warning rounded-full"></span>
        </button>

        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors">
          <User size={20} className="text-muted-foreground" />
          <span className="text-sm font-medium hidden sm:inline">Seller</span>
        </button>
      </div>
    </header>
  )
}
