import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const apiBaseUrl = "http://127.0.0.1:8000"

    let apiResponse: Response
    try {
      apiResponse = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })
    } catch {
      return NextResponse.json(
        { error: `Backend unavailable. Start PHP API server at ${apiBaseUrl}` },
        { status: 503 },
      )
    }

    const rawBody = await apiResponse.text()
    let data: any = null
    try {
      data = JSON.parse(rawBody)
    } catch {
      data = null
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Backend returned a non-JSON response. This usually means the PHP API crashed or printed warnings (missing vendor/autoload.php, DB config, etc).",
          status: apiResponse.status,
          responseSnippet: rawBody.slice(0, 300),
        },
        { status: 502 },
      )
    }

    if (apiResponse.status === 404) {
      return NextResponse.json(
        {
          error:
            data?.error ||
            `PHP backend route not found at ${apiBaseUrl}/api/auth/login. Verify XAMPP path + .htaccess rewrite.`,
        },
        { status: 503 },
      )
    }

    if (!apiResponse.ok || !data?.success) {
      return NextResponse.json({ error: data?.error || "Login failed" }, { status: apiResponse.status || 500 })
    }

    const token = data.token as string
    const user = data.user as { email: string; role: string; full_name?: string; fullName?: string; store_name?: string; storeName?: string }

    const response = NextResponse.json({
      success: true,
      user: {
        email: user.email,
        role: user.role,
        fullName: user.full_name || user.fullName,
        storeName: (user as any).store_name || (user as any).storeName,
      },
      message: data.message || "Login successful",
    })

    // Set authentication cookies
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/"
    })

    response.cookies.set("user_role", user.role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/"
    })

    response.cookies.set("user_email", email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/"
    })

    if (user.role === "admin") {
      response.cookies.set("admin_token", token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      })

      response.cookies.set("admin_email", email, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      })
    } else {
      response.cookies.set("admin_token", "", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      })

      response.cookies.set("admin_email", "", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      })
    }

    return response

  } catch (error) {
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
