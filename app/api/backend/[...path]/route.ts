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
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000"
  const localDevBaseUrl = "http://127.0.0.1:8000"

  let baseUrl = configuredBaseUrl
  if (process.env.NODE_ENV !== "production") {
    try {
      const healthRes = await fetch(`${localDevBaseUrl}/api/health`, {
        signal: AbortSignal.timeout(800),
      })
      if (healthRes.ok) {
        baseUrl = localDevBaseUrl
      }
    } catch {
    }
  }
  const params = await (context.params as any)
  const targetPath = (params?.path || []).join("/")
  const url = new URL(request.url)
  const targetUrl = `${baseUrl}/api/${targetPath}${url.search}`

  const headers = new Headers(request.headers)
  headers.delete("host")
  headers.delete("content-length")

  const cookieStore = await cookies()
  const authToken = cookieStore.get("auth_token")?.value
  const adminToken = cookieStore.get("admin_token")?.value
  const tokenToUse = targetPath.startsWith("admin/") ? (adminToken || authToken) : authToken

  if (tokenToUse) {
    headers.set("Authorization", `Bearer ${tokenToUse}`)
  }

  let body: BodyInit | undefined
  if (request.method !== "GET" && request.method !== "HEAD") {
    const contentType = request.headers.get("content-type") || ""
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
      { success: false, error: `Backend unavailable. Start PHP API server at ${baseUrl}` },
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
