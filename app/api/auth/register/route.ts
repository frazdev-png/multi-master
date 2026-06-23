import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const role = (formData.get("role") as string) || "customer"
    const fullName = formData.get("fullName") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!fullName || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000"

    // Proxy the raw FormData (with files) directly to PHP backend
    // PHP handles field name mapping (camelCase <-> snake_case) and file uploads
    const apiResponse = await fetch(`${apiBaseUrl}/api/auth/register`, {
      method: "POST",
      body: formData,
    })

    const data = await apiResponse.json().catch(() => null)

    if (!apiResponse.ok || !data?.success) {
      return NextResponse.json({ error: data?.error || "Registration failed" }, { status: apiResponse.status || 500 })
    }

    const res = NextResponse.json(
      {
        success: true,
        role: data.user?.role || role,
        email: data.user?.email || email,
        message: data.message || "Registration successful",
      },
      { status: 201 },
    )

    if (data.token) {
      res.cookies.set("auth_token", data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      })
      res.cookies.set("user_role", data.user?.role || role, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      })
      res.cookies.set("user_email", email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      })
    }

    return res
  } catch (error) {
    console.log("[v0] Register error:", error)
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
