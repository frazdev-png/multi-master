"use client"

import { useState } from "react"

import { Zap, ToggleRight, ToggleLeft, Settings } from "lucide-react"

export default function AddonsManager() {
  const [addons] = useState([
    {
      id: 1,
      name: "Advanced Analytics",
      description: "Real-time analytics and reporting tools",
      status: "Enabled",
      version: "2.1.0",
    },
    {
      id: 2,
      name: "SMS Notifications",
      description: "Send SMS alerts to customers and vendors",
      status: "Enabled",
      version: "1.5.2",
    },
    {
      id: 3,
      name: "Social Integrations",
      description: "Social media sharing and login",
      status: "Disabled",
      version: "1.2.0",
    },
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Addon Manager</h1>
        <p className="text-muted-foreground mt-1">Enable or disable system extensions</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {addons.map((addon) => (
          <div key={addon.id} className="admin-panel-table p-6 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Zap size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="font-bold">{addon.name}</h3>
                <p className="text-sm text-muted-foreground">{addon.description}</p>
                <p className="text-xs text-muted-foreground mt-1">v{addon.version}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span
                className={`admin-panel-badge ${
                  addon.status === "Enabled" ? "admin-panel-badge-success" : "admin-panel-badge-warning"
                }`}
              >
                {addon.status}
              </span>
              <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                {addon.status === "Enabled" ? (
                  <ToggleRight size={24} className="text-green-600" />
                ) : (
                  <ToggleLeft size={24} className="text-gray-400" />
                )}
              </button>
              <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                <Settings size={20} className="text-primary" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
