import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  const input = await req.json()
  const groupId = input?.groupId as string | undefined
  const weekStart = input?.weekStart as string | undefined
  const pref = input?.preferences as {
    spiceLevel: number
    timesPerDay: 1 | 2 | 3
    keywords?: string
    longDistance: boolean
  } | undefined

  if (!groupId || !weekStart || !pref) return new Response("", { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_url || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role_key || ""
  if (!url || !key) return new Response("", { status: 500 })

  const supabase = createClient(url, key)

  const { error } = await supabase.from("preferences_weekly").upsert({
    group_id: groupId,
    week_start_tokyo: weekStart,
    spice_level: pref.spiceLevel,
    times_per_day: pref.timesPerDay,
    keywords: pref.keywords || "",
    long_distance: pref.longDistance,
  })

  if (error) return new Response("", { status: 500 })

  return new Response("", { status: 200 })
}
