import { type NextRequest, NextResponse } from "next/server"

function redirectUrl(request: NextRequest, path: string): string {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || request.nextUrl.protocol.replace(":", "")
  const host = request.headers.get("host") || request.nextUrl.host
  return `${proto}://${host}${path}`
}

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

  if (isAdminApiRoute) {
    return NextResponse.next()
  }

  if (isCustomerRoute) {
    const authToken = request.cookies.get("auth_token")?.value
    const userRole = request.cookies.get("user_role")?.value
    const adminToken = request.cookies.get("admin_token")?.value

    if (!authToken) {
      return NextResponse.redirect(redirectUrl(request, "/auth/login?role=customer"))
    }

    if (userRole !== "customer") {
      return NextResponse.redirect(redirectUrl(request, "/auth/login?role=customer"))
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
      return NextResponse.redirect(redirectUrl(request, "/auth/admin-login"))
    }

    if (authToken && userRole !== "admin" && !adminToken) {
      return NextResponse.redirect(redirectUrl(request, "/auth/admin-login"))
    }

    if (!adminToken && !(authToken && userRole === "admin")) {
      return NextResponse.redirect(redirectUrl(request, "/auth/admin-login"))
    }

    return NextResponse.next()
  }

  if (isSellerRoute) {
    const authToken = request.cookies.get("auth_token")?.value
    const userRole = request.cookies.get("user_role")?.value
    const adminToken = request.cookies.get("admin_token")?.value

    if (!authToken) {
      return NextResponse.redirect(redirectUrl(request, "/auth/login?role=seller"))
    }

    if (userRole === "admin") {
      return NextResponse.redirect(redirectUrl(request, "/admin-panel"))
    }

    if (userRole !== "seller") {
      return NextResponse.redirect(redirectUrl(request, "/auth/login?role=seller"))
    }

    const res = NextResponse.next()
    if (adminToken) {
      clearAdminCookies(res)
    }
    return res
  }

  if (isAuthRoute) {
    const authToken = request.cookies.get("auth_token")?.value
    const userRole = request.cookies.get("user_role")?.value
    const adminToken = request.cookies.get("admin_token")?.value

    if (pathname === "/auth/register") {
      return NextResponse.next()
    }

    if (pathname === "/auth/login" && wantedRole && userRole && wantedRole !== userRole) {
      return NextResponse.next()
    }

    if (isAdminLoginRoute && userRole && userRole !== "admin") {
      return NextResponse.next()
    }

    if (adminToken && userRole === "admin") {
      return NextResponse.redirect(redirectUrl(request, "/admin-panel"))
    }

    if (authToken) {
      if (userRole === "admin") {
        return NextResponse.redirect(redirectUrl(request, "/admin-panel"))
      }
      if (userRole === "seller") {
        return NextResponse.redirect(redirectUrl(request, "/seller"))
      }
      if (userRole === "customer") {
        return NextResponse.redirect(redirectUrl(request, "/customer"))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
