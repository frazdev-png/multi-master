"use client"

import { Heart, Star } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { notify } from "@/components/ui/toast"

function resolvePublicImageUrl(src: string) {
  const value = (src || "").trim()
  if (!value) return "/placeholder.svg"
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value)
      if (u.pathname.startsWith("/uploads/")) return u.pathname
      if (u.pathname.startsWith("/api/uploads/")) return u.pathname.replace("/api/uploads/", "/uploads/")
    } catch {
    }
    return value
  }
  if (value.startsWith("//")) return `https:${value}`

  if (value.startsWith("/api/uploads/")) return value.replace("/api/uploads/", "/uploads/")
  if (value.startsWith("api/uploads/")) return `/${value.replace("api/uploads/", "uploads/")}`

  if (value.startsWith("uploads/")) return `/${value}`

  if (value.startsWith("/uploads/")) {
    return value
  }

  return value
}

export interface ProductCardProps {
  id: string
  name: string
  price: number
  originalPrice?: number
  image: string
  rating: number
  reviews: number
  seller: string
  stock: number
}

export function ProductCard({ id, name, price, originalPrice, image, rating, reviews, seller, stock }: ProductCardProps) {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [inWishlist, setInWishlist] = useState(false)
  const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0

  const resolvedImage = resolvePublicImageUrl(image)

  const toggleWishlist = async () => {
    try {
      if (inWishlist) {
        const res = await fetch(`/api/backend/wishlist/${id}`, { method: "DELETE" })
        if (!res.ok && res.status !== 401 && res.status !== 403) return
        setInWishlist(false)
        window.dispatchEvent(new Event("wishlist:updated"))
        notify("Removed from wishlist")
      } else {
        const res = await fetch("/api/backend/wishlist/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: Number(id) }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            router.push("/auth/login?role=customer")
            return
          }
          throw new Error(data?.error || "Failed to add to wishlist")
        }
        setInWishlist(true)
        window.dispatchEvent(new Event("wishlist:updated"))
        notify("Added to wishlist!")
      }
    } catch (e: any) {
      notify(e?.message || "Something went wrong", "error")
    }
  }

  const addToCart = async () => {
    if (isAdding) return
    if (stock <= 0) return

    try {
      setIsAdding(true)
      const res = await fetch("/api/backend/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product_id: Number(id), quantity: 1 }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push("/auth/login?role=customer")
          return
        }
        throw new Error(data?.error || "Failed to add to cart")
      }

      window.dispatchEvent(new Event("cart:updated"))
      notify("Added to cart!")
    } catch (e: any) {
      notify(e?.message || "Failed to add to cart", "error")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="relative mb-4 overflow-hidden rounded-lg bg-muted h-48">
        <img
          src={resolvedImage}
          alt={name}
          className="w-full h-full object-cover hover:scale-105 transition-transform"
          onError={(e) => {
            const el = e.currentTarget
            if (el.src.endsWith("/placeholder.svg")) return
            el.src = "/placeholder.svg"
          }}
        />
        {discount > 0 && (
          <div className="absolute top-2 right-2 bg-danger text-white px-2 py-1 rounded text-sm font-bold">
            -{discount}%
          </div>
        )}
        <button
          type="button"
          className="absolute top-2 left-2 p-2 bg-white rounded-full hover:bg-muted transition-colors"
          onClick={toggleWishlist}
        >
          <Heart size={18} className={inWishlist ? "fill-danger text-danger" : ""} />
        </button>
      </div>

      <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{name}</h3>

      <div className="flex items-center gap-1 mb-2">
        <div className="flex">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={14} className={i < Math.floor(rating) ? "fill-warning text-warning" : "text-border"} />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">({reviews})</span>
      </div>

      {seller ? <p className="text-xs text-muted-foreground mb-3">by {seller}</p> : null}

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-xl font-bold text-foreground">{formatCurrency(price)}</span>
        {originalPrice && <span className="text-sm text-muted-foreground line-through">{formatCurrency(originalPrice)}</span>}
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${stock > 10 ? "text-success" : "text-warning"}`}>
          {stock > 0 ? `${stock} in stock` : "Out of stock"}
        </span>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={stock <= 0 || isAdding}
          onClick={addToCart}
        >
          {isAdding ? "Adding..." : "Add to Cart"}
        </button>
      </div>
    </div>
  )
}
