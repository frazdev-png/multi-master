"use client"

import { CustomerNavbar } from "@/components/customer/navbar"
import { Heart, ShoppingCart, Trash2, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { formatCurrency } from "@/lib/utils"
import { notify } from "@/components/ui/toast"

export default function WishlistPage() {
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchWishlist = async () => {
    try {
      setError("")
      const res = await fetch("/api/backend/wishlist")
      const data = await res.json()
      if (data.success) setItems(data.items || [])
      else setError(data.error || "Failed to load wishlist")
    } catch { setError("Failed to load wishlist") }
    setLoading(false)
  }

  useEffect(() => { fetchWishlist() }, [])

  const removeFromWishlist = async (productId: number) => {
    try {
      const res = await fetch(`/api/backend/wishlist/${productId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        fetchWishlist()
        window.dispatchEvent(new Event("wishlist:updated"))
        notify("Removed from wishlist")
      }
    } catch {}
  }

  const addToCart = async (productId: number) => {
    try {
      await fetch("/api/backend/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity: 1 }),
      })
      router.push("/customer/cart")
    } catch {}
  }

  return (
    <>
      <CustomerNavbar />
      <main className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-lg text-red-600 mb-4">{error}</p>
            <button onClick={fetchWishlist} className="admin-panel-btn-primary">Retry</button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Heart size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg text-muted-foreground mb-4">Your wishlist is empty</p>
            <button onClick={() => router.push("/shop")} className="admin-panel-btn-primary">Browse Products</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div key={item.product_id} className="card overflow-hidden">
                <div className="relative h-48 bg-muted">
                  {item.image_url ? (
                    <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">No image</div>
                  )}
                </div>
                <div className="p-4 space-y-4">
                  <h3 className="font-semibold text-lg truncate">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.seller_name}</p>
                  <p className="text-xl font-bold">{formatCurrency(Number(item.price))}</p>
                  <div className="flex gap-2">
                    <button onClick={() => addToCart(item.product_id)} className="admin-panel-btn-primary flex-1 flex items-center justify-center gap-2">
                      <ShoppingCart size={16} /> Add to Cart
                    </button>
                    <button onClick={() => removeFromWishlist(item.product_id)} className="p-2 hover:bg-muted rounded-md">
                      <Trash2 size={18} className="text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
