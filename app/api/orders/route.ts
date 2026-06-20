import { cookies } from "next/headers"

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000"
    const url = new URL(request.url)
    const apiResponse = await fetch(`${apiBaseUrl}/api/orders${url.search}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    const data = await apiResponse.text()
    return new Response(data, {
      status: apiResponse.status,
      headers: {
        "content-type": apiResponse.headers.get("content-type") || "application/json",
      },
    })
  } catch (error) {
    return Response.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.text()
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000"
    const apiResponse = await fetch(`${apiBaseUrl}/api/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": request.headers.get("content-type") || "application/json",
      },
      body,
    })

    const data = await apiResponse.text()
    return new Response(data, {
      status: apiResponse.status,
      headers: {
        "content-type": apiResponse.headers.get("content-type") || "application/json",
      },
    })
  } catch (error) {
    return Response.json({ error: "Failed to create order" }, { status: 500 })
  }
}
