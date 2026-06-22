"use client"

import { Plus, Search, Star, Edit2, Trash2, Eye, RefreshCw, Download, Package } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  if (raw.startsWith("uploads/")) return `/${raw}`
  if (raw.startsWith("/uploads/")) return raw

  return raw
}

interface Product {
  id: number;
  name: string;
  sku: string;
  vendor: string;
  price: string;
  stock: number;
  rating: number;
  status: string;
  category: string;
  description: string;
  image: string;
  is_active?: number;
  category_id?: number | null;
}

export default function ProductsManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [categories, setCategories] = useState<string[]>([])

  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    stock: 0,
    description: "",
    category: "",
  })

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/backend/categories")
      const data = await res.json().catch(() => null)
      if (!res.ok) return
      setCategories((data?.categories || []).map((c: any) => c.name).filter(Boolean))
    } catch {}
  }

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/admin/products")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load products")
      }
      const mapped: Product[] = (data?.products || []).map((p: any) => {
        const priceNumber = Number(p.price ?? 0)
        const imageUrl = p.image_url || "/placeholder.svg"
        const vendorName = p.store_name || p.seller_name || ""
        const status = Number(p.is_active) === 1 ? "Active" : "Inactive"

        return {
          id: Number(p.id),
          name: p.name || "",
          sku: p.sku || `SKU-${p.id}`,
          vendor: vendorName,
          price: formatCurrency(priceNumber),
          stock: Number(p.stock ?? 0),
          rating: Number(p.rating ?? 0),
          status,
          category: p.category_name || "",
          description: p.description || "",
          image: imageUrl,
          is_active: Number(p.is_active ?? 0),
          category_id: p.category_id != null ? Number(p.category_id) : null,
        }
      })

      setProducts(mapped)
    } catch (e: any) {
      setError(e?.message || "Failed to load products")
    } finally {
      setIsLoading(false)
    }
  }

  const [addImageFile, setAddImageFile] = useState<File | null>(null)
  const [addImagePreview, setAddImagePreview] = useState("")
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState("")

  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append("type", "product")
    formData.append("file", file)
    const res = await fetch("/api/backend/settings/upload", { method: "POST", body: formData })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.url) throw new Error(data?.error || "Upload failed")
    return data.url
  }

  function openFilePicker(setFile: (f: File | null) => void, setPreview: (u: string) => void) {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      setFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const handleCreateProduct = async () => {
    try {
      setIsLoading(true)
      setError("")

      if (!addImageFile) {
        setError("Please select an image to upload")
        setIsLoading(false)
        return
      }

      const imageUrl = await uploadImage(addImageFile)

      const priceNumber = Number(String(newProduct.price || "").replace(/[^0-9.]/g, ""))

      const body: any = {
        name: newProduct.name,
        description: newProduct.description,
        image_url: imageUrl,
        price: Number.isFinite(priceNumber) ? priceNumber : 0,
        stock: Number(newProduct.stock ?? 0),
        category: newProduct.category || undefined,
      }

      const res = await fetch("/api/backend/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || data?.error || "Failed to create product")
      }

      setIsAddDialogOpen(false)
      setNewProduct({ name: "", price: "", stock: 0, description: "", category: "" })
      setAddImageFile(null)
      setAddImagePreview("")
      await loadProducts()
    } catch (e: any) {
      setError(e?.message || "Failed to create product")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

  const categoryOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      if (p.category) set.add(p.category)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [products])

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const handleView = (product: Product) => {
    setSelectedProduct(product)
    setIsViewDialogOpen(true)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct({...product})
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (productId: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/products/${productId}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete product")
      }
      await loadProducts()
    } catch (e: any) {
      setError(e?.message || "Failed to delete product")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStatus = async (productId: number) => {
    const current = products.find((p) => p.id === productId)
    if (!current) return
    const nextIsActive = current.status !== "Active"

    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/backend/admin/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextIsActive ? 1 : 0 }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update status")
      }
      await loadProducts()
    } catch (e: any) {
      setError(e?.message || "Failed to update status")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    loadProducts()
  }

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Product Name,SKU,Vendor,Price,Stock,Rating,Status,Category\n" +
      products.map(product => 
        `${product.name},${product.sku},${product.vendor},${product.price},${product.stock},${product.rating},${product.status},${product.category}`
      ).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "products.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSaveEdit = async () => {
    if (!editingProduct) return
    try {
      setIsLoading(true)
      setError("")

      let imageUrl = (editingProduct.image || "").trim()
      if (editImageFile) {
        imageUrl = await uploadImage(editImageFile)
      }

      const priceNumber = Number(String(editingProduct.price || "").replace(/[^0-9.]/g, ""))
      const body: any = {
        name: editingProduct.name,
        description: editingProduct.description,
        price: Number.isFinite(priceNumber) ? priceNumber : 0,
        stock: Number(editingProduct.stock ?? 0),
        category: editingProduct.category || undefined,
      }
      if (imageUrl && imageUrl !== "/placeholder.svg") {
        body.image_url = imageUrl
      }

      const res = await fetch(`/api/backend/admin/products/${editingProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update product")
      }
      setIsEditDialogOpen(false)
      setEditingProduct(null)
      await loadProducts()
    } catch (e: any) {
      setError(e?.message || "Failed to update product")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    return status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
  }

  const getStockColor = (stock: number) => {
    if (stock > 100) return "text-green-600"
    if (stock > 10) return "text-orange-600"
    return "text-red-600"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products Management</h1>
          <p className="text-muted-foreground mt-1">Manage vendor and in-house products</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus size={18} className="mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => {setSearchTerm(""); setCategoryFilter("all")}}>
          Clear Filters
        </Button>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">SKU</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Vendor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Price</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Stock</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Rating</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center overflow-hidden">
                          {product.image ? (
                            <img
                              src={resolvePublicImageUrl(product.image) || "/placeholder.svg"}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const el = e.currentTarget
                                if (el.src.endsWith("/placeholder.svg")) return
                                el.src = "/placeholder.svg"
                              }}
                            />
                          ) : (
                            <Package size={20} className="text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{product.sku}</td>
                    <td className="px-4 py-3">{product.vendor}</td>
                    <td className="px-4 py-3 text-primary font-semibold">{product.price}</td>
                    <td className="px-4 py-3">
                      <span className={getStockColor(product.stock)}>{product.stock}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Star size={14} className="fill-yellow-400 text-yellow-400" />
                        <span>{product.rating}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(product.status)}>
                        {product.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleView(product)}>
                          <Eye size={16} className="text-primary" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                          <Edit2 size={16} className="text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(product.id)}>
                          <div className={`w-4 h-4 rounded-full ${product.status === "Active" ? "bg-red-500" : "bg-green-500"}`} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && filteredProducts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No products found matching your criteria
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Product Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>View complete product information</DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              {selectedProduct.image && (
                <div className="flex justify-center">
                  <div className="w-48 h-48 rounded-lg overflow-hidden border bg-muted">
                    <img
                      src={resolvePublicImageUrl(selectedProduct.image) || "/placeholder.svg"}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const el = e.currentTarget
                        if (el.src.endsWith("/placeholder.svg")) return
                        el.src = "/placeholder.svg"
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Product Name</label>
                  <p className="font-semibold">{selectedProduct.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">SKU</label>
                  <p>{selectedProduct.sku}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Vendor</label>
                  <p>{selectedProduct.vendor}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <p>{selectedProduct.category}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Price</label>
                  <p className="font-semibold text-lg text-primary">{selectedProduct.price}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stock</label>
                  <p className={getStockColor(selectedProduct.stock)}>{selectedProduct.stock} units</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Rating</label>
                  <div className="flex items-center gap-1">
                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                    <span>{selectedProduct.rating}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className={getStatusColor(selectedProduct.status)}>
                    {selectedProduct.status}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p>{selectedProduct.description}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product information</DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Product Name</label>
                  <Input
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">SKU</label>
                  <Input
                    value={editingProduct.sku}
                    onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Vendor</label>
                  <Input
                    value={editingProduct.vendor}
                    onChange={(e) => setEditingProduct({...editingProduct, vendor: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Price</label>
                  <Input
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stock</label>
                  <Input
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({...editingProduct, stock: e.target.value === "" ? "" : parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Rating</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={editingProduct.rating}
                    onChange={(e) => setEditingProduct({...editingProduct, rating: e.target.value === "" ? "" : parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <Select value={editingProduct.category} onValueChange={(v) => setEditingProduct({...editingProduct, category: v})}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Image</label>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" onClick={() => openFilePicker(setEditImageFile, setEditImagePreview)}>
                      {editImageFile ? "Change Image" : "Upload Image"}
                    </Button>
                    {editImageFile && (
                      <span className="text-sm text-muted-foreground">{editImageFile.name}</span>
                    )}
                  </div>
                  {(editImagePreview || editingProduct.image) && (
                    <div className="mt-2 relative w-32 h-32 border rounded-md overflow-hidden bg-muted">
                      <img
                        src={editImagePreview || editingProduct.image || "/placeholder.svg"}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg" }}
                      />
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <Input
                    value={editingProduct.description}
                    onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>Create a new product</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Product Name</label>
                <Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Price</label>
                <Input value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Stock</label>
                <Input
                  type="number"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <Select value={newProduct.category} onValueChange={(v) => setNewProduct({ ...newProduct, category: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Image</label>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={() => openFilePicker(setAddImageFile, setAddImagePreview)}>
                    {addImageFile ? "Change Image" : "Upload Image"}
                  </Button>
                  {addImageFile && (
                    <span className="text-sm text-muted-foreground">{addImageFile.name}</span>
                  )}
                </div>
                {addImagePreview && (
                  <div className="mt-2 relative w-32 h-32 border rounded-md overflow-hidden bg-muted">
                    <img src={addImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <Input value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProduct} disabled={isLoading}>
                {isLoading ? "Saving..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
