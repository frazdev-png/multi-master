"use client"

import Link from "next/link"
import { ShoppingCart, Search, User, Heart, Menu, X, MessageCircle, LogOut } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useRealtime } from "@/contexts/RealtimeContext"

function resolvePublicImageUrl(src: string | undefined) {
  const raw = String(src || "").trim()
  if (!raw) return ""

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      if (u.pathname.startsWith("/uploads/")) return u.pathname
      if (u.pathname.startsWith("/api/uploads/")) return u.pathname.replace("/api/uploads/", "/uploads/")
    } catch {
    }
    return raw
  }

  if (raw.startsWith("//")) return `https:${raw}`
  if (raw.startsWith("/api/uploads/")) return raw.replace("/api/uploads/", "/uploads/")
  if (raw.startsWith("api/uploads/")) return `/${raw.replace("api/uploads/", "uploads/")}`
  if (raw.startsWith("uploads/")) return `/${raw}`
  if (raw.startsWith("/uploads/")) return raw

  return raw
}

export function CustomerNavbar() {
  const { settings } = useRealtime()
  const pathname = usePathname()
  const router = useRouter()
  const isHome = pathname === "/"
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cartCount, setCartCount] = useState<number>(0)

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
    }
    router.push("/auth/login")
    router.refresh()
  }

  const loadCartCount = async () => {
    try {
      const res = await fetch("/api/backend/cart")
      if (res.status === 401 || res.status === 403) {
        setCartCount(0)
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setCartCount(0)
        return
      }
      const items = Array.isArray(data?.items) ? data.items : []
      const count = items.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0)
      setCartCount(count)
    } catch {
      setCartCount(0)
    }
  }

  useEffect(() => {
    loadCartCount()
    const handler = () => {
      loadCartCount()
    }
    window.addEventListener("cart:updated", handler)
    return () => window.removeEventListener("cart:updated", handler)
  }, [])

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Link href="/" className="inline-flex items-center gap-2 text-xl sm:text-2xl font-bold text-primary truncate">
              <img
                src={resolvePublicImageUrl(settings.logo_url) || "/sell1mall-logo.png"}
                alt={settings.website_name || "Sell1Mall"}
                className="w-64 object-contain"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).src = "/placeholder.svg"
                }}
              />
            </Link>
          </div>

          <div className="hidden md:flex flex-1 mx-8 min-w-0">
            <div className="relative w-full">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                size={18}
              />
              <input type="text" placeholder="Search products..." className="input pl-10 w-full" />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/customer/wishlist"
              className="relative text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Wishlist"
            >
              <Heart size={20} />
            </Link>

            <Link
              href="/messaging"
              className="relative text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Chat"
              title="Chat"
            >
              <MessageCircle size={20} />
            </Link>

            <Link
              href="/customer/cart"
              className="relative text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 ? (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-danger text-white rounded-full text-xs flex items-center justify-center">
                  {cartCount}
                </span>
              ) : null}
            </Link>

            <Link
              href="/customer"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Account"
            >
              <User size={20} className="text-muted-foreground" />
              <span className="hidden sm:inline font-medium">Account</span>
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline font-medium">Logout</span>
            </button>
          </div>
        </div>

        <div className="md:hidden pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
            <input type="text" placeholder="Search products..." className="input pl-10 w-full" />
          </div>
        </div>

        <div
          className={`md:hidden overflow-hidden transition-all duration-200 ${
            mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="border-t border-border pt-4 pb-6">
            <div className="flex flex-col gap-1">
              <Link
                href="/shop"
                className="px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Shop
              </Link>
              <Link
                href="/customer/orders"
                className="px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Orders
              </Link>
              <Link
                href="/messaging"
                className="px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Chat
              </Link>
              <Link
                href="/customer/cart"
                className="px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Cart
              </Link>
              <Link
                href="/customer"
                className="px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Account
              </Link>
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout() }}
                className="px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-muted-foreground hover:text-foreground"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
