import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("redirect")
  const dest = raw || "/login"
  const res = new NextResponse(null, { status: 307, headers: { Location: dest } })
  clearAllCookies(res)
  return res
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("redirect")
  const dest = raw || "/login"
  const res = new NextResponse(null, { status: 307, headers: { Location: dest } })
  clearAllCookies(res)
  return res
}

function clearAllCookies(res: NextResponse) {
  const names = ["auth_token", "user_role", "user_email", "admin_token", "admin_email"]
  for (const name of names) {
    res.cookies.set(name, "", {
      httpOnly: name === "admin_token" || name === "admin_email" ? false : true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  }
}
