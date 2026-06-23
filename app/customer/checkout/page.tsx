"use client"

import { CustomerNavbar } from "@/components/customer/navbar"
import { Truck, Wallet, AlertCircle, Store, ChevronDown } from "lucide-react"
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

type SellerOption = {
  seller_id: number
  seller_name: string
  seller_email: string
  store_name: string
}

type CartItem = {
  product_id: number
  quantity: number
  name?: string
  price?: number | string
  image_url?: string
}

export default function CheckoutPage() {
  const { settings } = useRealtime()
  const router = useRouter()
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "online">("online")
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [allSellers, setAllSellers] = useState<SellerOption[]>([])
  const [selectedSellerId, setSelectedSellerId] = useState<number>(0)
  const [sellerDropdownOpen, setSellerDropdownOpen] = useState(false)
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
      const sellers = Array.isArray(data?.all_sellers) ? data.all_sellers : []
      setCartItems(items)
      setAllSellers(sellers)
      // Default to first seller if none selected
      if (sellers.length > 0 && (selectedSellerId === 0 || !sellers.find(s => s.seller_id === selectedSellerId))) {
        setSelectedSellerId(sellers[0].seller_id)
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load cart")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCart()
  }, [])

  const selectedSeller = useMemo(() => {
    return allSellers.find((s) => s.seller_id === selectedSellerId) || null
  }, [allSellers, selectedSellerId])

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

    if (!selectedSeller) {
      setError("Please select a seller for your order")
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
    }))

    if (items.some((it) => !it.product_id || !it.quantity)) {
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
          seller_id: selectedSeller.seller_id,
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

        {/* No sellers available warning */}
        {!isLoading && allSellers.length === 0 && (
          <div className="mb-6 p-4 border border-destructive/50 rounded-lg bg-destructive/5">
            <p className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertCircle size={14} />
              No sellers are currently available
            </p>
            <p className="text-xs text-destructive/70 mt-1">
              Please try again later or contact support.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Seller Selection */}
            {allSellers.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Store size={24} className="text-primary" />
                  Select Seller
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose which seller will fulfill your entire order.
                </p>

                {/* Dropdown trigger */}
                <button
                  type="button"
                  onClick={() => setSellerDropdownOpen(!sellerDropdownOpen)}
                  className="w-full flex items-center justify-between p-4 border border-border rounded-lg bg-background hover:border-primary transition-colors cursor-pointer"
                >
                  {selectedSeller ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Store size={18} className="text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm">{selectedSeller.store_name}</p>
                        <p className="text-xs text-muted-foreground">{selectedSeller.seller_name}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Select a seller...</span>
                  )}
                  <ChevronDown
                    size={18}
                    className={`text-muted-foreground transition-transform ${sellerDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Dropdown list */}
                {sellerDropdownOpen && (
                  <div className="mt-1 border border-border rounded-lg bg-background shadow-lg overflow-hidden">
                    {allSellers.map((seller) => (
                      <button
                        key={seller.seller_id}
                        type="button"
                        onClick={() => {
                          setSelectedSellerId(seller.seller_id)
                          setSellerDropdownOpen(false)
                        }}
                        className={`w-full flex items-center gap-3 p-4 text-left hover:bg-muted transition-colors cursor-pointer border-b border-border last:border-b-0 ${
                          selectedSellerId === seller.seller_id ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          selectedSellerId === seller.seller_id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          <Store size={18} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{seller.store_name}</p>
                            {selectedSellerId === seller.seller_id && (
                              <span className="text-xs text-primary font-medium">Selected</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{seller.seller_name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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

              {/* Selected seller info */}
              {selectedSeller && (
                <div className="flex items-center gap-3 mb-6 p-3 border border-border rounded-lg bg-muted/30">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Store size={16} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide text-[10px]">Fulfilled by</p>
                    <p className="text-sm font-semibold">{selectedSeller.store_name}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3 mb-6">
                {cartItems.map((item) => (
                  <div key={item.product_id} className="flex items-start gap-3 py-1.5">
                    <img
                      src={resolvePublicImageUrl(item.image_url) || "/placeholder.svg"}
                      alt={item.name || "Product"}
                      className="w-10 h-10 rounded-md object-cover bg-muted flex-shrink-0 mt-0.5"
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
                disabled={isLoading || isPlacing || cartItems.length === 0 || !selectedSeller}
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
