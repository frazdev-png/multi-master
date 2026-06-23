"use client"

import type React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Mail, Lock, Eye, EyeOff, User, Phone, Store, FileText, AlertCircle, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/contexts/RealtimeContext"

function RegisterPageInner() {
  const { settings } = useRealtime()
  const searchParams = useSearchParams()
  const roleParam = searchParams.get("role") || "customer"
  const [role, setRole] = useState<"customer" | "seller">(roleParam as "customer" | "seller")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    mobileNumber: "",
    storeName: "",
    promoCode: "",
    password: "",
    confirmPassword: "",
    documentType: "identity-card" as "identity-card" | "driving-license" | "passport",
    idFrontImage: null as File | null,
    idBackImage: null as File | null,
    passportImage: null as File | null,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: "idFrontImage" | "idBackImage" | "passportImage") => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData((prev) => ({ ...prev, [field]: file }))
    }
  }

  const handleDocumentTypeChange = (value: "identity-card" | "driving-license" | "passport") => {
    setFormData((prev) => ({ 
      ...prev, 
      documentType: value,
      idFrontImage: null,
      idBackImage: null,
      passportImage: null
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Validate form
      if (role === "seller") {
        if (!formData.username?.trim()) {
          setError("Username is required")
          return
        }
        if (formData.username.length < 3) {
          setError("Username must be at least 3 characters")
          return
        }
        if (!formData.storeName?.trim()) {
          setError("Store name is required")
          return
        }
        if (!formData.mobileNumber?.trim()) {
          setError("Mobile number is required")
          return
        }
        if (formData.promoCode?.trim() && !/^\d{4}$/.test(formData.promoCode.trim())) {
          setError("Promo code must be exactly 4 digits")
          return
        }
      }

      if (formData.password.length < 8) {
        setError("Password must be at least 8 characters")
        return
      }

      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match")
        return
      }

      // Create FormData for file upload
      const submitData = new FormData()
      submitData.append("role", role)
      submitData.append("fullName", formData.fullName)
      submitData.append("email", formData.email)
      submitData.append("password", formData.password)

      if (role === "seller") {
        submitData.append("username", formData.username)
        submitData.append("mobileNumber", formData.mobileNumber)
        submitData.append("storeName", formData.storeName)
        submitData.append("promoCode", formData.promoCode)
        submitData.append("documentType", formData.documentType)
        if (formData.idFrontImage) submitData.append("idFrontImage", formData.idFrontImage)
        if (formData.idBackImage) submitData.append("idBackImage", formData.idBackImage)
        if (formData.passportImage) submitData.append("passportImage", formData.passportImage)
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        body: submitData,
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Registration failed")
        setIsLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push(`/auth/login?role=${role}`)
      }, 2000)
    } catch (err) {
      setError("An error occurred. Please try again.")
      console.log("[v0] Register error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-primary mb-4 inline-block">
            {settings.website_name || "Sell1Mall"}
          </Link>
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-muted-foreground mt-2">
            Join our community as {role === "seller" ? "a seller" : "a customer"}
          </p>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            type="button"
            onClick={() => setRole("customer")}
            className={`flex-1 py-3 rounded-lg border-2 transition-colors font-medium ${
              role === "customer"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-foreground hover:border-primary"
            }`}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => setRole("seller")}
            className={`flex-1 py-3 rounded-lg border-2 transition-colors font-medium ${
              role === "seller"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-foreground hover:border-primary"
            }`}
          >
            Seller
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-card rounded-xl p-8 max-w-sm w-full shadow-2xl text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle size={36} className="text-green-600" />
              </div>
              <h3 className="text-lg font-bold">Account Created!</h3>
              <p className="text-muted-foreground">Signup successful. Please login to continue.</p>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="text"
                name="fullName"
                placeholder="John Doe"
                className="input pl-10 w-full"
                required
                value={formData.fullName}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {role === "seller" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Username</label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                    size={18}
                  />
                  <input
                    type="text"
                    name="username"
                    placeholder="your_username"
                    className="input pl-10 w-full"
                    required
                    value={formData.username}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Store Name</label>
                <div className="relative">
                  <Store
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                    size={18}
                  />
                  <input
                    type="text"
                    name="storeName"
                    placeholder="Your Store Name"
                    className="input pl-10 w-full"
                    required
                    value={formData.storeName}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Mobile Number</label>
                <div className="relative">
                  <Phone
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                    size={18}
                  />
                  <input
                    type="tel"
                    name="mobileNumber"
                    placeholder="+1 (555) 000-0000"
                    className="input pl-10 w-full"
                    required
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Document Type</label>
                <select
                  value={formData.documentType}
                  onChange={(e) => handleDocumentTypeChange(e.target.value as "identity-card" | "driving-license" | "passport")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                >
                  <option value="identity-card">Identity Card</option>
                  <option value="driving-license">Driving License</option>
                  <option value="passport">Passport</option>
                </select>
              </div>

              {formData.documentType === "passport" ? (
                <div>
                  <label className="block text-sm font-medium mb-2">Passport Image</label>
                  <div className="relative border-2 border-dashed border-border rounded-lg p-3 hover:border-primary transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => handleFileChange(e, "passportImage")}
                    />
                    <div className="text-center">
                      <FileText size={24} className="mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">
                        {formData.passportImage ? formData.passportImage.name : "Click to upload passport"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {formData.documentType === "identity-card" ? "ID Front Image" : "License Front Image"}
                    </label>
                    <div className="relative border-2 border-dashed border-border rounded-lg p-3 hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => handleFileChange(e, "idFrontImage")}
                      />
                      <div className="text-center">
                        <FileText size={24} className="mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">
                          {formData.idFrontImage ? formData.idFrontImage.name : "Click to upload front"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {formData.documentType === "identity-card" ? "ID Back Image" : "License Back Image"}
                    </label>
                    <div className="relative border-2 border-dashed border-border rounded-lg p-3 hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => handleFileChange(e, "idBackImage")}
                      />
                      <div className="text-center">
                        <FileText size={24} className="mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">
                          {formData.idBackImage ? formData.idBackImage.name : "Click to upload back"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Promo Code (4 digits)</label>
                <input
                  type="text"
                  name="promoCode"
                  placeholder="0000"
                  className="input w-full text-center tracking-widest text-lg"
                  maxLength={4}
                  pattern="\d{4}"
                  value={formData.promoCode}
                  onChange={handleInputChange}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  If a seller creates a store using a promo code, the store creation will be completely free and no guarantee money will be required.
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="email"
                name="email"
                placeholder="your@email.com"
                className="input pl-10 w-full"
                required
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                className="input pl-10 pr-10 w-full"
                required
                value={formData.password}
                onChange={handleInputChange}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="••••••••"
                className="input pl-10 pr-10 w-full"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 mt-4">
            <input type="checkbox" className="w-4 h-4" required />
            <span className="text-sm text-muted-foreground">
              I agree to the{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms & Conditions
              </Link>
            </span>
          </label>

          <button type="submit" disabled={isLoading} className="btn-primary w-full mt-6">
            {isLoading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href={`/auth/login?role=${role}`} className="text-primary hover:underline font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageInner />
    </Suspense>
  )
}
