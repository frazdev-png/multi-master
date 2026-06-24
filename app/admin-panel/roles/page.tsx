"use client"

import { useEffect, useState } from "react"
import { Plus, Edit2, Trash2, Shield, X, Check, Loader2 } from "lucide-react"
import { usePermissions } from "@/lib/usePermissions"

type Role = {
  id: number
  name: string
  description: string
  permissions_count: number
  permission_slugs: string | null
}

type Permission = {
  id: number
  name: string
  slug: string
  description: string
}

export default function RolesManagement() {
  const { hasPermission } = usePermissions()
  const canCreate = hasPermission("roles.create")
  const canEdit = hasPermission("roles.edit")
  const canDelete = hasPermission("roles.delete")
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Partial<Role> & { permissions?: string[] } | null>(null)
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/backend/admin/roles")
      const data = await res.json()
      if (data.success) setRoles(data.roles || [])
    } catch {}
  }

  const fetchPermissions = async () => {
    try {
      const res = await fetch("/api/backend/admin/permissions")
      const data = await res.json()
      if (data.success) setPermissions(data.permissions || [])
    } catch {}
  }

  useEffect(() => {
    Promise.all([fetchRoles(), fetchPermissions()]).finally(() => setLoading(false))
  }, [])

  const openCreate = () => {
    setEditingRole({ name: "", description: "" })
    setSelectedPerms([])
    setShowModal(true)
  }

  const openEdit = (role: Role) => {
    setEditingRole(role)
    setSelectedPerms(role.permission_slugs ? role.permission_slugs.split(",") : [])
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!editingRole?.name) return
    const isEdit = !!editingRole.id
    const url = isEdit ? `/api/backend/admin/roles/${editingRole.id}` : "/api/backend/admin/roles"
    const method = isEdit ? "PUT" : "POST"

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingRole.name, description: editingRole.description, permissions: selectedPerms }),
      })
      const data = await res.json()
      if (data.success) {
        setShowModal(false)
        fetchRoles()
      }
    } catch {}
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this role?")) return
    try {
      const res = await fetch(`/api/backend/admin/roles/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) fetchRoles()
    } catch {}
  }

  const togglePerm = (slug: string) => {
    setSelectedPerms((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-1">Manage user roles and permissions</p>
        </div>
        {canCreate && (
          <button onClick={openCreate} className="admin-panel-btn-primary flex items-center gap-2">
            <Plus size={18} />
            Create Role
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="admin-panel-table p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={20} className="text-primary" />
              <h3 className="font-bold text-lg">{role.name}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{role.description}</p>
            <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-border">
              <div>
                <div className="text-xs text-muted-foreground">Permissions</div>
                <div className="text-lg font-bold">{role.permissions_count || (role.permission_slugs ? role.permission_slugs.split(",").length : 0)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Users</div>
                <div className="text-lg font-bold">{0}</div>
              </div>
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <button onClick={() => openEdit(role)} className="admin-panel-btn-secondary flex-1 flex items-center justify-center gap-1">
                  <Edit2 size={14} /> Edit
                </button>
              )}
              {canDelete && (
                <button onClick={() => handleDelete(role.id)} className="admin-panel-btn-danger flex-1">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingRole?.id ? "Edit Role" : "Create Role"}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Role Name</label>
                <input className="input w-full" value={editingRole?.name || ""} onChange={(e) => setEditingRole((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="input w-full min-h-[80px]" value={editingRole?.description || ""} onChange={(e) => setEditingRole((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {permissions.map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                      <input type="checkbox" checked={selectedPerms.includes(perm.slug)} onChange={() => togglePerm(perm.slug)} className="w-4 h-4" />
                      <span className="text-sm">{perm.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button onClick={() => setShowModal(false)} className="admin-panel-btn-secondary">Cancel</button>
                <button onClick={handleSave} className="admin-panel-btn-primary"><Check size={16} className="mr-1" /> Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
