"use client"

import { Search, Plus, MapPin, Star, Ban, RotateCw, Eye } from "lucide-react"
import { useState } from "react"

export default function RidersManagement() {
  const [riders] = useState([
    {
      id: 1,
      name: "Hassan Ali",
      phone: "+1 234 567 8900",
      email: "hassan@example.com",
      location: "Downtown",
      deliveries: 245,
      rating: 4.8,
      status: "Active",
    },
    {
      id: 2,
      name: "Fatima Khan",
      phone: "+1 234 567 8901",
      email: "fatima@example.com",
      location: "North Side",
      deliveries: 189,
      rating: 4.6,
      status: "Active",
    },
    {
      id: 3,
      name: "Muhammad Ahmed",
      phone: "+1 234 567 8902",
      email: "muhammad@example.com",
      location: "West End",
      deliveries: 103,
      rating: 3.9,
      status: "Inactive",
    },
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Riders Management</h1>
          <p className="text-muted-foreground mt-1">Manage delivery partners</p>
        </div>
        <button className="admin-panel-btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add Rider
        </button>
      </div>

      {/* Search */}
      <div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by rider name or phone..."
            className="admin-panel-search-input w-full pl-10"
          />
        </div>
      </div>

      {/* Riders Table */}
      <div className="admin-panel-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="admin-panel-table-header-cell">Name</th>
                <th className="admin-panel-table-header-cell">Phone</th>
                <th className="admin-panel-table-header-cell">Email</th>
                <th className="admin-panel-table-header-cell">Location</th>
                <th className="admin-panel-table-header-cell">Deliveries</th>
                <th className="admin-panel-table-header-cell">Rating</th>
                <th className="admin-panel-table-header-cell">Status</th>
                <th className="admin-panel-table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {riders.map((rider) => (
                <tr key={rider.id} className="admin-panel-table-row">
                  <td className="admin-panel-table-cell font-semibold">{rider.name}</td>
                  <td className="admin-panel-table-cell">{rider.phone}</td>
                  <td className="admin-panel-table-cell text-muted-foreground">{rider.email}</td>
                  <td className="admin-panel-table-cell flex items-center gap-1">
                    <MapPin size={14} className="text-primary" />
                    {rider.location}
                  </td>
                  <td className="admin-panel-table-cell">{rider.deliveries}</td>
                  <td className="admin-panel-table-cell flex items-center gap-1">
                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                    {rider.rating}
                  </td>
                  <td className="admin-panel-table-cell">
                    <span
                      className={`admin-panel-badge ${
                        rider.status === "Active" ? "admin-panel-badge-success" : "admin-panel-badge-warning"
                      }`}
                    >
                      {rider.status}
                    </span>
                  </td>
                  <td className="admin-panel-table-cell">
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-muted rounded-md transition-colors">
                        <Eye size={16} className="text-primary" />
                      </button>
                      <button className="p-2 hover:bg-muted rounded-md transition-colors">
                        <RotateCw size={16} className="text-blue-500" />
                      </button>
                      <button className="p-2 hover:bg-muted rounded-md transition-colors">
                        <Ban size={16} className="text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
