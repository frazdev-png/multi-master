"use client"

import { Shield, Save } from "lucide-react"

export default function SystemActivation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Activation</h1>
        <p className="text-muted-foreground mt-1">Manage license and system settings</p>
      </div>

      {/* License Info */}
      <div className="admin-panel-table p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Shield size={32} className="text-primary" />
          <div>
            <h2 className="text-xl font-bold">License Information</h2>
            <p className="text-muted-foreground">Manage your system license and activation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <label className="block text-sm font-medium mb-2">License Key</label>
            <input
              type="password"
              defaultValue="SAR-2024-XXXXX-XXXXX-XXXXX"
              className="admin-panel-search-input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">License Status</label>
            <div className="admin-panel-search-input bg-green-50 dark:bg-green-950 flex items-center gap-2 px-4">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              <span className="text-green-700 dark:text-green-300 font-medium">Active</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">License Expiry</label>
          <input type="date" defaultValue="2025-12-31" className="admin-panel-search-input w-full" />
        </div>
      </div>

      {/* Version Control */}
      <div className="admin-panel-table p-6 space-y-4">
        <h2 className="text-xl font-bold">System Version</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Current Version</label>
            <input type="text" value="v2.1.0" readOnly className="admin-panel-search-input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Latest Version Available</label>
            <input type="text" value="v2.1.0" readOnly className="admin-panel-search-input w-full" />
          </div>
        </div>

        <button className="admin-panel-btn-primary">Check for Updates</button>
      </div>

      {/* Maintenance Mode */}
      <div className="admin-panel-table p-6">
        <h2 className="text-xl font-bold mb-4">Maintenance Mode</h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4" />
          <span className="font-medium">Enable Maintenance Mode</span>
        </label>
        <p className="text-sm text-muted-foreground mt-2">
          When enabled, the website will display a maintenance message to visitors.
        </p>
      </div>

      <div className="flex justify-end">
        <button className="admin-panel-btn-primary flex items-center gap-2">
          <Save size={18} />
          Save Changes
        </button>
      </div>
    </div>
  )
}
