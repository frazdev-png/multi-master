import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("admin_token")?.value

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Used only to connect to the internal Ratchet WebSocket server which expects ?token=...
  return NextResponse.json({ token }, { status: 200 })
}
