import { NextResponse } from "next/server"

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
    const resolved = faviconUrl.startsWith("http") ? faviconUrl : `https://sell1mall.com${faviconUrl}`
    return NextResponse.redirect(resolved, 302)
  }

  return NextResponse.redirect(new URL("/icon.svg", "https://sell1mall.com"), 302)
}
