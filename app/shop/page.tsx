
"use client"

import { CustomerNavbar } from "@/components/customer/navbar"
import { ProductCard } from "@/components/customer/product-card"
import { Input } from "@/components/ui/input"
import { useEffect, useMemo, useState } from "react"

type ApiProduct = {
  id: number | string
  seller_product_id?: number | string
  name?: string
  price?: number | string
  original_price?: number | string
  image_url?: string
  avg_rating?: number | string
  review_count?: number | string
  seller_name?: string
  store_name?: string
  stock?: number | string
}

const PAGE_SIZE = 20

export default function ShopPage() {
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(10000)
  const [minRating, setMinRating] = useState(0)
  const [sort, setSort] = useState<"created_at" | "price" | "rating" | "sales">("created_at")
  const [order, setOrder] = useState<"ASC" | "DESC">("DESC")
  const [page, setPage] = useState(1)

  const categoryOptions = useMemo<string[]>(() => {
    if (categories.length > 0) return categories
    return ["Electronics", "Accessories", "Clothing", "Home & Kitchen"]
  }, [categories])

  const buildProductsUrl = () => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    if (selectedCategories.length > 0) params.set("category", selectedCategories.join(","))
    if (minPrice > 0) params.set("min_price", String(minPrice))
    if (maxPrice < 999999) params.set("max_price", String(maxPrice))
    if (minRating > 0) params.set("rating", String(minRating))
    params.set("sort", sort)
    params.set("order", order)
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String((page - 1) * PAGE_SIZE))
    return `/api/backend/products?${params.toString()}`
  }

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(buildProductsUrl())
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load products")
      setProducts(Array.isArray(data?.products) ? data.products : [])
    } catch (e: any) {
      setError(e?.message || "Failed to load products")
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/backend/categories")
      const data = await res.json().catch(() => null)
      if (!res.ok) return
      const names = (data?.categories || []).map((c: any) => c.name).filter(Boolean)
      setCategories(names)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("search")
    if (q) setSearch(q)
    loadCategories()
  }, [])

  useEffect(() => {
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedCategories, minPrice, maxPrice, minRating, sort, order, page])

  const toggleCategory = (cat: string) => {
    setPage(1)
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))
  }

  const toggleRating = (ratingValue: number) => {
    setPage(1)
    setMinRating((prev) => (prev === ratingValue ? 0 : ratingValue))
  }

  const canPrev = page > 1
  const canNext = products.length === PAGE_SIZE

  return (
    <>
      <CustomerNavbar />
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="w-full lg:w-72 flex-shrink-0">
              <div className="card p-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-foreground mb-2" htmlFor="shop-search">
                    Search
                  </label>
                  <Input
                    id="shop-search"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => {
                      setPage(1)
                      setSearch(e.target.value)
                    }}
                  />
                </div>

                <div className="mb-6">
                  <div className="text-sm font-medium text-foreground mb-2">Categories</div>
                  <div className="space-y-2">
                    {categoryOptions.map((cat) => (
                      <label key={cat} className="flex items-center gap-2 text-sm text-foreground">
                        <input type="checkbox" checked={selectedCategories.includes(cat)} onChange={() => toggleCategory(cat)} />
                        <span>{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-sm font-medium text-foreground mb-2">Price</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={minPrice}
                      onChange={(e) => {
                        setPage(1)
                        setMinPrice(Number(e.target.value))
                      }}
                      placeholder="Min"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={maxPrice}
                      onChange={(e) => {
                        setPage(1)
                        setMaxPrice(Number(e.target.value))
                      }}
                      placeholder="Max"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-sm font-medium text-foreground mb-2">Rating</div>
                  <div className="space-y-2">
                    {[4, 3, 2, 1].map((r) => (
                      <label key={r} className="flex items-center gap-2 text-sm text-foreground">
                        <input type="checkbox" checked={minRating === r} onChange={() => toggleRating(r)} />
                        <span>{r}+</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-foreground mb-2">Sort</div>
                  <select
                    className="input w-full"
                    value={`${sort}:${order}`}
                    onChange={(e) => {
                      setPage(1)
                      const [s, o] = String(e.target.value).split(":")
                      setSort((s || "created_at") as any)
                      setOrder(((o || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC") as any)
                    }}
                  >
                    <option value="created_at:DESC">Newest</option>
                    <option value="price:ASC">Price: Low to High</option>
                    <option value="price:DESC">Price: High to Low</option>
                    <option value="rating:DESC">Top Rated</option>
                    <option value="sales:DESC">Best Sellers</option>
                  </select>
                </div>
              </div>
            </aside>

            <section className="flex-1">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : error ? (
                <div className="text-sm text-red-600">{error}</div>
              ) : products.length === 0 ? (
                <div className="text-sm text-muted-foreground">No products found.</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((p) => {
                      const id = String(p.id ?? "")
                      const sellerProductId = String(p.seller_product_id ?? p.id ?? "")
                      const name = String(p.name ?? "")
                      const price = Number(p.price ?? 0)
                      const originalPrice = Number(p.original_price ?? 0)
                      const image = String(p.image_url ?? "")
                      const rating = Number(p.avg_rating ?? 0)
                      const reviews = Number(p.review_count ?? 0)
                      const seller = String(p.store_name || p.seller_name || "")
                      const stock = Number(p.stock ?? 0)

                      return (
                        <ProductCard
                          key={sellerProductId}
                          id={id}
                          sellerProductId={sellerProductId}
                          name={name}
                          price={price}
                          originalPrice={originalPrice > 0 ? originalPrice : undefined}
                          image={image}
                          rating={Number.isFinite(rating) ? rating : 0}
                          reviews={Number.isFinite(reviews) ? reviews : 0}
                          seller={seller}
                          stock={Number.isFinite(stock) ? stock : 0}
                        />
                      )
                    })}
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={!canPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground">Page {page}</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={!canNext}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
