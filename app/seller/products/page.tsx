"use client"

import { useEffect, useMemo, useState } from "react"
import { SellerSidebar } from "@/components/seller/sidebar"
import { SellerHeader } from "@/components/seller/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, MoreVertical, Edit, Trash2, Eye } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

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
  price: number
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

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [addForm, setAddForm] = useState({
    name: "",
    price: "",
    stock: "",
    category: "",
    description: "",
    image_url: "",
    is_active: true,
  })
  const [addImageFile, setAddImageFile] = useState<File | null>(null)
  const [addImagePreview, setAddImagePreview] = useState("")

  const [editForm, setEditForm] = useState({
    name: "",
    price: "",
    stock: "",
    category: "",
    status: "Active" as Product["status"],
    description: "",
    image_url: "",
  })
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState("")

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/seller/products")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load products")
      }
      const mapped = (data?.products || []).map((p: any) => {
        // Use is_active if available, otherwise fall back to status field
        const isActive = p.is_active !== undefined ? 
          Number(p.is_active) === 1 : 
          (p.status === "Active" || p.status === "active")
        
        return {
        id: Number(p.id),
        name: p.name,
        price: Number(p.price),
        stock: Number(p.stock),
        category: p.category || "",
        status: isActive ? "Active" : "Inactive",
        createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
        image_url: p.image_url,
      }})
      setProducts(mapped)
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

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

  const categoryOptions = useMemo<string[]>(() => {
    if (categories.length > 0) return categories
    return ["Electronics", "Accessories", "Clothing", "Home & Kitchen"]
  }, [categories])

  // Filter products based on search and filters
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.category.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || product.status === statusFilter
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  // Handle product actions
  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setEditForm({
      name: product.name,
      price: String(product.price),
      stock: String(product.stock),
      category: product.category,
      status: product.status,
      description: "",
      image_url: "",
    })
    setEditImageFile(null)
    setEditImagePreview("")
    setShowEditModal(true)
  }

  const handleDelete = (product: Product) => {
    setSelectedProduct(product)
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    const run = async () => {
      if (!selectedProduct) return
      try {
        setIsLoading(true)
        setError("")
        const res = await fetch(`/api/backend/seller/products/${selectedProduct.id}`, {
          method: "DELETE",
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || "Failed to delete product")
        }
        setShowDeleteModal(false)
        setSelectedProduct(null)
        await loadProducts()
      } catch (e: any) {
        setError(e?.message || "Failed to delete product")
      } finally {
        setIsLoading(false)
      }
    }

    run()
  }

  const submitAdd = async () => {
    try {
      setIsLoading(true)
      setError("")
      let imageUrl = addForm.image_url
      if (addImageFile) {
        const formData = new FormData()
        formData.append("type", "product")
        formData.append("file", addImageFile)
        const uploadRes = await fetch("/api/backend/settings/upload", {
          method: "POST",
          body: formData,
        })
        const uploadData = await uploadRes.json().catch(() => null)
        if (!uploadRes.ok || !uploadData?.success || !uploadData?.url) {
          throw new Error(uploadData?.message || uploadData?.error || "Failed to upload image")
        }
        imageUrl = String(uploadData.url)
      }
      const payload: any = {
        name: addForm.name,
        price: Number(addForm.price),
        stock: Number(addForm.stock),
        category: addForm.category,
        description: addForm.description,
        image_url: imageUrl,
        is_active: addForm.is_active,
      }
      const res = await fetch("/api/backend/seller/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to add product")
      }
      setShowAddModal(false)
      setAddForm({ name: "", price: "", stock: "", category: "", description: "", image_url: "", is_active: true })
      setAddImageFile(null)
      setAddImagePreview("")
      await loadProducts()
    } catch (e: any) {
      setError(e?.message || "Failed to add product")
    } finally {
      setIsLoading(false)
    }
  }

  const submitEdit = async () => {
    try {
      if (!selectedProduct) return
      setIsLoading(true)
      setError("")
      const payload: any = {
        name: editForm.name,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
        category: editForm.category,
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
              <Button className="mt-4 md:mt-0" onClick={() => setShowAddModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>

            {/* Filters */}
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

            {error && <div className="text-red-600 text-sm">{error}</div>}

            {/* Products Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
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
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-md overflow-hidden bg-gray-100 border border-gray-300">
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
                                  // Show view modal or navigate to product detail page
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
                              <button
                                onClick={() => handleDelete(product)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="h-5 w-5" />
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
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New Product</h3>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500"
                  onClick={() => setShowAddModal(false)}
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      id="name"
                      className="mt-1 block w-full"
                      placeholder="Enter product name"
                      value={addForm.name}
                      onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                      Price (USDT) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      id="price"
                      className="mt-1 block w-full"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={addForm.price}
                      onChange={(e) => setAddForm((p) => ({ ...p, price: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="stock" className="block text-sm font-medium text-gray-700">
                      Stock Quantity <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      id="stock"
                      className="mt-1 block w-full"
                      placeholder="0"
                      min="0"
                      value={addForm.stock}
                      onChange={(e) => setAddForm((p) => ({ ...p, stock: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="category"
                      className="input mt-1 block w-full"
                      value={addForm.category}
                      onChange={(e) => setAddForm((p) => ({ ...p, category: e.target.value }))}
                    >
                      <option value="">Select a category</option>
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    className="input mt-1 block w-full resize-none"
                    placeholder="Enter product description"
                    value={addForm.description}
                    onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Product Image</label>
                  <div className="mt-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="add-product-image"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setAddImageFile(file)
                          const reader = new FileReader()
                          reader.onload = () => setAddImagePreview(reader.result as string)
                          reader.readAsDataURL(file)
                        }
                      }}
                    />
                    <label
                      htmlFor="add-product-image"
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <span className="inline-block h-16 w-16 rounded-md overflow-hidden bg-gray-100 border border-gray-300 flex items-center justify-center">
                        {addImagePreview ? (
                          <img src={addImagePreview} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                          <svg className="h-8 w-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        )}
                      </span>
                      <button
                        type="button"
                        className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {addImageFile ? addImageFile.name : "Choose Image"}
                      </button>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={submitAdd} disabled={isLoading}>
                  Add Product
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Product Modal */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Product</h3>
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
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      id="edit-name"
                      className="mt-1 block w-full"
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-price" className="block text-sm font-medium text-gray-700">
                      Price (USDT) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      id="edit-price"
                      className="mt-1 block w-full"
                      min="0"
                      step="0.01"
                      value={editForm.price}
                      onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                    />
                  </div>
                  
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
                    <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="edit-category"
                      className="input mt-1 block w-full"
                      value={editForm.category}
                      onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                    >
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
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
                
                <div>
                  <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    rows={3}
                    className="input mt-1 block w-full resize-none"
                    placeholder="Enter product description"
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  ></textarea>
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
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mx-auto">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div className="mt-3 text-center sm:mt-5">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Delete Product
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete <span className="font-medium">{selectedProduct.name}</span>? This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={confirmDelete}
              >
                Delete
              </button>
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
