import { createClient, SupabaseClient, User } from "@supabase/supabase-js"

let serviceClient: SupabaseClient | null = null

function getEnv(name: string) {
  return process.env[name] || process.env[name.toLowerCase()]
}

export function getServiceSupabaseClient() {
  if (serviceClient) return serviceClient
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("supabase_url")
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("service_role_key")
  if (!url || !key) {
    throw new Error("Missing Supabase credentials for server operations")
  }
  serviceClient = createClient(url, key)
  return serviceClient
}

export async function requireUser(req: Request): Promise<User | null> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization")
  if (!header) return null
  const token = header.replace(/Bearer\s+/i, "").trim()
  if (!token) return null
  const supabase = getServiceSupabaseClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
