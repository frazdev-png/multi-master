"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Settings, 
  Globe, 
  Mail, 
  Type, 
  Home, 
  Menu as MenuIcon, 
  Search, 
  Shield, 
  Database, 
  Bell, 
  Palette,
  CreditCard,
  Users,
  FileText,
  Lock,
  Zap,
  BarChart,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreVertical
} from "lucide-react"

interface SettingSection {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  href: string
  status: "configured" | "partial" | "not-configured"
  lastUpdated: string
  badge?: string
}

export default function SettingsPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const settingSections: SettingSection[] = [
    {
      id: "general",
      title: "General Settings",
      description: "Basic website configuration, name, logo, contact information",
      icon: <Globe className="h-5 w-5" />,
      href: "/admin-panel/settings/general",
      status: "configured",
      lastUpdated: "Dec 12, 2024",
      badge: "Core"
    },
    {
      id: "seo",
      title: "SEO Settings",
      description: "Meta tags, sitemap, robots.txt, search engine optimization",
      icon: <Search className="h-5 w-5" />,
      href: "/admin-panel/settings/seo",
      status: "configured",
      lastUpdated: "Dec 10, 2024"
    },
    {
      id: "email",
      title: "Email Settings",
      description: "SMTP configuration, email templates, notification settings",
      icon: <Mail className="h-5 w-5" />,
      href: "/admin-panel/settings/email",
      status: "partial",
      lastUpdated: "Dec 8, 2024",
      badge: "Important"
    },
    {
      id: "homepage",
      title: "Homepage Settings",
      description: "Banner configuration, featured products, layout settings",
      icon: <Home className="h-5 w-5" />,
      href: "/admin-panel/settings/homepage",
      status: "configured",
      lastUpdated: "Dec 11, 2024"
    },
    {
      id: "menu",
      title: "Menu Settings",
      description: "Navigation menu structure, links, ordering",
      icon: <MenuIcon className="h-5 w-5" />,
      href: "/admin-panel/settings/menu",
      status: "configured",
      lastUpdated: "Dec 9, 2024"
    },
    {
      id: "font",
      title: "Font & Typography",
      description: "Font families, sizes, typography settings",
      icon: <Type className="h-5 w-5" />,
      href: "/admin-panel/settings/font",
      status: "not-configured",
      lastUpdated: "Never"
    }
  ]

  const filteredSections = settingSections.filter(section =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch(status) {
      case "configured": return "bg-green-100 text-green-800"
      case "partial": return "bg-yellow-100 text-yellow-800"
      case "not-configured": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "configured": return <CheckCircle size={14} className="text-green-600" />
      case "partial": return <AlertCircle size={14} className="text-yellow-600" />
      case "not-configured": return <AlertCircle size={14} className="text-red-600" />
      default: return null
    }
  }

  const configuredCount = settingSections.filter(s => s.status === "configured").length
  const partialCount = settingSections.filter(s => s.status === "partial").length
  const notConfiguredCount = settingSections.filter(s => s.status === "not-configured").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your website configuration and preferences</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Zap className="h-4 w-4 mr-2" />
            Quick Setup
          </Button>
          <Button variant="outline">
            <Database className="h-4 w-4 mr-2" />
            Backup
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Settings</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{settingSections.length}</div>
            <p className="text-xs text-muted-foreground">
              Configuration sections
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Configured</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{configuredCount}</div>
            <p className="text-xs text-muted-foreground">
              Ready to use
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partial</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{partialCount}</div>
            <p className="text-xs text-muted-foreground">
              Needs attention
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Configured</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{notConfiguredCount}</div>
            <p className="text-xs text-muted-foreground">
              Requires setup
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search settings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSections.map((section) => (
          <Card key={section.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {section.icon}
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(section.status)}
                  {section.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {section.badge}
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription className="text-sm">
                {section.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Badge className={getStatusColor(section.status)}>
                      {section.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={10} />
                    Last updated: {section.lastUpdated}
                  </div>
                </div>
                <Link href={section.href}>
                  <Button size="sm">
                    Configure
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common administrative tasks and utilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Shield className="h-6 w-6" />
              <span className="text-sm">Security Audit</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <BarChart className="h-6 w-6" />
              <span className="text-sm">Performance</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Users className="h-6 w-6" />
              <span className="text-sm">User Management</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <FileText className="h-6 w-6" />
              <span className="text-sm">System Logs</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>
            Current system health and configuration status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Database Connection</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600">Healthy</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email Service</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-xs text-yellow-600">Partial</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">File Storage</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600">Healthy</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cache Status</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600">Active</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">API Rate Limit</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600">Normal</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">SSL Certificate</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600">Valid</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
