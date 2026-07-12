import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"

async function getFaviconUrl(): Promise<string | null> {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/settings", {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    })
    const data = await res.json()
    if (data?.success && data?.data?.favicon_url) {
      return data.data.favicon_url
    }
  } catch {}
  return null
}

export async function GET() {
  const faviconUrl = await getFaviconUrl()

  if (faviconUrl) {
    const cleaned = faviconUrl.replace(/^\//, "")
    const localPath = path.resolve(process.cwd(), "api", cleaned)
    try {
      const body = await readFile(localPath)
      const ext = path.extname(localPath).toLowerCase()
      const mime = ext === ".ico" ? "image/x-icon" : ext === ".svg" ? "image/svg+xml" : "image/png"
      return new NextResponse(body, {
        status: 200,
        headers: {
          "content-type": mime,
          "cache-control": "public, max-age=86400",
        },
      })
    } catch {}
  }

  const defaultPath = path.resolve(process.cwd(), "public", "icon.svg")
  try {
    const body = await readFile(defaultPath)
    return new NextResponse(body, {
      status: 200,
      headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
