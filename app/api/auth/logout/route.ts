import { NextResponse } from "next/server"

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

export async function GET() {
  return POST()
}
