import { NextRequest, NextResponse } from "next/server"

function clearCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", {
    httpOnly: name === "admin_token" || name === "admin_email" ? false : true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

export async function POST() {
  const res = NextResponse.json({ success: true })

  clearCookie(res, "auth_token")
  clearCookie(res, "user_role")
  clearCookie(res, "user_email")
  clearCookie(res, "admin_token")
  clearCookie(res, "admin_email")

  return res
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("redirect") || "/login"
  const [path, qs] = raw.split("?")
  const dest = request.nextUrl.clone()
  dest.pathname = path
  dest.search = qs ? "?" + qs : ""
  dest.searchParams.delete("redirect")

  const res = NextResponse.redirect(dest)

  clearCookie(res, "auth_token")
  clearCookie(res, "user_role")
  clearCookie(res, "user_email")
  clearCookie(res, "admin_token")
  clearCookie(res, "admin_email")

  return res
}
