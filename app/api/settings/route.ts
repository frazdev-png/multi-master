import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000"
    const apiResponse = await fetch(`${apiBaseUrl}/api/settings`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    const data = await apiResponse.json().catch(() => null)

    if (!apiResponse.ok || !data?.success) {
      return NextResponse.json(
        { success: false, message: data?.message || "Failed to fetch settings" },
        { status: 200 }
      )
    }

    return NextResponse.json({ success: true, data: data.data })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Failed to fetch settings" }, { status: 200 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000"

    const apiResponse = await fetch(`${apiBaseUrl}/api/settings/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await apiResponse.json().catch(() => null)

    if (!apiResponse.ok || !data?.success) {
      return NextResponse.json(
        { success: false, message: data?.message || "Failed to update settings" },
        { status: 200 }
      )
    }

    return NextResponse.json({ success: true, message: data.message || "Settings updated successfully", data: data.data })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Failed to update settings" }, { status: 200 })
  }
}
