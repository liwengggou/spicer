"use client"
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_url
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.supabase_anon_key
  if (!url || !key) return null
  return createClient(url, key)
}

export const supabase = getSupabase()

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])
  return session
}
