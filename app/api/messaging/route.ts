import { cookies } from "next/headers"

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000"
    const apiResponse = await fetch(`${apiBaseUrl}/api/conversations`, {
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
    return Response.json({ error: "Failed to fetch conversations" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000"

    const bodyJson = await request.json().catch(() => ({} as any))
    const receiverId = bodyJson.receiverId ?? bodyJson.recipient_id ?? bodyJson.recipientId
    const conversationId = bodyJson.conversationId ?? bodyJson.conversation_id
    const content = bodyJson.content

    // If conversationId provided, send message directly.
    if (conversationId && content) {
      const apiResponse = await fetch(`${apiBaseUrl}/api/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversation_id: conversationId, content, message_type: "text" }),
      })

      const data = await apiResponse.text()
      return new Response(data, {
        status: apiResponse.status,
        headers: { "content-type": apiResponse.headers.get("content-type") || "application/json" },
      })
    }

    // Otherwise create/find conversation using /api/conversations (PHP will return conversation_id).
    if (receiverId) {
      const apiResponse = await fetch(`${apiBaseUrl}/api/conversations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient_id: receiverId }),
      })

      const data = await apiResponse.text()
      return new Response(data, {
        status: apiResponse.status,
        headers: { "content-type": apiResponse.headers.get("content-type") || "application/json" },
      })
    }

    return Response.json({ error: "Invalid request" }, { status: 400 })
  } catch (error) {
    return Response.json({ error: "Failed to send message" }, { status: 500 })
  }
}
