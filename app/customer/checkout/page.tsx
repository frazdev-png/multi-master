"use client"

import { CustomerNavbar } from "@/components/customer/navbar"
import { Truck, Wallet, AlertCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { useRouter } from "next/navigation"
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

type CartItem = {
  product_id: number
  quantity: number
  name?: string
  price?: number | string
  image_url?: string
  seller_id?: number | string
  seller_name?: string
  seller_email?: string
  store_name?: string
}

export default function CheckoutPage() {
  const { settings } = useRealtime()
  const router = useRouter()
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "online">("online")
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPlacing, setIsPlacing] = useState(false)
  const [error, setError] = useState<string>("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")

  const loadCart = async () => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/cart")
      if (res.status === 401 || res.status === 403) {
        router.push("/auth/login?role=customer")
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load cart")
      }
      const items = Array.isArray(data?.items) ? data.items : []
      setCartItems(items)
    } catch (e: any) {
      setError(e?.message || "Failed to load cart")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCart()
  }, [])

  const sellerGroups = useMemo(() => {
    const groups: { sellerId: number; sellerName: string; sellerEmail: string; storeName: string; items: CartItem[] }[] = []
    const map = new Map<number, typeof groups[0]>()
    for (const item of cartItems) {
      const sid = Number(item.seller_id || 0)
      if (sid <= 0) continue
      if (!map.has(sid)) {
        map.set(sid, { sellerId: sid, sellerName: item.seller_name || "", sellerEmail: item.seller_email || "", storeName: item.store_name || "", items: [] })
        groups.push(map.get(sid)!)
      }
      map.get(sid)!.items.push(item)
    }
    return groups
  }, [cartItems])

  const { itemCount, subtotal, tax, shipping, total } = useMemo(() => {
    const count = cartItems.reduce((sum, item) => sum + (Number(item.quantity || 0) || 0), 0)
    const sub = cartItems.reduce(
      (sum, item) => sum + (Number(item.price || 0) || 0) * (Number(item.quantity || 0) || 0),
      0,
    )
    const t = Math.round(sub * 0.18)
    const ship = cartItems.length > 0 ? 99 : 0
    return { itemCount: count, subtotal: sub, tax: t, shipping: ship, total: sub + t + ship }
  }, [cartItems])

  const placeOrder = async () => {
    if (isPlacing) return
    if (cartItems.length === 0) {
      router.push("/customer/cart")
      return
    }

    if (!fullName.trim() || !phone.trim() || !address.trim() || !city.trim()) {
      setError("Please fill shipping address fields")
      return
    }

    const shippingAddress = [
      fullName.trim(),
      phone.trim(),
      address.trim(),
      city.trim(),
      postalCode.trim(),
    ]
      .filter(Boolean)
      .join(", ")

    const items = cartItems.map((it) => ({
      product_id: Number(it.product_id),
      quantity: Number(it.quantity || 0),
      price: Number(it.price || 0),
      seller_id: Number(it.seller_id || 0),
    }))

    if (items.some((it) => !it.product_id || !it.quantity || !it.seller_id)) {
      setError("Cart items are missing required data. Please refresh the page.")
      return
    }

    try {
      setIsPlacing(true)
      setError("")
      const res = await fetch("/api/backend/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          shipping_address: shippingAddress,
          payment_method: paymentMethod,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push("/auth/login?role=customer")
          return
        }
        throw new Error(data?.error || "Failed to place order")
      }

      window.dispatchEvent(new Event("cart:updated"))
      const ids = Array.isArray(data?.order_ids) ? data.order_ids.join(",") : ""
      router.push(`/customer/order-placed${ids ? `?ids=${encodeURIComponent(ids)}` : ""}`)
    } catch (e: any) {
      setError(e?.message || "Failed to place order")
    } finally {
      setIsPlacing(false)
    }
  }

  return (
    <>
      <CustomerNavbar />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Checkout</h1>
          <p className="text-muted-foreground">Complete your purchase</p>
        </div>

        {error ? (
          <div className="mb-6 rounded-lg border border-border bg-muted p-4 text-sm text-destructive">{error}</div>
        ) : null}

        {/* Seller Info */}
        {sellerGroups.length > 0 && (
          <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
            <p className="text-sm font-medium text-muted-foreground mb-2">Your order will be fulfilled by:</p>
            <div className="flex flex-wrap gap-3">
              {sellerGroups.map((g) => (
                <span key={g.sellerId} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {g.storeName || g.sellerName || `Seller #${g.sellerId}`}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Address */}
            <div className="card">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Truck size={24} className="text-primary" />
                Shipping Address
              </h2>

              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <input type="text" placeholder="Full Name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <input type="text" placeholder="Phone Number" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <input type="text" placeholder="Address" className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="City" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
                  <input type="text" placeholder="Postal Code" className="input" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </div>
                <button type="button" className="btn-secondary w-full">
                  Use Saved Address
                </button>
              </form>
            </div>

            {/* Delivery Options */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Delivery Options</h2>
              <div className="space-y-3">
                <label className="flex items-center p-4 border border-primary rounded-lg cursor-pointer bg-primary/5">
                  <input type="radio" name="delivery" defaultChecked className="w-4 h-4" />
                  <div className="ml-4">
                    <p className="font-semibold">Standard Delivery</p>
                    <p className="text-sm text-muted-foreground">3-5 business days • {formatCurrency(99)}</p>
                  </div>
                </label>
                <label className="flex items-center p-4 border border-border rounded-lg cursor-pointer hover:border-primary">
                  <input type="radio" name="delivery" className="w-4 h-4" />
                  <div className="ml-4">
                    <p className="font-semibold">Express Delivery</p>
                    <p className="text-sm text-muted-foreground">1-2 business days • {formatCurrency(499)}</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Payment Method */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Payment Method</h2>
              <div className="space-y-3">
                <label
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                    paymentMethod === "online" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="online"
                    checked={paymentMethod === "online"}
                    onChange={(e) => setPaymentMethod(e.target.value as "online" | "wallet")}
                    className="w-4 h-4"
                  />
                  <div className="ml-4">
                    <p className="font-semibold">Online Payment</p>
                    <p className="text-sm text-muted-foreground">Credit/Debit Card, UPI, etc.</p>
                  </div>
                </label>
                <label
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                    paymentMethod === "wallet" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="wallet"
                    checked={paymentMethod === "wallet"}
                    onChange={(e) => setPaymentMethod(e.target.value as "online" | "wallet")}
                    className="w-4 h-4"
                  />
                  <div className="ml-4 flex-1">
                    <p className="font-semibold flex items-center gap-2">
                      <Wallet size={16} />
                      Wallet
                    </p>
                    <p className="text-sm text-muted-foreground">Available Balance: {formatCurrency(2500)}</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <div className="card sticky top-20">
              <h3 className="text-lg font-bold mb-6">Order Summary</h3>

              {sellerGroups.length > 0 ? (
                <div className="space-y-5 mb-6">
                  {sellerGroups.map((group) => (
                    <div key={group.sellerId}>
                      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-border">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                          {group.storeName || group.sellerName || `Seller #${group.sellerId}`}
                        </p>
                      </div>
                      {group.items.map((item) => (
                        <div key={item.product_id} className="flex items-center gap-3 py-1.5">
                          <img
                            src={resolvePublicImageUrl(item.image_url) || "/placeholder.svg"}
                            alt={item.name || "Product"}
                            className="w-10 h-10 rounded-md object-cover bg-muted flex-shrink-0"
                            onError={(e) => {
                              const el = e.currentTarget
                              if (el.src.endsWith("/placeholder.svg")) return
                              el.src = "/placeholder.svg"
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.name || "Product"}</div>
                            <div className="text-xs text-muted-foreground">Qty: {Number(item.quantity || 0)}</div>
                          </div>
                          <div className="text-sm font-medium flex-shrink-0">{formatCurrency((Number(item.price || 0) || 0) * (Number(item.quantity || 0) || 0))}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-3 pb-6 border-b border-border">
                <div className="flex justify-between text-sm">
                  <span>{isLoading ? "Loading..." : `${itemCount} item(s)`}</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span>{formatCurrency(shipping)}</span>
                </div>
              </div>

              <div className="flex justify-between mt-6 mb-6">
                <span className="font-bold">Total</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
              </div>

              {paymentMethod === "wallet" && (
                <div className="mb-6 p-3 bg-warning/10 rounded-lg flex gap-2">
                  <AlertCircle size={16} className="text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-warning">Wallet balance is insufficient. Please choose online payment.</p>
                </div>
              )}

              <button
                className="w-full btn-primary"
                type="button"
                disabled={isLoading || isPlacing || cartItems.length === 0}
                onClick={placeOrder}
              >
                {isPlacing ? "Placing Order..." : "Place Order"}
              </button>

              <div className="mt-4 p-4 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-2">Your order is secure & encrypted</p>
                <p className="text-xs font-medium text-foreground">{settings.website_name || "Sell1Mall"}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
