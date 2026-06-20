"use client"

import { Save, Upload } from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRealtime } from "@/contexts/RealtimeContext"

interface GeneralSettings {
  websiteName: string;
  tagline: string;
  currency: string;
  timezone: string;
  email: string;
  phone: string;
  address: string;
  refundPolicy: string;
  returnPolicy: string;
  termsConditions: string;
  logo: File | null;
  favicon: File | null;
}

export default function GeneralSettings() {
  const { settings: realtimeSettings, updateSettings, isConnected } = useRealtime()
  const [settings, setSettings] = useState<GeneralSettings>({
    websiteName: "",
    tagline: "",
    currency: "USDT",
    timezone: "UTC",
    email: "",
    phone: "",
    address: "",
    refundPolicy: "",
    returnPolicy: "",
    termsConditions: "",
    logo: null,
    favicon: null
  })

  // Load settings from database when component mounts
  useEffect(() => {
    if (realtimeSettings.website_name) {
      setSettings(prev => ({
        ...prev,
        websiteName: realtimeSettings.website_name || "",
        tagline: realtimeSettings.tagline || "",
        currency: realtimeSettings.currency || "USDT",
        timezone: realtimeSettings.timezone || "UTC",
        email: realtimeSettings.email || "",
        phone: realtimeSettings.phone || "",
        address: realtimeSettings.address || "",
        refundPolicy: realtimeSettings.refund_policy || "",
        returnPolicy: realtimeSettings.return_policy || "",
        termsConditions: realtimeSettings.terms_conditions || ""
      }))
    }
  }, [realtimeSettings])

  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")

  const uploadAsset = async (type: "logo" | "favicon", file: File) => {
    const formData = new FormData()
    formData.append("type", type)
    formData.append("file", file)

    const res = await fetch("/api/backend/settings/upload", {
      method: "POST",
      body: formData,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success || !data?.url) {
      throw new Error(data?.message || data?.error || "Failed to upload file")
    }
    return String(data.url)
  }

  const handleInputChange = (field: keyof GeneralSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = (field: 'logo' | 'favicon', file: File) => {
    setSettings(prev => ({ ...prev, [field]: file }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage("")
    
    // Update real-time settings with database field names
    const realtimeUpdate: any = {
      website_name: settings.websiteName,
      tagline: settings.tagline,
      currency: settings.currency,
      timezone: settings.timezone,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
      refund_policy: settings.refundPolicy,
      return_policy: settings.returnPolicy,
      terms_conditions: settings.termsConditions
    }

    try {
      if (settings.logo) {
        realtimeUpdate.logo_url = await uploadAsset("logo", settings.logo)
      }
      if (settings.favicon) {
        realtimeUpdate.favicon_url = await uploadAsset("favicon", settings.favicon)
      }

      // Send real-time update
      updateSettings(realtimeUpdate)

      setSaveMessage(`Settings saved successfully! ${isConnected ? "(Real-time updates enabled)" : "(Real-time disconnected)"}`)
      setSettings((prev) => ({
        ...prev,
        logo: null,
        favicon: null,
      }))
    } catch (e: any) {
      setSaveMessage(e?.message || "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
    setTimeout(() => setSaveMessage(""), 3000)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload('logo', file)
  }

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload('favicon', file)
  }
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">General Settings</h1>
          <p className="text-muted-foreground mt-1">Configure website-wide settings</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
          isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}></div>
          {isConnected ? 'Real-time Connected' : 'Real-time Disconnected'}
        </div>
      </div>

      {saveMessage && (
        <div className="bg-green-100 text-green-800 p-4 rounded-md">
          {saveMessage}
        </div>
      )}

      {/* Logo & Branding */}
      <Card>
        <CardHeader>
          <CardTitle>Logo & Branding</CardTitle>
          <CardDescription>Upload your website logo and favicon</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Website Logo</label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <label htmlFor="logo-upload" className="cursor-pointer">
                  <Upload size={32} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm">
                    {settings.logo
                      ? settings.logo.name
                      : realtimeSettings.logo_url
                        ? "Current logo is set"
                        : "Click to upload logo"}
                  </p>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Favicon</label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFaviconUpload}
                  className="hidden"
                  id="favicon-upload"
                />
                <label htmlFor="favicon-upload" className="cursor-pointer">
                  <Upload size={32} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm">
                    {settings.favicon
                      ? settings.favicon.name
                      : realtimeSettings.favicon_url
                        ? "Current favicon is set"
                        : "Click to upload favicon"}
                  </p>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Website Info */}
      <Card>
        <CardHeader>
          <CardTitle>Website Information</CardTitle>
          <CardDescription>Basic information about your website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Website Name</label>
            <Input
              type="text"
              value={settings.websiteName}
              onChange={(e) => handleInputChange('websiteName', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tagline</label>
            <Input
              type="text"
              value={settings.tagline}
              onChange={(e) => handleInputChange('tagline', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Currency</label>
              <Select value={settings.currency} onValueChange={(value) => handleInputChange('currency', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDT">USDT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Timezone</label>
              <Select value={settings.timezone} onValueChange={(value) => handleInputChange('timezone', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="EST">EST</SelectItem>
                  <SelectItem value="PST">PST</SelectItem>
                  <SelectItem value="IST">IST</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Contact details for your website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input
              type="email"
              value={settings.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone</label>
            <Input
              type="tel"
              value={settings.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Address</label>
            <Textarea
              value={settings.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Policies & Terms</CardTitle>
          <CardDescription>Legal policies for your website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Refund Policy</label>
            <Textarea
              value={settings.refundPolicy}
              onChange={(e) => handleInputChange('refundPolicy', e.target.value)}
              placeholder="Enter refund policy..."
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Return Policy</label>
            <Textarea
              value={settings.returnPolicy}
              onChange={(e) => handleInputChange('returnPolicy', e.target.value)}
              placeholder="Enter return policy..."
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Terms & Conditions</label>
            <Textarea
              value={settings.termsConditions}
              onChange={(e) => handleInputChange('termsConditions', e.target.value)}
              placeholder="Enter terms and conditions..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save size={18} className="mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
