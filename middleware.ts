import { type NextRequest, NextResponse } from "next/server"

function clearAdminCookies(res: NextResponse) {
  res.cookies.set("admin_token", "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  res.cookies.set("admin_email", "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isAdminPanelRoute = pathname.startsWith("/admin-panel")
  const isAdminLoginRoute = pathname === "/auth/admin-login"
  const isAdminApiRoute = pathname.startsWith("/api/auth/admin")
  const isSellerRoute = pathname.startsWith("/seller")
  const isAuthRoute = pathname.startsWith("/auth/")
  const isCustomerRoute = pathname.startsWith("/customer")
  const wantedRole = request.nextUrl.searchParams.get("role")

  // Handle admin API routes
  if (isAdminApiRoute) {
    return NextResponse.next()
  }

  // Handle customer routes with cookie-based authentication
  if (isCustomerRoute) {
    const authToken = request.cookies.get("auth_token")?.value
    const userRole = request.cookies.get("user_role")?.value
    const adminToken = request.cookies.get("admin_token")?.value

    if (!authToken) {
      const loginUrl = new URL("/auth/login?role=customer", request.url)
      return NextResponse.redirect(loginUrl)
    }

    if (userRole !== "customer") {
      const loginUrl = new URL("/auth/login?role=customer", request.url)
      return NextResponse.redirect(loginUrl)
    }

    const res = NextResponse.next()
    if (adminToken) {
      clearAdminCookies(res)
    }
    return res
  }

  if (isAdminPanelRoute) {
    const adminToken = request.cookies.get("admin_token")?.value
    const authToken = request.cookies.get("auth_token")?.value
    const userRole = request.cookies.get("user_role")?.value

    if (adminToken && userRole !== "admin") {
      const loginUrl = new URL("/auth/admin-login", request.url)
      return NextResponse.redirect(loginUrl)
    }

    if (authToken && userRole !== "admin" && !adminToken) {
      const loginUrl = new URL("/auth/admin-login", request.url)
      return NextResponse.redirect(loginUrl)
    }

    if (!adminToken && !(authToken && userRole === "admin")) {
      const loginUrl = new URL("/auth/admin-login", request.url)
      return NextResponse.redirect(loginUrl)
    }

    // Token exists, allow access
    return NextResponse.next()
  }

  // Handle seller routes with cookie-based authentication
  if (isSellerRoute) {
    const authToken = request.cookies.get("auth_token")?.value
    const userRole = request.cookies.get("user_role")?.value
    const adminToken = request.cookies.get("admin_token")?.value

    if (!authToken) {
      const loginUrl = new URL("/auth/login?role=seller", request.url)
      return NextResponse.redirect(loginUrl)
    }

    if (userRole === "admin") {
      return NextResponse.redirect(new URL("/admin-panel", request.url))
    }

    if (userRole !== "seller") {
      const loginUrl = new URL("/auth/login?role=seller", request.url)
      return NextResponse.redirect(loginUrl)
    }

    const res = NextResponse.next()
    if (adminToken) {
      clearAdminCookies(res)
    }
    return res
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute) {
    const authToken = request.cookies.get("auth_token")?.value
    const userRole = request.cookies.get("user_role")?.value
    const adminToken = request.cookies.get("admin_token")?.value

    if (pathname === "/auth/register") {
      return NextResponse.next()
    }

    // Allow switching roles by explicitly visiting a role-specific login.
    // Example: currently logged in as customer, but visiting /auth/login?role=seller should not redirect to '/'.
    if (pathname === "/auth/login" && wantedRole && userRole && wantedRole !== userRole) {
      return NextResponse.next()
    }

    if (isAdminLoginRoute && userRole && userRole !== "admin") {
      return NextResponse.next()
    }

    if (adminToken && userRole === "admin") {
      return NextResponse.redirect(new URL("/admin-panel", request.url))
    }

    if (authToken) {
      if (userRole === "admin") {
        return NextResponse.redirect(new URL("/admin-panel", request.url))
      }
      if (userRole === "seller") {
        return NextResponse.redirect(new URL("/seller", request.url))
      }
      if (userRole === "customer") {
        return NextResponse.redirect(new URL("/customer", request.url))
      }
    }

  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
