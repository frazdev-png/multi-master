"use client"

import { useState } from "react"

import { MessageCircle, Eye, Archive, Search } from "lucide-react"

export default function DiscussionsManagement() {
  const [discussions] = useState([
    {
      id: 1,
      title: "Issue with Wireless Headphones",
      type: "Product",
      initiator: "John Doe",
      replies: 5,
      status: "Open",
      date: "Dec 18, 2024",
    },
    {
      id: 2,
      title: "Refund Request for Order",
      type: "Order",
      initiator: "Jane Smith",
      replies: 2,
      status: "Open",
      date: "Dec 17, 2024",
    },
    {
      id: 3,
      title: "Stock availability query",
      type: "Product",
      initiator: "Mike Johnson",
      replies: 1,
      status: "Resolved",
      date: "Dec 16, 2024",
    },
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Discussions & Support</h1>
        <p className="text-muted-foreground mt-1">Manage customer and vendor discussions</p>
      </div>

      {/* Search */}
      <div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search discussions..." className="admin-panel-search-input w-full pl-10" />
        </div>
      </div>

      {/* Discussions Table */}
      <div className="admin-panel-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="admin-panel-table-header-cell">Topic</th>
                <th className="admin-panel-table-header-cell">Type</th>
                <th className="admin-panel-table-header-cell">Initiator</th>
                <th className="admin-panel-table-header-cell">Replies</th>
                <th className="admin-panel-table-header-cell">Status</th>
                <th className="admin-panel-table-header-cell">Date</th>
                <th className="admin-panel-table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {discussions.map((discussion) => (
                <tr key={discussion.id} className="admin-panel-table-row">
                  <td className="admin-panel-table-cell font-semibold">{discussion.title}</td>
                  <td className="admin-panel-table-cell">{discussion.type}</td>
                  <td className="admin-panel-table-cell">{discussion.initiator}</td>
                  <td className="admin-panel-table-cell flex items-center gap-1">
                    <MessageCircle size={14} className="text-primary" />
                    {discussion.replies}
                  </td>
                  <td className="admin-panel-table-cell">
                    <span
                      className={`admin-panel-badge ${
                        discussion.status === "Open" ? "admin-panel-badge-warning" : "admin-panel-badge-success"
                      }`}
                    >
                      {discussion.status}
                    </span>
                  </td>
                  <td className="admin-panel-table-cell">{discussion.date}</td>
                  <td className="admin-panel-table-cell">
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-muted rounded-md transition-colors">
                        <Eye size={16} className="text-primary" />
                      </button>
                      <button className="p-2 hover:bg-muted rounded-md transition-colors">
                        <Archive size={16} className="text-blue-500" />
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
