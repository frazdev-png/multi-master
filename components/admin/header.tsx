"use client"

import { useState, useEffect } from "react"
import { Bell, User, Search, Menu } from "lucide-react"

export function AdminHeader() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkIfMobile()
    window.addEventListener('resize', checkIfMobile)
    
    return () => window.removeEventListener('resize', checkIfMobile)
  }, [])

  const toggleSearch = () => {
    setSearchOpen(!searchOpen)
  }

  return (
    <header className="bg-card border-b border-border min-h-16 flex flex-col md:flex-row items-stretch md:items-center justify-between px-4 md:px-6 py-2">
      {/* Top bar with search and actions */}
      <div className="flex items-center justify-between w-full md:w-auto">
        {/* Search bar - hidden on mobile when not active */}
        <div className={`${searchOpen ? 'block' : 'hidden'} md:block w-full md:w-80 lg:w-96 transition-all duration-300`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Search users, orders, products..." 
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              onBlur={() => isMobile && setSearchOpen(false)}
              autoFocus={searchOpen}
            />
            {isMobile && searchOpen && (
              <button 
                onClick={() => setSearchOpen(false)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Search button for mobile */}
        {!searchOpen && (
          <button 
            onClick={toggleSearch}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
        )}

        {/* User actions */}
        <div className="flex items-center gap-4 md:gap-6 ml-auto md:ml-4">
          <button 
            className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Notifications"
          >
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full"></span>
          </button>

          <button 
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="User profile"
          >
            <User size={20} className="text-muted-foreground" />
            <span className="text-sm font-medium">Admin</span>
          </button>
        </div>
      </div>

      {/* Mobile user profile - shown only on mobile */}
      <div className="md:hidden mt-2 pt-2 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <User size={16} />
          </div>
          <div>
            <p className="text-sm font-medium">Admin</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        </div>
      </div>
    </header>
  )
}
