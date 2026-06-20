"use client"

import { useEffect, useMemo, useState } from "react"
import { SellerSidebar } from "@/components/seller/sidebar"
import { SellerHeader } from "@/components/seller/header"
import { Save, Upload, Eye, EyeOff, Mail, Phone, MapPin, Globe, CreditCard, Bell, Shield, Palette, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface StoreSettings {
  storeName: string
  storeEmail: string
  storePhone: string
  storeAddress: string
  storeDescription: string
  storeLogo: string
  storeBanner: string
  businessType: string
  taxId: string
  panNumber: string
  gstNumber: string
}

interface NotificationSettings {
  emailNotifications: boolean
  smsNotifications: boolean
  orderUpdates: boolean
  customerMessages: boolean
  promotionalEmails: boolean
  lowStockAlerts: boolean
  newOrderAlerts: boolean
  reviewNotifications: boolean
}

interface PaymentSettings {
  bankName: string
  accountNumber: string
  ifscCode: string
  accountHolderName: string
  upiId: string
  paymentMethods: string[]
}

export default function SellerSettingsPage() {
  const [activeTab, setActiveTab] = useState("profile")
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [saveSuccess, setSaveSuccess] = useState("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    phone: "",
    avatarUrl: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    storeName: "",
    storeEmail: "",
    storePhone: "",
    storeAddress: "",
    storeDescription: "",
    storeLogo: "",
    storeBanner: "",
    businessType: "individual",
    taxId: "",
    panNumber: "",
    gstNumber: "",
  })

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: false,
    orderUpdates: true,
    customerMessages: true,
    promotionalEmails: false,
    lowStockAlerts: true,
    newOrderAlerts: true,
    reviewNotifications: true
  })

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    upiId: "",
    paymentMethods: ["bank_transfer", "upi", "cod"],
  })

  const username = useMemo(() => {
    const email = profile.email || storeSettings.storeEmail
    if (!email || typeof email !== "string") return ""
    const idx = email.indexOf("@")
    if (idx <= 0) return email
    return email.slice(0, idx)
  }, [profile.email, storeSettings.storeEmail])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setIsLoading(true)
        setPageError("")
        const res = await fetch("/api/backend/auth/me")
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load settings")
        }

        const u = data?.user
        if (!u) {
          throw new Error("Failed to load settings")
        }

        if (cancelled) return

        setProfile((p) => ({
          ...p,
          fullName: u.full_name || "",
          email: u.email || "",
          phone: u.phone || "",
          avatarUrl: u.avatar_url || "",
        }))

        setStoreSettings((s) => ({
          ...s,
          storeName: u.store_name || "",
          storeEmail: u.email || "",
          storePhone: u.phone || "",
          storeAddress: u.store_address || "",
          storeDescription: u.business_name || "",
          taxId: u.tax_number || "",
        }))

        setPaymentSettings((ps) => ({
          ...ps,
          bankName: u.bank_name || "",
          accountNumber: u.account_number || "",
          accountHolderName: u.account_holder_name || "",
        }))
      } catch (e: any) {
        if (!cancelled) setPageError(e?.message || "Failed to load settings")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const putProfile = async (payload: Record<string, any>) => {
    setIsLoading(true)
    setSaveError("")
    setSaveSuccess("")
    try {
      const res = await fetch("/api/backend/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Failed to save")
      }

      setSaveSuccess("Saved")

      const u = data?.user
      if (u) {
        setProfile((p) => ({
          ...p,
          fullName: u.full_name || "",
          email: u.email || "",
          phone: u.phone || "",
          avatarUrl: u.avatar_url || "",
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }))

        setStoreSettings((s) => ({
          ...s,
          storeName: u.store_name || "",
          storeEmail: u.email || "",
          storePhone: u.phone || "",
          storeAddress: u.store_address || "",
          storeDescription: u.business_name || "",
          taxId: u.tax_number || "",
        }))

        setPaymentSettings((ps) => ({
          ...ps,
          bankName: u.bank_name || "",
          accountNumber: u.account_number || "",
          accountHolderName: u.account_holder_name || "",
        }))
      }
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveStoreSettings = () => {
    return putProfile({
      store_name: storeSettings.storeName,
      store_address: storeSettings.storeAddress,
      tax_number: storeSettings.taxId,
      business_name: storeSettings.storeDescription,
    })
  }

  const handleSaveNotifications = () => {
    setSaveError("Notification settings are not supported yet")
  }

  const handleSavePayments = () => {
    return putProfile({
      bank_name: paymentSettings.bankName,
      account_number: paymentSettings.accountNumber,
      account_holder_name: paymentSettings.accountHolderName,
    })
  }

  const handlePasswordChange = async () => {
    if (!profile.currentPassword || !profile.newPassword) {
      setSaveError("Current password and new password are required")
      return
    }
    if (profile.newPassword !== profile.confirmPassword) {
      setSaveError("New passwords do not match")
      return
    }
    await putProfile({
      current_password: profile.currentPassword,
      password: profile.newPassword,
    })
  }

  const handleSaveProfile = () => {
    return putProfile({
      full_name: profile.fullName,
      phone: profile.phone,
    })
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((v) => !v)
  }

  return (
    <div className="flex bg-background">
      <SellerSidebar isMobileMenuOpen={isMobileMenuOpen} onMobileMenuClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col">
        <SellerHeader onMobileMenuToggle={toggleMobileMenu} isMobileMenuOpen={isMobileMenuOpen} />

        <main className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">Manage your store settings and preferences</p>
          </div>

          {pageError ? (
            <div className="mb-6 rounded-lg border border-border bg-muted p-4 text-sm text-destructive">
              {pageError}
            </div>
          ) : null}

          {saveError ? (
            <div className="mb-6 rounded-lg border border-border bg-muted p-4 text-sm text-destructive">
              {saveError}
            </div>
          ) : null}

          {saveSuccess ? (
            <div className="mb-6 rounded-lg border border-border bg-muted p-4 text-sm">
              {saveSuccess}
            </div>
          ) : null}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="store">Store</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            {/* Profile Settings */}
            <TabsContent value="profile">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Personal Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="fullName">Full Name</Label>
                          <Input
                            id="fullName"
                            value={profile.fullName}
                            onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email Address</Label>
                          <Input id="email" type="email" value={profile.email} readOnly />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            value={profile.phone}
                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="username">Username</Label>
                          <Input id="username" value={username} readOnly />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea id="bio" placeholder="Tell customers about yourself..." rows={3} />
                      </div>
                      <Button onClick={handleSaveProfile} disabled={isLoading}>
                        {isLoading ? "Saving..." : "Save Changes"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Change Password</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="currentPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter current password"
                            value={profile.currentPassword}
                            onChange={(e) => setProfile({ ...profile, currentPassword: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="newPassword">New Password</Label>
                        <div className="relative">
                          <Input
                            id="newPassword"
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            value={profile.newPassword}
                            onChange={(e) => setProfile({ ...profile, newPassword: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="Confirm new password"
                          value={profile.confirmPassword}
                          onChange={(e) => setProfile({ ...profile, confirmPassword: e.target.value })}
                        />
                      </div>
                      <Button onClick={handlePasswordChange}>Update Password</Button>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Profile Picture</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col items-center">
                        <Avatar className="h-24 w-24 mb-4">
                          <AvatarImage src={profile.avatarUrl || "/images/seller-avatar.jpg"} />
                          <AvatarFallback>{(profile.fullName || "U").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <Button variant="outline" className="w-full">
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Photo
                        </Button>
                        <p className="text-sm text-muted-foreground">JPG, PNG or GIF. Max 2MB</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Store Settings */}
            <TabsContent value="store">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="storeName">Store Name</Label>
                      <Input
                        id="storeName"
                        value={storeSettings.storeName}
                        onChange={(e) => setStoreSettings({...storeSettings, storeName: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="storeEmail">Store Email</Label>
                      <Input
                        id="storeEmail"
                        type="email"
                        value={storeSettings.storeEmail}
                        onChange={(e) => setStoreSettings({...storeSettings, storeEmail: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="storePhone">Store Phone</Label>
                      <Input
                        id="storePhone"
                        value={storeSettings.storePhone}
                        onChange={(e) => setStoreSettings({...storeSettings, storePhone: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="storeAddress">Store Address</Label>
                      <Textarea
                        id="storeAddress"
                        value={storeSettings.storeAddress}
                        onChange={(e) => setStoreSettings({...storeSettings, storeAddress: e.target.value})}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="storeDescription">Store Description</Label>
                      <Textarea
                        id="storeDescription"
                        value={storeSettings.storeDescription}
                        onChange={(e) => setStoreSettings({...storeSettings, storeDescription: e.target.value})}
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Business Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="businessType">Business Type</Label>
                      <Select value={storeSettings.businessType} onValueChange={(value) => setStoreSettings({...storeSettings, businessType: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="individual">Individual</SelectItem>
                          <SelectItem value="partnership">Partnership</SelectItem>
                          <SelectItem value="company">Private Limited Company</SelectItem>
                          <SelectItem value="llp">LLP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="panNumber">PAN Number</Label>
                      <Input
                        id="panNumber"
                        value={storeSettings.panNumber}
                        onChange={(e) => setStoreSettings({...storeSettings, panNumber: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="gstNumber">GST Number</Label>
                      <Input
                        id="gstNumber"
                        value={storeSettings.gstNumber}
                        onChange={(e) => setStoreSettings({...storeSettings, gstNumber: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxId">Tax ID</Label>
                      <Input
                        id="taxId"
                        value={storeSettings.taxId}
                        onChange={(e) => setStoreSettings({...storeSettings, taxId: e.target.value})}
                      />
                    </div>
                    <Button onClick={handleSaveStoreSettings} disabled={isLoading}>
                      {isLoading ? "Saving..." : "Save Store Settings"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Payment Settings */}
            <TabsContent value="payments">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Bank Account Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        id="bankName"
                        value={paymentSettings.bankName}
                        onChange={(e) => setPaymentSettings({...paymentSettings, bankName: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="accountHolder">Account Holder Name</Label>
                      <Input
                        id="accountHolder"
                        value={paymentSettings.accountHolderName}
                        onChange={(e) => setPaymentSettings({...paymentSettings, accountHolderName: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        id="accountNumber"
                        value={paymentSettings.accountNumber}
                        onChange={(e) => setPaymentSettings({...paymentSettings, accountNumber: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ifscCode">IFSC Code</Label>
                      <Input
                        id="ifscCode"
                        value={paymentSettings.ifscCode}
                        onChange={(e) => setPaymentSettings({...paymentSettings, ifscCode: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="upiId">UPI ID</Label>
                      <Input
                        id="upiId"
                        value={paymentSettings.upiId}
                        onChange={(e) => setPaymentSettings({...paymentSettings, upiId: e.target.value})}
                      />
                    </div>
                    <Button onClick={handleSavePayments} disabled={isLoading}>
                      {isLoading ? "Saving..." : "Save Payment Settings"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Payment Methods</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Bank Transfer</p>
                          <p className="text-sm text-muted-foreground">Direct bank transfers</p>
                        </div>
                        <Switch 
                          checked={paymentSettings.paymentMethods.includes("bank_transfer")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPaymentSettings({...paymentSettings, paymentMethods: [...paymentSettings.paymentMethods, "bank_transfer"]})
                            } else {
                              setPaymentSettings({...paymentSettings, paymentMethods: paymentSettings.paymentMethods.filter(m => m !== "bank_transfer")})
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">UPI Payments</p>
                          <p className="text-sm text-muted-foreground">UPI based payments</p>
                        </div>
                        <Switch 
                          checked={paymentSettings.paymentMethods.includes("upi")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPaymentSettings({...paymentSettings, paymentMethods: [...paymentSettings.paymentMethods, "upi"]})
                            } else {
                              setPaymentSettings({...paymentSettings, paymentMethods: paymentSettings.paymentMethods.filter(m => m !== "upi")})
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Cash on Delivery</p>
                          <p className="text-sm text-muted-foreground">COD payments</p>
                        </div>
                        <Switch 
                          checked={paymentSettings.paymentMethods.includes("cod")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPaymentSettings({...paymentSettings, paymentMethods: [...paymentSettings.paymentMethods, "cod"]})
                            } else {
                              setPaymentSettings({...paymentSettings, paymentMethods: paymentSettings.paymentMethods.filter(m => m !== "cod")})
                            }
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-medium">General Notifications</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Email Notifications</p>
                          <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                        </div>
                        <Switch 
                          checked={notificationSettings.emailNotifications}
                          onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, emailNotifications: checked})}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">SMS Notifications</p>
                          <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
                        </div>
                        <Switch 
                          checked={notificationSettings.smsNotifications}
                          onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, smsNotifications: checked})}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium">Order Notifications</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Order Updates</p>
                          <p className="text-sm text-muted-foreground">Get notified about order status changes</p>
                        </div>
                        <Switch 
                          checked={notificationSettings.orderUpdates}
                          onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, orderUpdates: checked})}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">New Order Alerts</p>
                          <p className="text-sm text-muted-foreground">Instant alerts for new orders</p>
                        </div>
                        <Switch 
                          checked={notificationSettings.newOrderAlerts}
                          onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, newOrderAlerts: checked})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-medium">Customer Communications</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Customer Messages</p>
                          <p className="text-sm text-muted-foreground">New customer inquiries</p>
                        </div>
                        <Switch 
                          checked={notificationSettings.customerMessages}
                          onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, customerMessages: checked})}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Review Notifications</p>
                          <p className="text-sm text-muted-foreground">New product reviews</p>
                        </div>
                        <Switch 
                          checked={notificationSettings.reviewNotifications}
                          onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, reviewNotifications: checked})}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium">Marketing</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Promotional Emails</p>
                          <p className="text-sm text-muted-foreground">Marketing and promotional emails</p>
                        </div>
                        <Switch 
                          checked={notificationSettings.promotionalEmails}
                          onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, promotionalEmails: checked})}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Low Stock Alerts</p>
                          <p className="text-sm text-muted-foreground">When products run low on stock</p>
                        </div>
                        <Switch 
                          checked={notificationSettings.lowStockAlerts}
                          onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, lowStockAlerts: checked})}
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSaveNotifications} disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Notification Settings"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Settings */}
            <TabsContent value="security">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Two-Factor Authentication</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Enable 2FA</p>
                        <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                      </div>
                      <Switch />
                    </div>
                    <Button variant="outline">Configure 2FA</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Active Sessions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Chrome on Windows</p>
                          <p className="text-sm text-muted-foreground">Current session • Delhi, India</p>
                        </div>
                        <Badge variant="default">Active</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Mobile App</p>
                          <p className="text-sm text-muted-foreground">2 hours ago • Mumbai, India</p>
                        </div>
                        <Button variant="outline" size="sm">Terminate</Button>
                      </div>
                    </div>
                    <Button variant="destructive" className="w-full">
                      Sign Out All Devices
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
