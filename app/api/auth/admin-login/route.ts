import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000"

    let apiResponse: Response
    try {
      apiResponse = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

    if (data?.user?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const token = data.token as string

    const response = NextResponse.json(
      {
        success: true,
        token,
        email,
        message: data.message || "Admin login successful",
      },
      { status: 200 },
    )

    // Keep admin cookies readable by client-side admin-login page.
    response.cookies.set("admin_token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    })

    response.cookies.set("admin_email", email, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    })

    // Also set standard auth cookies so the rest of the app can treat admin like a normal role.
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })

    response.cookies.set("user_role", "admin", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })

    response.cookies.set("user_email", email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })

    return response
  } catch (error) {
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
