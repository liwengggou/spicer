import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { DateTime } from "https://esm.sh/luxon@3"

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("supabase_url") || ""
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("service_role_key") || ""
const appKey = Deno.env.get("APP_KEY") || Deno.env.get("app_key") || ""
const tencentUrl = "https://wss.lke.cloud.tencent.com/v1/qbot/chat/sse"
const supabase = createClient(supabaseUrl, supabaseKey)

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status: 200 })
}

export default async function handler(_req: Request): Promise<Response> {
  const nowTokyo = DateTime.now().setZone("Asia/Tokyo")
  const times = [8, 16, 20]
  const nowHour = nowTokyo.hour
  const today = nowTokyo.startOf("day")
  const targetSlots = times.filter(h => h === nowHour)
  if (targetSlots.length === 0) return ok({})
  const { data: prefs } = await supabase.from("preferences_weekly").select("group_id,times_per_day,long_distance,spice_level,keywords").order("week_start_tokyo", { ascending: false })
  const entries = [] as Array<{ group_id: string; scheduled_at: string; expires_at: string; status: string; long_distance: boolean; title: string; description: string }>
  for (const p of prefs || []) {
    const slots = p.times_per_day === 1 ? [8] : p.times_per_day === 2 ? [8, 20] : [8, 16, 20]
    if (!slots.includes(nowHour)) continue
    const scheduled_at_tokyo = today.plus({ hours: nowHour })
    const expires_at_tokyo = (() => {
      if (p.times_per_day === 1) return scheduled_at_tokyo.plus({ days: 1 })
      if (p.times_per_day === 2 && nowHour === 8) return today.plus({ hours: 20 })
      if (p.times_per_day === 2 && nowHour === 20) return today.plus({ days: 1, hours: 8 })
      if (p.times_per_day === 3 && nowHour === 8) return today.plus({ hours: 16 })
      if (p.times_per_day === 3 && nowHour === 16) return today.plus({ hours: 20 })
      return today.plus({ days: 1, hours: 8 })
    })()
    const scheduled_at = scheduled_at_tokyo.toUTC().toISO()
    const expires_at = expires_at_tokyo.toUTC().toISO()
    const payload = {
      spiceLevel: p.spice_level ?? 3,
      timesPerDay: p.times_per_day ?? 2,
      keywords: (p.keywords || "").split(",").map(s => s.trim()).filter(Boolean),
      longDistanceMode: !!p.long_distance,
      priorChallenges: [] as Array<{ title: string; description: string }>,
    }
    const { data: history } = await supabase.from("challenges").select("title,description").eq("group_id", p.group_id).order("scheduled_at", { ascending: false }).limit(200)
    payload.priorChallenges = (history || []).map(h => ({ title: h.title, description: h.description }))
    const body = { request_id: crypto.randomUUID(), content: JSON.stringify(payload), session_id: p.group_id, bot_app_key: appKey, visitor_biz_id: p.group_id, stream: "disable" }
    const aiRes = await fetch(tencentUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    let title = ""
    let description = ""
    if (aiRes.ok) {
      const out = await aiRes.json()
      title = out?.title || ""
      description = out?.description || ""
    }
    entries.push({ group_id: p.group_id, scheduled_at, expires_at, status: "Incomplete", long_distance: !!p.long_distance, title, description })
  }
  if (entries.length > 0) {
    await supabase.from("challenges").insert(entries)
    for (const e of entries) {
      await supabase.from("notifications").insert({ group_id: e.group_id, type: "scheduled", created_at: new Date().toISOString() })
    }
  }
  return ok({ count: entries.length })
}
