import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ success: true })

  const cookiesToClear = ["auth_token", "user_role", "user_email", "admin_token", "admin_email"]
  for (const name of cookiesToClear) {
    response.cookies.set(name, "", {
      httpOnly: name !== "admin_token" && name !== "admin_email",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    })
  }

  return response
}

export async function GET() {
  return POST()
}
