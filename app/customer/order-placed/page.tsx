"use client"

import Link from "next/link"
import { Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { CustomerNavbar } from "@/components/customer/navbar"

function OrderPlacedContent() {
  const searchParams = useSearchParams()

  const orderIds = useMemo(() => {
    const idsParam = searchParams.get("ids") || ""
    if (!idsParam) return [] as string[]
    return idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }, [searchParams])

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="card">
        <h1 className="text-3xl font-bold mb-2">Order placed successfully</h1>
        <p className="text-muted-foreground mb-6">Thank you for your purchase. Your order has been confirmed.</p>

        {orderIds.length > 0 ? (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-2">Order ID{orderIds.length > 1 ? "s" : ""}</p>
            <div className="flex flex-wrap gap-2">
              {orderIds.map((id) => (
                <span key={id} className="px-3 py-1 rounded-full bg-muted text-sm font-medium">
                  #{id}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/customer/orders" className="btn-primary text-center">
            View Orders
          </Link>
          <Link href="/shop" className="btn-secondary text-center">
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function OrderPlacedPage() {
  return (
    <>
      <CustomerNavbar />
      <Suspense>
        <OrderPlacedContent />
      </Suspense>
    </>
  )
}
