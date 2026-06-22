import { type NextRequest, NextResponse } from "next/server"

async function uploadFile(file: File, apiBaseUrl: string): Promise<string | null> {
  try {
    const fd = new FormData()
    fd.append("type", "document")
    fd.append("file", file)
    const res = await fetch(`${apiBaseUrl}/api/settings/upload`, {
      method: "POST",
      body: fd,
    })
    const data = await res.json()
    if (data?.success && data?.url) return data.url
    return null
  } catch {
    return null
  }
}

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

    const payload: any = {
      email,
      password,
      role,
      full_name: fullName,
    }

    if (role === "seller") {
      const storeName = formData.get("storeName") as string
      const promoCode = (formData.get("promoCode") as string) || ""
      const mobileNumber = formData.get("mobileNumber") as string
      const username = formData.get("username") as string
      const documentType = (formData.get("documentType") as string) || "identity-card"

      payload.phone = mobileNumber

      payload.business_name = storeName || username || "Seller Business"
      payload.store_name = storeName || username || `store_${Date.now()}`
      payload.cnic_number = username || `${Date.now()}`
      payload.promo_code = promoCode
      payload.document_type = documentType

      // Upload document images
      const idFrontFile = formData.get("idFrontImage") as File | null
      const idBackFile = formData.get("idBackImage") as File | null
      const passportFile = formData.get("passportImage") as File | null

      if (idFrontFile?.size && idFrontFile.size > 0) {
        payload.id_front_image_url = await uploadFile(idFrontFile, apiBaseUrl)
      }
      if (idBackFile?.size && idBackFile.size > 0) {
        payload.id_back_image_url = await uploadFile(idBackFile, apiBaseUrl)
      }
      if (passportFile?.size && passportFile.size > 0) {
        payload.id_front_image_url = await uploadFile(passportFile, apiBaseUrl)
      }
    }

    const apiResponse = await fetch(`${apiBaseUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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
