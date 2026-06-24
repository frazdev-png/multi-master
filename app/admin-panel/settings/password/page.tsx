"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ChangePasswordPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const passwordChecks = {
    minLength: form.new_password.length >= 8,
    hasUpper: /[A-Z]/.test(form.new_password),
    hasLower: /[a-z]/.test(form.new_password),
    hasNumber: /[0-9]/.test(form.new_password),
    match: form.new_password === form.confirm_password && form.confirm_password.length > 0,
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!form.current_password || !form.new_password || !form.confirm_password) {
      setError("All fields are required")
      return
    }

    if (form.new_password !== form.confirm_password) {
      setError("New password and confirm password do not match")
      return
    }

    if (!Object.values(passwordChecks).every(Boolean)) {
      setError("Password does not meet strength requirements")
      return
    }

    try {
      setIsLoading(true)
      const res = await fetch("/api/backend/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: form.current_password,
          new_password: form.new_password,
          confirm_password: form.confirm_password,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to change password")
      }

      setSuccess("Password updated successfully")

      // Clear all auth cookies and redirect to admin login
      setTimeout(() => {
        fetch("/api/auth/logout", { method: "POST" }).finally(() => {
          router.push("/auth/admin-login")
        })
      }, 2000)
    } catch (e: any) {
      setError(e?.message || "Failed to change password")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Change Password</h1>
        <p className="text-muted-foreground mt-1">Update your admin account password</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Change Password
          </CardTitle>
          <CardDescription>
            Your password must be at least 8 characters with uppercase, lowercase, and a number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current Password */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">Current Password</label>
              <div className="relative">
                <Input
                  type={showPasswords.current ? "text" : "password"}
                  value={form.current_password}
                  onChange={(e) => setForm({ ...form, current_password: e.target.value })}
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                >
                  {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">New Password</label>
              <div className="relative">
                <Input
                  type={showPasswords.new ? "text" : "password"}
                  value={form.new_password}
                  onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                >
                  {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength indicators */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  {passwordChecks.minLength ? <CheckCircle size={12} className="text-green-500" /> : <AlertCircle size={12} className="text-muted-foreground" />}
                  <span className={passwordChecks.minLength ? "text-green-600" : "text-muted-foreground"}>At least 8 characters</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordChecks.hasUpper ? <CheckCircle size={12} className="text-green-500" /> : <AlertCircle size={12} className="text-muted-foreground" />}
                  <span className={passwordChecks.hasUpper ? "text-green-600" : "text-muted-foreground"}>Uppercase letter</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordChecks.hasLower ? <CheckCircle size={12} className="text-green-500" /> : <AlertCircle size={12} className="text-muted-foreground" />}
                  <span className={passwordChecks.hasLower ? "text-green-600" : "text-muted-foreground"}>Lowercase letter</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordChecks.hasNumber ? <CheckCircle size={12} className="text-green-500" /> : <AlertCircle size={12} className="text-muted-foreground" />}
                  <span className={passwordChecks.hasNumber ? "text-green-600" : "text-muted-foreground"}>Number</span>
                </div>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Input
                  type={showPasswords.confirm ? "text" : "password"}
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                >
                  {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.confirm_password && (
                <p className={`text-xs mt-1.5 flex items-center gap-1 ${passwordChecks.match ? "text-green-600" : "text-red-500"}`}>
                  {passwordChecks.match ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                  {passwordChecks.match ? "Passwords match" : "Passwords do not match"}
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">{error}</div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500" />
                {success}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Password"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              After update, you will be logged out from all sessions. Please sign in again with your new password.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
