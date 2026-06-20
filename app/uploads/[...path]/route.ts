import { NextRequest, NextResponse } from "next/server"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    path?: string[]
  }> | {
    path?: string[]
  }
}

function contentTypeFromPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".png") return "image/png"
  if (ext === ".webp") return "image/webp"
  if (ext === ".gif") return "image/gif"
  if (ext === ".svg") return "image/svg+xml"
  if (ext === ".ico") return "image/x-icon"
  return "application/octet-stream"
}

async function tryServeLocalUpload(request: NextRequest, targetPath: string) {
  const uploadsRoot = path.resolve(process.cwd(), "api", "uploads")
  const localPath = path.resolve(uploadsRoot, targetPath)

  if (!localPath.startsWith(uploadsRoot + path.sep) && localPath !== uploadsRoot) {
    return null
  }

  try {
    const s = await stat(localPath)
    if (!s.isFile()) return null

    const headers: Record<string, string> = {
      "content-type": contentTypeFromPath(localPath),
      "content-length": String(s.size),
      "cache-control": "public, max-age=31536000",
      "x-proxy-target": `local:${localPath}`,
    }

    if (request.method === "HEAD") {
      return new NextResponse(null, { status: 200, headers })
    }

    const body = await readFile(localPath)
    return new NextResponse(body, { status: 200, headers })
  } catch {
    return null
  }
}

async function proxyUploads(request: NextRequest, context: RouteContext) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://127.0.0.1:8000"
  const baseUrl = configuredBaseUrl.replace(/\/?api\/?$/i, "")

  const params = await (context.params as any)
  const targetPath = (params?.path || []).join("/")

  const url = new URL(request.url)
  const targetUrl = `${baseUrl}/uploads/${targetPath}${url.search}`
  const fallbackUrl = `${baseUrl}/api/uploads/${targetPath}${url.search}`

  let response: Response
  let resolvedTarget = targetUrl
  try {
    response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        accept: request.headers.get("accept") || "*/*",
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: `Backend unavailable. Start PHP server at ${baseUrl}` },
      { status: 503, headers: { "x-proxy-target": targetUrl } },
    )
  }

  if (response.status === 404) {
    try {
      const fallbackResponse = await fetch(fallbackUrl, {
        method: request.method,
        headers: {
          accept: request.headers.get("accept") || "*/*",
        },
      })
      response = fallbackResponse
      resolvedTarget = fallbackUrl
    } catch {
      // keep original response
    }
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream"
  const cacheControl = response.headers.get("cache-control") || "public, max-age=31536000"

  if (response.status === 404) {
    const local = await tryServeLocalUpload(request, targetPath)
    if (local) return local
  }

  const body = await response.arrayBuffer()
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type": contentType,
      "cache-control": cacheControl,
      "x-proxy-target": resolvedTarget,
    },
  })
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyUploads(request, context)
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyUploads(request, context)
}
