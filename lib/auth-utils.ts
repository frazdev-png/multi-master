import { getSupabaseServerClient } from "./supabase-server"

export async function getCurrentUser() {
  try {
    const supabase = await getSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) return null

    const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()

    return userData
  } catch {
    return null
  }
}

export async function checkUserRole(requiredRole: string) {
  const user = await getCurrentUser()
  return user?.role === requiredRole
}
