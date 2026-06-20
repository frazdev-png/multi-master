"use client"

import { Plus, Edit2, Trash2, Search, RefreshCw, Download, Eye, ToggleLeft, ToggleRight, FolderOpen, Tag, TrendingUp, MoreVertical, Filter, Star } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  products: number;
  subcategories: number;
  status: "Active" | "Inactive";
  parent: string;
  image: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number;
}

interface Subcategory {
  id: number;
  name: string;
  slug: string;
  categoryId: number;
  products: number;
}

export default function CategoriesManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const slugify = (s: string) =>
    (s || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")

  const loadCategories = async () => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/backend/admin/categories")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load categories")
      }

      const mapped: Category[] = (data?.categories || []).map((c: any, idx: number) => {
        const name = c.name || ""
        return {
          id: Number(c.id),
          name,
          slug: slugify(name),
          description: c.description || "",
          products: Number(c.product_count ?? 0),
          subcategories: 0,
          status: Number(c.is_active) === 1 ? "Active" : "Inactive",
          parent: "None",
          image: c.image_url || "",
          featured: false,
          createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString() : "",
          updatedAt: c.updated_at ? new Date(c.updated_at).toLocaleDateString() : "",
          seoTitle: "",
          seoDescription: "",
          sortOrder: idx + 1,
        }
      })

      setCategories(mapped)
    } catch (e: any) {
      setError(e?.message || "Failed to load categories")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         category.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || category.status === statusFilter
    return matchesSearch && matchesStatus
  }).sort((a, b) => {
    switch(sortBy) {
      case "name": return a.name.localeCompare(b.name)
      case "products": return b.products - a.products
      case "subcategories": return b.subcategories - a.subcategories
      case "sortOrder": return a.sortOrder - b.sortOrder
      default: return 0
    }
  })

  const handleView = (category: Category) => {
    setSelectedCategory(category)
    setIsViewDialogOpen(true)
  }

  const handleEdit = (category: Category) => {
    setEditingCategory({...category})
    setIsEditDialogOpen(true)
  }

  const handleDelete = (categoryId: number) => {
    if (!confirm("Are you sure you want to delete this category? This action cannot be undone.")) return
    ;(async () => {
      try {
        setIsLoading(true)
        setError("")
        const res = await fetch(`/api/backend/admin/categories/${categoryId}`, { method: "DELETE" })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || "Failed to delete category")
        }
        await loadCategories()
      } catch (e: any) {
        setError(e?.message || "Failed to delete category")
      } finally {
        setIsLoading(false)
      }
    })()
  }

  const handleToggleStatus = (categoryId: number) => {
    const current = categories.find((c) => c.id === categoryId)
    if (!current) return
    const nextIsActive = current.status !== "Active"
    ;(async () => {
      try {
        setIsLoading(true)
        setError("")
        const res = await fetch(`/api/backend/admin/categories/${categoryId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: nextIsActive ? 1 : 0 }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || "Failed to update category")
        }
        await loadCategories()
      } catch (e: any) {
        setError(e?.message || "Failed to update category")
      } finally {
        setIsLoading(false)
      }
    })()
  }

  const handleToggleFeatured = (categoryId: number) => {
    setCategories(categories.map(category =>
      category.id === categoryId ? { ...category, featured: !category.featured } : category
    ))
  }

  const handleSaveEdit = () => {
    if (!editingCategory) return
    ;(async () => {
      try {
        setIsLoading(true)
        setError("")
        const res = await fetch(`/api/backend/admin/categories/${editingCategory.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingCategory.name,
            description: editingCategory.description,
            image_url: editingCategory.image || null,
            is_active: editingCategory.status === "Active" ? 1 : 0,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || "Failed to update category")
        }
        setIsEditDialogOpen(false)
        setEditingCategory(null)
        await loadCategories()
      } catch (e: any) {
        setError(e?.message || "Failed to update category")
      } finally {
        setIsLoading(false)
      }
    })()
  }

  const handleAddCategory = () => {
    const draft = editingCategory
    ;(async () => {
      try {
        setIsLoading(true)
        setError("")
        const res = await fetch("/api/backend/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft?.name || "New Category",
            description: draft?.description || "",
            image_url: draft?.image || null,
            is_active: 1,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || "Failed to create category")
        }
        setIsAddDialogOpen(false)
        setEditingCategory(null)
        await loadCategories()
      } catch (e: any) {
        setError(e?.message || "Failed to create category")
      } finally {
        setIsLoading(false)
      }
    })()
  }

  const handleRefresh = () => {
    loadCategories()
  }

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Slug,Products,Subcategories,Status,Featured,Created At\n" +
      categories.map(category => 
        `${category.name},${category.slug},${category.products},${category.subcategories},${category.status},${category.featured},${category.createdAt}`
      ).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "categories.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusColor = (status: string) => {
    return status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
  }

  const totalCategories = categories.length
  const activeCategories = categories.filter(c => c.status === "Active").length
  const totalProducts = categories.reduce((sum, c) => sum + c.products, 0)
  const totalSubcategories = categories.reduce((sum, c) => sum + c.subcategories, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Categories Management</h1>
          <p className="text-muted-foreground mt-1">Create and manage product categories</p>
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
            Add Category
          </Button>
        </div>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCategories}</div>
            <p className="text-xs text-muted-foreground">
              {activeCategories} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all categories
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subcategories</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubcategories}</div>
            <p className="text-xs text-muted-foreground">
              Total subcategories
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Featured</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.filter(c => c.featured).length}</div>
            <p className="text-xs text-muted-foreground">
              Featured categories
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="products">Products</SelectItem>
                <SelectItem value="subcategories">Subcategories</SelectItem>
                <SelectItem value="sortOrder">Sort Order</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Products</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Subcategories</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Featured</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{category.name}</span>
                          {category.featured && (
                            <Star size={14} className="fill-yellow-400 text-yellow-400" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{category.slug}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {category.description}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{category.products}</div>
                      <div className="text-xs text-muted-foreground">products</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{category.subcategories}</div>
                      <div className="text-xs text-muted-foreground">subcategories</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(category.status)}>
                        {category.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={category.featured}
                        onCheckedChange={() => handleToggleFeatured(category.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleView(category)}>
                          <Eye size={16} className="text-primary" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(category)}>
                          <Edit2 size={16} className="text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(category.id)}>
                          {category.status === "Active" ? (
                            <ToggleLeft size={16} className="text-orange-500" />
                          ) : (
                            <ToggleRight size={16} className="text-green-500" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(category.id)}>
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && filteredCategories.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No categories found matching your criteria
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Category Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Category Details</DialogTitle>
            <DialogDescription>Complete category information and settings</DialogDescription>
          </DialogHeader>
          {selectedCategory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="font-semibold">{selectedCategory.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Slug</Label>
                  <p>{selectedCategory.slug}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                  <p>{selectedCategory.description}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Products</Label>
                  <p className="font-semibold">{selectedCategory.products}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Subcategories</Label>
                  <p className="font-semibold">{selectedCategory.subcategories}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedCategory.status)}>
                    {selectedCategory.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Featured</Label>
                  <Badge variant={selectedCategory.featured ? "default" : "secondary"}>
                    {selectedCategory.featured ? "Featured" : "Not Featured"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created At</Label>
                  <p>{selectedCategory.createdAt}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Updated At</Label>
                  <p>{selectedCategory.updatedAt}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">SEO Title</Label>
                  <p>{selectedCategory.seoTitle}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">SEO Description</Label>
                  <p className="text-sm">{selectedCategory.seoDescription}</p>
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

      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update category information</DialogDescription>
          </DialogHeader>
          {editingCategory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  />
                </div>
                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={editingCategory.slug}
                    onChange={(e) => setEditingCategory((prev) => (prev ? { ...prev, slug: e.target.value } : prev))}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={editingCategory.description}
                    onChange={(e) => setEditingCategory((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                  />
                </div>
                <div>
                  <Label htmlFor="parent">Parent Category</Label>
                  <Select
                    value={editingCategory.parent}
                    onValueChange={(value) => setEditingCategory((prev) => (prev ? { ...prev, parent: value } : prev))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      {categories.filter(c => c.id !== editingCategory.id).map(cat => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={editingCategory.sortOrder}
                    onChange={(e) => setEditingCategory((prev) => (prev ? { ...prev, sortOrder: e.target.value === "" ? "" : parseInt(e.target.value) } : prev))}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="seoTitle">SEO Title</Label>
                  <Input
                    id="seoTitle"
                    value={editingCategory.seoTitle}
                    onChange={(e) => setEditingCategory((prev) => (prev ? { ...prev, seoTitle: e.target.value } : prev))}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="seoDescription">SEO Description</Label>
                  <Textarea
                    id="seoDescription"
                    value={editingCategory.seoDescription}
                    onChange={(e) => setEditingCategory((prev) => (prev ? { ...prev, seoDescription: e.target.value } : prev))}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="featured"
                  checked={editingCategory.featured}
                  onCheckedChange={(checked) => setEditingCategory((prev) => (prev ? { ...prev, featured: checked } : prev))}
                />
                <Label htmlFor="featured">Featured Category</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>Create a new product category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-name">Name</Label>
                <Input
                  id="new-name"
                  value={editingCategory?.name || ""}
                  onChange={(e) => setEditingCategory((prev) => ({
                    ...(prev || {
                      id: 0,
                      name: "",
                      slug: "",
                      description: "",
                      products: 0,
                      subcategories: 0,
                      status: "Active",
                      parent: "None",
                      image: "",
                      featured: false,
                      createdAt: "",
                      updatedAt: "",
                      seoTitle: "",
                      seoDescription: "",
                      sortOrder: categories.length + 1,
                    }),
                    name: e.target.value,
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="new-slug">Slug</Label>
                <Input
                  id="new-slug"
                  value={editingCategory?.slug || ""}
                  onChange={(e) => setEditingCategory((prev) => ({
                    ...(prev || {
                      id: 0,
                      name: "",
                      slug: "",
                      description: "",
                      products: 0,
                      subcategories: 0,
                      status: "Active",
                      parent: "None",
                      image: "",
                      featured: false,
                      createdAt: "",
                      updatedAt: "",
                      seoTitle: "",
                      seoDescription: "",
                      sortOrder: categories.length + 1,
                    }),
                    slug: e.target.value,
                  }))}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="new-description">Description</Label>
                <Textarea
                  id="new-description"
                  value={editingCategory?.description || ""}
                  onChange={(e) => setEditingCategory((prev) => ({
                    ...(prev || {
                      id: 0,
                      name: "",
                      slug: "",
                      description: "",
                      products: 0,
                      subcategories: 0,
                      status: "Active",
                      parent: "None",
                      image: "",
                      featured: false,
                      createdAt: "",
                      updatedAt: "",
                      seoTitle: "",
                      seoDescription: "",
                      sortOrder: categories.length + 1,
                    }),
                    description: e.target.value,
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="new-parent">Parent Category</Label>
                <Select
                  value={editingCategory?.parent || "None"}
                  onValueChange={(value) =>
                    setEditingCategory((prev) => ({
                      ...(prev || {
                        id: 0,
                        name: "",
                        slug: "",
                        description: "",
                        products: 0,
                        subcategories: 0,
                        status: "Active",
                        parent: "None",
                        image: "",
                        featured: false,
                        createdAt: "",
                        updatedAt: "",
                        seoTitle: "",
                        seoDescription: "",
                        sortOrder: categories.length + 1,
                      }),
                      parent: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="new-sortOrder">Sort Order</Label>
                <Input
                  id="new-sortOrder"
                  type="number"
                  value={editingCategory?.sortOrder || categories.length + 1}
                  onChange={(e) => setEditingCategory((prev) => ({
                    ...(prev || {
                      id: 0,
                      name: "",
                      slug: "",
                      description: "",
                      products: 0,
                      subcategories: 0,
                      status: "Active",
                      parent: "None",
                      image: "",
                      featured: false,
                      createdAt: "",
                      updatedAt: "",
                      seoTitle: "",
                      seoDescription: "",
                      sortOrder: categories.length + 1,
                    }),
                    sortOrder: e.target.value === "" ? "" : parseInt(e.target.value),
                  }))}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="new-featured"
                checked={editingCategory?.featured || false}
                onCheckedChange={(checked) => setEditingCategory((prev) => ({
                  ...(prev || {
                    id: 0,
                    name: "",
                    slug: "",
                    description: "",
                    products: 0,
                    subcategories: 0,
                    status: "Active",
                    parent: "None",
                    image: "",
                    featured: false,
                    createdAt: "",
                    updatedAt: "",
                    seoTitle: "",
                    seoDescription: "",
                    sortOrder: categories.length + 1,
                  }),
                  featured: checked,
                }))}
              />
              <Label htmlFor="new-featured">Featured Category</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCategory}>
                Add Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
