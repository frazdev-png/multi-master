import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

type RouteContext = {
  params: Promise<{
    path?: string[]
  }> | {
    path?: string[]
  }
}

async function proxy(request: NextRequest, context: RouteContext) {
  const baseUrl = "http://127.0.0.1:8000"
  const params = await (context.params as any)
  const targetPath = (params?.path || []).join("/")
  const url = new URL(request.url)
  const targetUrl = `${baseUrl}/api/${targetPath}${url.search}`

  const cookieStore = await cookies()
  const authToken = cookieStore.get("auth_token")?.value
  const adminToken = cookieStore.get("admin_token")?.value
  const tokenToUse = targetPath.startsWith("admin/") ? (adminToken || authToken) : authToken

  const headers: Record<string, string> = {}
  if (tokenToUse) {
    headers["Authorization"] = `Bearer ${tokenToUse}`
  }

  let body: BodyInit | undefined
  if (request.method !== "GET" && request.method !== "HEAD") {
    const contentType = request.headers.get("content-type") || ""
    headers["Content-Type"] = contentType
    if (/multipart\/form-data/i.test(contentType)) {
      const ab = await request.arrayBuffer()
      body = new Uint8Array(ab)
    } else {
      body = await request.text()
    }
  }

  let response: Response
  try {
    response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    })
  } catch {
    return NextResponse.json(
      { success: false, error: `Backend unavailable at ${targetUrl}` },
      {
        status: 503,
        headers: {
          "x-proxy-target": targetUrl,
        },
      },
    )
  }

  const responseBody = await response.text()
  const contentType = response.headers.get("content-type") || "application/json"

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      "content-type": contentType,
      "x-proxy-target": targetUrl,
    },
  })
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}
