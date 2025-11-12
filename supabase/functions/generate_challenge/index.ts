import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("supabase_url") || ""
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("service_role_key") || ""
const appKey = Deno.env.get("APP_KEY") || Deno.env.get("app_key") || ""
const tencentUrl = "https://wss.lke.cloud.tencent.com/v1/qbot/chat/sse"
const supabase = createClient(supabaseUrl, supabaseKey)

function log(payload: unknown) {
  try { console.log(JSON.stringify(payload)) } catch {}
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status: 200 })
}

function bad(status = 400) {
  return new Response("", { status })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return bad(405)
  const input = await req.json()
  const { groupId } = input as { groupId: string }
  const { data: prefs } = await supabase.from("preferences_weekly").select("spice_level,times_per_day,keywords,long_distance").eq("group_id", groupId).order("week_start_tokyo", { ascending: false }).limit(1).maybeSingle()
  const { data: history } = await supabase.from("challenges").select("title,description").eq("group_id", groupId).order("scheduled_at", { ascending: false }).limit(200)
  const payload = {
    spiceLevel: prefs?.spice_level ?? 3,
    timesPerDay: prefs?.times_per_day ?? 2,
    keywords: (prefs?.keywords || "").split(",").map(s => s.trim()).filter(Boolean),
    longDistanceMode: !!prefs?.long_distance,
    priorChallenges: (history || []).map(h => ({ title: h.title, description: h.description })),
  }
  log({ name: "ai_request", group_id: groupId, data: { priorCount: payload.priorChallenges.length, sampleTitles: payload.priorChallenges.slice(0, 3).map(x => x.title) } })
  const body = {
    request_id: crypto.randomUUID(),
    content: JSON.stringify(payload),
    session_id: groupId,
    bot_app_key: appKey,
    visitor_biz_id: groupId,
    stream: "disable"
  }
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 20000)
  let text = ""
  try {
    const res = await fetch(tencentUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ac.signal })
    if (!res.ok) return bad(res.status)
    text = await res.text()
  } catch (e) {
    return bad(504)
  } finally {
    clearTimeout(t)
  }
  function extract(jsonl: string): { title: string; description: string } | null {
    try {
      const lines = jsonl.split(/\r?\n/)
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]
        if (line.startsWith("data:")) {
          const s = line.slice(5).trim()
          const obj = JSON.parse(s)
          if (obj && obj.type === "reply" && obj.payload && obj.payload.content) {
            const c: string = obj.payload.content
            const match = c.match(/\{[\s\S]*\}/)
            if (match) {
              const parsed = JSON.parse(match[0])
              if (parsed && typeof parsed.title === "string" && typeof parsed.description === "string") {
                return { title: parsed.title, description: parsed.description }
              }
            }
          }
        }
      }
    } catch {}
    return null
  }
  const out = extract(text)
  if (!out) return bad(502)
  log({ name: "ai_response", group_id: groupId, data: { title: out.title } })
  return ok(out)
}
