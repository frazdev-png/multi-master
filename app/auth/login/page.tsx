"use client"

import type React from "react"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useRealtime } from "@/contexts/RealtimeContext"

function LoginPageInner() {
  const { settings } = useRealtime()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get role from URL params for context
  const role = searchParams.get("role") || ""

  useEffect(() => {
    let cancelled = false

    const checkSession = async () => {
      try {
        const res = await fetch("/api/backend/auth/me")
        const data = await res.json().catch(() => null)

        if (cancelled) return
        if (!res.ok || !data?.user?.role) return

        const currentRole = String(data.user.role || "")
        const wantedRole = role ? String(role) : ""

        if (wantedRole && currentRole && wantedRole !== currentRole) {
          return
        }

        if (currentRole === "seller") {
          router.push("/seller")
        } else if (currentRole === "admin") {
          router.push("/admin-panel")
        } else {
          router.push("/customer")
        }
      } catch {
        // Ignore - user is not logged in or backend is unavailable
      }
    }

    checkSession()
    return () => {
      cancelled = true
    }
  }, [router, role])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Login failed")
        setIsLoading(false)
        return
      }

      setSuccess(true)
      
      // Redirect based on user role after successful login
      setTimeout(() => {
        if (data.user.role === "seller") {
          router.push("/seller")
        } else if (data.user.role === "admin") {
          router.push("/admin-panel")
        } else {
          router.push("/customer")
        }
      }, 1500)

    } catch (err) {
      setError("An error occurred. Please try again.")
      console.log("[v0] Login error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-primary mb-4 inline-block">
            {settings.website_name || "Sell1Mall"}
          </Link>
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to your {role ? `${role} ` : ""}account
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
            <CheckCircle size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 dark:text-green-400 text-sm">Login successful! Redirecting...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                disabled={isLoading || success}
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
                disabled={isLoading || success}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={isLoading || success}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4" disabled={isLoading || success} />
              <span className="text-sm">Remember me</span>
            </label>
            <Link href="#" className="text-sm text-primary hover:underline">
              Forgot Password?
            </Link>
          </div>

          <button type="submit" disabled={isLoading || success} className="btn-primary w-full mt-6">
            {isLoading ? "Signing in..." : success ? "Success!" : "Sign In"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-background text-muted-foreground">Or</span>
          </div>
        </div>

        <button className="w-full btn-secondary mb-4" disabled={isLoading || success}>
          Continue with Google
        </button>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href={`/auth/register?role=${role || "customer"}`} className="text-primary hover:underline font-medium">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
