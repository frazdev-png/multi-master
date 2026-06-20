"use client"

import { Search, Plus, Eye, Edit2, Trash2, Calendar, RefreshCw, Download } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface BlogPost {
  id: number;
  title: string;
  category: string;
  author: string;
  views: number;
  status: string;
  date: string;
  content: string;
  excerpt: string;
}

export default function BlogManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [posts, setPosts] = useState<BlogPost[]>([
    {
      id: 1,
      title: "Top 10 Tech Gadgets of 2024",
      category: "Technology",
      author: "Admin",
      views: 1245,
      status: "Published",
      date: "Dec 15, 2024",
      content: "Full content about tech gadgets...",
      excerpt: "Discover the latest and greatest tech gadgets of 2024..."
    },
    {
      id: 2,
      title: "Fashion Trends This Season",
      category: "Fashion",
      author: "Admin",
      views: 856,
      status: "Published",
      date: "Dec 10, 2024",
      content: "Full content about fashion trends...",
      excerpt: "Explore the hottest fashion trends this season..."
    },
    {
      id: 3,
      title: "Home Improvement Guide",
      category: "Home",
      author: "Admin",
      views: 0,
      status: "Draft",
      date: "Dec 18, 2024",
      content: "Full content about home improvement...",
      excerpt: "Complete guide to home improvement projects..."
    },
  ])
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleView = (post: BlogPost) => {
    setSelectedPost(post)
    setIsViewDialogOpen(true)
  }

  const handleEdit = (post: BlogPost) => {
    setEditingPost({...post})
    setIsEditDialogOpen(true)
  }

  const handleDelete = (postId: number) => {
    if (confirm("Are you sure you want to delete this blog post?")) {
      setPosts(posts.filter(post => post.id !== postId))
    }
  }

  const handleToggleStatus = (postId: number) => {
    setPosts(posts.map(post =>
      post.id === postId
        ? { ...post, status: post.status === "Published" ? "Draft" : "Published" }
        : post
    ))
  }

  const handleRefresh = () => {
    alert("Blog posts data refreshed!")
  }

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Title,Category,Author,Views,Status,Date\n" +
      posts.map(post => 
        `${post.title},${post.category},${post.author},${post.views},${post.status},${post.date}`
      ).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "blog-posts.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSaveEdit = () => {
    if (editingPost) {
      setPosts(posts.map(post => 
        post.id === editingPost.id ? editingPost : post
      ))
      setIsEditDialogOpen(false)
      setEditingPost(null)
    }
  }

  const getStatusColor = (status: string) => {
    return status === "Published" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blog Management</h1>
          <p className="text-muted-foreground mt-1">Manage blog posts and content</p>
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
            New Post
          </Button>
        </div>
      </div>

      {/* Search */}
      <div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search posts by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Blog Posts Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Author</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Views</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3 font-semibold">{post.title}</td>
                    <td className="px-4 py-3">{post.category}</td>
                    <td className="px-4 py-3">{post.author}</td>
                    <td className="px-4 py-3">{post.views}</td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(post.status)}>
                        {post.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <Calendar size={14} className="text-muted-foreground" />
                      {post.date}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleView(post)}>
                          <Eye size={16} className="text-primary" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(post)}>
                          <Edit2 size={16} className="text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(post.id)}>
                          <div className={`w-4 h-4 rounded-full ${post.status === "Published" ? "bg-yellow-500" : "bg-green-500"}`} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)}>
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPosts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No blog posts found matching your search
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Post Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Blog Post Details</DialogTitle>
            <DialogDescription>View complete blog post information</DialogDescription>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Title</label>
                  <p className="font-semibold">{selectedPost.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <p>{selectedPost.category}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Author</label>
                  <p>{selectedPost.author}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className={getStatusColor(selectedPost.status)}>
                    {selectedPost.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Views</label>
                  <p className="font-semibold">{selectedPost.views}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date</label>
                  <p>{selectedPost.date}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Excerpt</label>
                  <p>{selectedPost.excerpt}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Content</label>
                  <p className="text-sm">{selectedPost.content}</p>
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

      {/* Edit Post Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Blog Post</DialogTitle>
            <DialogDescription>Update blog post information</DialogDescription>
          </DialogHeader>
          {editingPost && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Title</label>
                  <Input
                    value={editingPost.title}
                    onChange={(e) => setEditingPost({...editingPost, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <Input
                    value={editingPost.category}
                    onChange={(e) => setEditingPost({...editingPost, category: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Author</label>
                  <Input
                    value={editingPost.author}
                    onChange={(e) => setEditingPost({...editingPost, author: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Views</label>
                  <Input
                    type="number"
                    value={editingPost.views}
                    onChange={(e) => setEditingPost({...editingPost, views: e.target.value === "" ? "" : parseInt(e.target.value)})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Excerpt</label>
                  <Textarea
                    value={editingPost.excerpt}
                    onChange={(e) => setEditingPost({...editingPost, excerpt: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Content</label>
                  <Textarea
                    rows={6}
                    value={editingPost.content}
                    onChange={(e) => setEditingPost({...editingPost, content: e.target.value})}
                  />
                </div>
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
    </div>
  )
}
