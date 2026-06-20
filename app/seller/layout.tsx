import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function SellerLayout({
  children,
}: {
  children: ReactNode
}) {
  const cookieStore = await cookies()
  const authToken = cookieStore.get("auth_token")?.value
  const userRole = cookieStore.get("user_role")?.value

  if (!authToken || !userRole) {
    redirect("/auth/login?role=seller")
  }

  if (userRole === "admin") {
    redirect("/admin-panel")
  }

  if (userRole !== "seller") {
    redirect("/customer")
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
