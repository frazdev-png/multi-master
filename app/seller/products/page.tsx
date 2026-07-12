"use client"

import { useEffect, useMemo, useState } from "react"
import { SellerSidebar } from "@/components/seller/sidebar"
import { SellerHeader } from "@/components/seller/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Edit, Eye } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { notify } from "@/components/ui/toast"

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

  const normalized = raw.startsWith("uploads/") ? `/${raw}` : raw
  if (normalized.startsWith("/uploads/")) {
    return normalized
  }

  return normalized
}

interface Product {
  id: number
  name: string
  description?: string
  price: number
  seller_profit?: number
  final_price?: number
  stock: number
  category: string
  status: "Active" | "Inactive" | "Out of Stock"
  createdAt: string
  image_url?: string
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showAdminCatalog, setShowAdminCatalog] = useState(false)
  const [adminCatalog, setAdminCatalog] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [catalogPage, setCatalogPage] = useState(1)
  const [catalogTotal, setCatalogTotal] = useState(0)
  const perPage = 20

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showAttachModal, setShowAttachModal] = useState(false)
  const [attachProduct, setAttachProduct] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
const [showViewModal, setShowViewModal] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [adoptLoading, setAdoptLoading] = useState<number | null>(null)

  const [editForm, setEditForm] = useState({
    stock: "",
    status: "Active" as Product["status"],
  })
  // image state removed - sellers can only update pricing/stock/status

  const loadProducts = async (p?: number) => {
    try {
      setIsLoading(true)
      setError("")
      const currentPage = p ?? page
      const params = new URLSearchParams({ page: String(currentPage), limit: String(perPage) })
      if (searchTerm) params.set("search", searchTerm)
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (categoryFilter !== "all") params.set("category", categoryFilter)
      const res = await fetch(`/api/backend/seller/products?${params}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load products")
      }
      const mapped = (data?.products || []).map((p: any) => {
        const isActive = p.is_active !== undefined ? 
          Number(p.is_active) === 1 : 
          (p.status === "Active" || p.status === "active")
        
        return {
        id: Number(p.product_id_orig || p.id),
        name: p.name,
        description: p.description || "",
        price: Number(p.price),
        seller_profit: Number(p.seller_profit || 0),
        final_price: Number(p.final_price || p.price || 0),
        stock: Number(p.seller_stock ?? p.stock),
        category: p.category_name || p.category || "",
        status: isActive ? "Active" : "Inactive",
        createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
        image_url: p.image_url,
      }})
      setProducts(mapped)
      setPage(data.page || currentPage)
      setTotal(data.total || 0)
    } catch (e: any) {
      setError(e?.message || "Failed to load products")
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

  const loadAdminCatalog = async (p?: number) => {
    try {
      const currentPage = p ?? catalogPage
      const res = await fetch(`/api/backend/seller/products/admin-catalog?page=${currentPage}&limit=${perPage}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load admin catalog")
      const mapped = (data?.products || []).map((p: any) => ({
        id: Number(p.id),
        name: p.name,
        price: Number(p.price),
        stock: Number(p.stock),
        category: p.category || "",
        status: "Active" as Product["status"],
        createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
        image_url: p.image_url,
        already_in_store: !!p.already_in_store,
      }))
      setAdminCatalog(mapped)
      setCatalogPage(data.page || currentPage)
      setCatalogTotal(data.total || 0)
    } catch {
      setAdminCatalog([])
    }
  }

  useEffect(() => {
    loadProducts(1)
    loadCategories()
  }, [])

  useEffect(() => {
    if (!showAdminCatalog) loadProducts(1)
  }, [searchTerm, statusFilter, categoryFilter])

  useEffect(() => {
    if (showAdminCatalog) loadAdminCatalog(1)
  }, [showAdminCatalog])

  const categoryOptions = useMemo<string[]>(() => {
    if (categories.length > 0) return categories
    return ["Electronics & Mobile Accessories", "Fashion & Clothes", "Footwear & Bags", "Home & Kitchen", "Beauty, Grooming & Personal Care", "Grocery & Staples", "Baby Care & Kids Toys", "Auto Accessories & Industrial Supplies", "Health & Wellness"]
  }, [categories])

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const catalogTotalPages = Math.max(1, Math.ceil(catalogTotal / perPage))

  // Handle product actions
  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setEditForm({
      stock: String(product.stock),
      status: product.status,
    })
    setShowEditModal(true)
  }

  const submitEdit = async () => {
    try {
      if (!selectedProduct) return
      setIsLoading(true)
      setError("")

      const payload: any = {
        stock: Number(editForm.stock),
      }
      if (editForm.status === "Active") {
        payload.is_active = true
      } else if (editForm.status === "Inactive") {
        payload.is_active = false
      }
      const res = await fetch(`/api/backend/seller/products/${selectedProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update product")
      }
      setShowEditModal(false)
      setSelectedProduct(null)
      await loadProducts()
    } catch (e: any) {
      setError(e?.message || "Failed to update product")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAttach = async (product: any) => {
    setAttachProduct(product)
    setShowAttachModal(true)
  }

  const confirmAttach = async () => {
    if (!attachProduct) return
    try {
      setAdoptLoading(attachProduct.id)
      setError("")
      const res = await fetch("/api/backend/seller/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: attachProduct.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 409) {
          setAdminCatalog(prev => prev.map(p => p.id === attachProduct.id ? { ...p, already_in_store: true } : p))
          notify("Product already in your store", "error")
          setShowAttachModal(false)
          setAttachProduct(null)
          return
        }
        throw new Error(data?.error || "Failed to add product to your store")
      }
      notify("Product added to your store", "success")
      setShowAttachModal(false)
      setAttachProduct(null)
      setAdminCatalog(prev => prev.map(p => p.id === attachProduct.id ? { ...p, already_in_store: true } : p))
      await loadProducts()
    } catch (e: any) {
      notify(e?.message || "Failed to add product", "error")
    } finally {
      setAdoptLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded'
      case 'Inactive':
        return 'bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded'
      case 'Out of Stock':
        return 'bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded'
      default:
        return 'bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded'
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <SellerSidebar isMobileMenuOpen={isMobileMenuOpen} onMobileMenuClose={() => setIsMobileMenuOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <SellerHeader onMobileMenuToggle={() => setIsMobileMenuOpen((v) => !v)} isMobileMenuOpen={isMobileMenuOpen} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          <div className="flex flex-col space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Products</h1>
                <p className="mt-1 text-sm text-gray-500">Manage your store products</p>
              </div>
              <div className="flex gap-2 mt-4 md:mt-0">
                <Button variant={showAdminCatalog ? "outline" : "default"} onClick={() => setShowAdminCatalog(false)}>
                  My Products
                </Button>
                <Button variant={showAdminCatalog ? "default" : "outline"} onClick={() => setShowAdminCatalog(true)}>
                  Admin Catalog
                </Button>
              </div>
            </div>

            {!showAdminCatalog && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                      Search
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <Input
                        id="search"
                        type="text"
                        placeholder="Search products..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      id="status"
                      className="input w-full"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Out of Stock">Out of Stock</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      id="category"
                      className="input w-full"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="all">All Categories</option>
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {error && <div className="text-red-600 text-sm">{error}</div>}

            {!showAdminCatalog ? (
              /* Products Table */
              <div className="bg-white shadow rounded-lg overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stock
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {products.length > 0 ? (
                        products.map((product) => (
                          <tr key={product.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-14 w-14 rounded-md overflow-hidden bg-gray-100 border border-gray-300">
                                  {product.image_url ? (
                                    <img
                                      src={resolvePublicImageUrl(product.image_url) || "/placeholder.svg"}
                                      alt={product.name}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        const el = e.currentTarget
                                        if (el.src.endsWith("/placeholder.svg")) return
                                        el.src = "/placeholder.svg"
                                      }}
                                    />
                                  ) : (
                                    <span className="text-gray-500 text-xs">IMG</span>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                  <div className="text-sm text-gray-500">SKU: {product.id.toString().padStart(4, '0')}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{product.category}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{formatCurrency(product.price)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{product.stock} units</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={getStatusBadge(product.status)}>
                                {product.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedProduct(product)
                                    setShowViewModal(true)
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  <Eye className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleEdit(product)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  <Edit className="h-5 w-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                            No products found. Try adjusting your search or filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                {total > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-200 text-sm sm:pr-14">
                    <p className="text-muted-foreground">
                      Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total} products
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => loadProducts(page - 1)}>
                        Previous
                      </Button>
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 7) {
                          pageNum = i + 1
                        } else if (page <= 4) {
                          pageNum = i + 1
                        } else if (page >= totalPages - 3) {
                          pageNum = totalPages - 6 + i
                        } else {
                          pageNum = page - 3 + i
                        }
                        return (
                          <Button key={pageNum} variant={pageNum === page ? "default" : "outline"} size="sm" className="min-w-9" onClick={() => loadProducts(pageNum)}>
                            {pageNum}
                          </Button>
                        )
                      })}
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => loadProducts(page + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Admin Catalog */
              <div className="bg-white shadow rounded-lg overflow-x-auto">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Admin Product Catalog</h2>
                  <p className="text-sm text-gray-500">Browse products added by admin and add them to your store</p>
                </div>
                {adminCatalog.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 p-4">
                    {adminCatalog.map((product) => (
                      <div key={product.id} className="border border-gray-200 rounded-xl p-4 flex flex-col hover:shadow-md transition-shadow bg-white">
                        <div className="relative w-full rounded-lg overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 mb-3" style={{ aspectRatio: "4/3" }}>
                          {product.image_url ? (
                            <img
                              src={resolvePublicImageUrl(product.image_url) || "/placeholder.svg"}
                              alt={product.name}
                              className="h-full w-full object-contain p-2 transition-transform duration-300 hover:scale-105"
                              onError={(e) => {
                                const el = e.currentTarget;
                                if (el.src.endsWith("/placeholder.svg")) return;
                                el.src = "/placeholder.svg";
                              }}
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full flex flex-col items-center justify-center text-gray-300">
                              <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs text-gray-400">No Image</span>
                            </div>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{product.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{product.category}</p>
                        <p className="text-base font-bold text-gray-900 mt-2">{formatCurrency(product.price)}</p>
                        <p className="text-xs text-gray-500 mt-1">Stock: <span className="font-medium">{product.stock}</span></p>
                        <div className="mt-auto pt-4">
                          {(product as any).already_in_store ? (
                            <Button size="sm" className="w-full" disabled variant="secondary">
                              Already in store
                            </Button>
                          ) : (
                            <Button size="sm" className="w-full" onClick={() => handleAttach(product)} disabled={adoptLoading === product.id}>
                              {adoptLoading === product.id ? "Adding..." : "Add to my store"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-gray-500">
                    No products available in admin catalog.
                  </div>
                )}
                {catalogTotal > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-200 text-sm sm:pr-14">
                    <p className="text-muted-foreground">
                      Showing {Math.min((catalogPage - 1) * perPage + 1, catalogTotal)}–{Math.min(catalogPage * perPage, catalogTotal)} of {catalogTotal} products
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" disabled={catalogPage <= 1} onClick={() => loadAdminCatalog(catalogPage - 1)}>
                        Previous
                      </Button>
                      {Array.from({ length: Math.min(catalogTotalPages, 7) }, (_, i) => {
                        let pageNum: number
                        if (catalogTotalPages <= 7) {
                          pageNum = i + 1
                        } else if (catalogPage <= 4) {
                          pageNum = i + 1
                        } else if (catalogPage >= catalogTotalPages - 3) {
                          pageNum = catalogTotalPages - 6 + i
                        } else {
                          pageNum = catalogPage - 3 + i
                        }
                        return (
                          <Button key={pageNum} variant={pageNum === catalogPage ? "default" : "outline"} size="sm" className="min-w-9" onClick={() => loadAdminCatalog(pageNum)}>
                            {pageNum}
                          </Button>
                        )
                      })}
                      <Button variant="outline" size="sm" disabled={catalogPage >= catalogTotalPages} onClick={() => loadAdminCatalog(catalogPage + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>


      
      {/* Edit Product Modal */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Stock & Status</h3>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500"
                  onClick={() => setShowEditModal(false)}
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Product: <strong>{selectedProduct.name}</strong></p>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="edit-stock" className="block text-sm font-medium text-gray-700">
                    Stock Quantity <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    id="edit-stock"
                    className="mt-1 block w-full"
                    min="0"
                    value={editForm.stock}
                    onChange={(e) => setEditForm((p) => ({ ...p, stock: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="edit-status"
                    className="input mt-1 block w-full"
                    value={editForm.status}
                    onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as Product["status"] }))}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Out of Stock">Out of Stock</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={submitEdit} disabled={isLoading}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attach to Store Modal */}
      {showAttachModal && attachProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add to My Store</h3>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500"
                  onClick={() => { setShowAttachModal(false); setAttachProduct(null) }}
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Adding <strong>{attachProduct.name}</strong> to your store.
                You can adjust pricing later.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowAttachModal(false); setAttachProduct(null) }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={confirmAttach} disabled={adoptLoading === attachProduct.id}>
                  {adoptLoading === attachProduct.id ? "Adding..." : "Add to Store"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Product Modal */}
      {showViewModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="p-6 pb-0 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-medium text-gray-900">Product Details</h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500"
                onClick={() => setShowViewModal(false)}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {selectedProduct.image_url && (
                <div className="h-36 sm:h-48 w-full rounded-md overflow-hidden bg-gray-100 mb-4">
                  <img
                    src={resolvePublicImageUrl(selectedProduct.image_url) || "/placeholder.svg"}
                    alt={selectedProduct.name}
                    className="h-full w-full object-contain"
                    onError={(e) => { const el = e.currentTarget; if (!el.src.endsWith("/placeholder.svg")) el.src = "/placeholder.svg" }}
                  />
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Name</label>
                  <p className="text-sm text-gray-900">{selectedProduct.name}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500">Description</label>
                  <p className="text-sm text-gray-900">{selectedProduct.description || "No description"}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Price (Base)</label>
                    <p className="text-sm text-gray-900">{formatCurrency(selectedProduct.price)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Seller Profit</label>
                    <p className="text-sm text-gray-900">{formatCurrency(selectedProduct.seller_profit || 0)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Final Price</label>
                    <p className="text-sm text-gray-900 font-semibold">{formatCurrency(selectedProduct.final_price || selectedProduct.price)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Stock</label>
                    <p className="text-sm text-gray-900">{selectedProduct.stock} units</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Category</label>
                    <p className="text-sm text-gray-900">{selectedProduct.category || "N/A"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Status</label>
                    <span className={`mt-1 inline-block ${getStatusBadge(selectedProduct.status)}`}>
                      {selectedProduct.status}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500">Added Date</label>
                  <p className="text-sm text-gray-900">{selectedProduct.createdAt || "N/A"}</p>
                </div>
              </div>
            </div>

            <div className="p-6 pt-0 shrink-0 flex justify-end">
              <Button type="button" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}
