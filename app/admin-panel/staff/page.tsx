"use client"

import { useEffect, useState } from "react"
import { Plus, Search, Edit2, Lock, X, Check, Loader2 } from "lucide-react"
import { usePermissions } from "@/lib/usePermissions"

type StaffMember = {
  id: number
  user_id: number
  email: string
  full_name: string
  role_name: string | null
  role_id: number | null
  status: string
  created_at: string
  is_active: number
}

type Role = {
  id: number
  name: string
}

export default function StaffManagement() {
  const { hasPermission } = usePermissions()
  const canCreate = hasPermission("staff.create")
  const canEdit = hasPermission("staff.edit")
  const canDelete = hasPermission("staff.delete")
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role_id: "", status: "active" })

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/backend/admin/staff")
      const data = await res.json()
      if (data.success) setStaff(data.staff || [])
    } catch {}
  }

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/backend/admin/roles")
      const data = await res.json()
      if (data.success) setRoles(data.roles || [])
    } catch {}
  }

  useEffect(() => {
    Promise.all([fetchStaff(), fetchRoles()]).finally(() => setLoading(false))
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ email: "", password: "", full_name: "", role_id: "", status: "active" })
    setShowModal(true)
  }

  const openEdit = (member: StaffMember) => {
    setEditing(member)
    setForm({ email: member.email, password: "", full_name: member.full_name, role_id: member.role_id?.toString() || "", status: member.status })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.email) return
    const method = editing ? "PUT" : "POST"
    const url = editing ? `/api/backend/admin/staff/${editing.id}` : "/api/backend/admin/staff"
    const body: any = { email: form.email, full_name: form.full_name, role_id: form.role_id ? parseInt(form.role_id) : null, status: form.status }
    if (!editing && form.password) body.password = form.password
    if (editing) { body.role_id = form.role_id ? parseInt(form.role_id) : null; body.status = form.status }

    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.success) { setShowModal(false); fetchStaff() }
    } catch {}
  }

  const handleToggleStatus = async (member: StaffMember) => {
    const newStatus = member.status === "active" ? "inactive" : "active"
    try {
      const res = await fetch(`/api/backend/admin/staff/${member.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.success) fetchStaff()
    } catch {}
  }

  const filteredStaff = staff.filter((m) => {
    const q = search.toLowerCase()
    return m.email.toLowerCase().includes(q) || (m.full_name || "").toLowerCase().includes(q) || (m.role_name || "").toLowerCase().includes(q)
  })

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground mt-1">Manage admin staff accounts</p>
        </div>
        {canCreate && (
          <button onClick={openCreate} className="admin-panel-btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Staff
          </button>
        )}
      </div>

      <div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search staff..." className="admin-panel-search-input w-full pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="admin-panel-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="admin-panel-table-header-cell">Name</th>
                <th className="admin-panel-table-header-cell">Email</th>
                <th className="admin-panel-table-header-cell">Role</th>
                <th className="admin-panel-table-header-cell">Status</th>
                <th className="admin-panel-table-header-cell">Joined</th>
                <th className="admin-panel-table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((member) => (
                <tr key={member.id} className="admin-panel-table-row">
                  <td className="admin-panel-table-cell font-semibold">{member.full_name || member.email}</td>
                  <td className="admin-panel-table-cell text-muted-foreground">{member.email}</td>
                  <td className="admin-panel-table-cell">{member.role_name || "-"}</td>
                  <td className="admin-panel-table-cell">
                    <span className={`admin-panel-badge ${member.status === "active" ? "admin-panel-badge-success" : "admin-panel-badge-warning"}`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="admin-panel-table-cell">{new Date(member.created_at).toLocaleDateString()}</td>
                  <td className="admin-panel-table-cell">
                    <div className="flex gap-2">
                      {canEdit && (
                        <button onClick={() => openEdit(member)} className="p-2 hover:bg-muted rounded-md transition-colors">
                          <Edit2 size={16} className="text-blue-500" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleToggleStatus(member)} className="p-2 hover:bg-muted rounded-md transition-colors">
                          <Lock size={16} className={member.status === "active" ? "text-orange-500" : "text-green-500"} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editing ? "Edit Staff" : "Add Staff"}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input className="input w-full" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} disabled={!!editing} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{editing ? "New Password (leave blank to keep)" : "Password"}</label>
                <input type="password" className="input w-full" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input className="input w-full" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select className="input w-full" value={form.role_id} onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value }))}>
                  <option value="">No Role</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select className="input w-full" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
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
