import { createClient } from "@supabase/supabase-js"

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status: 200 })
}

function bad(status = 400) {
  return new Response("", { status })
}

function extractSse(jsonl: string): { title: string; description: string } | null {
  try {
    const lines = jsonl.split(/\r?\n/)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      if (line.startsWith("data:")) {
        const s = line.slice(5).trim()
        const obj = JSON.parse(s)
        if (obj && obj.type === "reply" && obj.payload && obj.payload.content) {
          const c: string = obj.payload.content
          const m = c.match(/\{[\s\S]*\}/)
          if (m) {
            const parsed = JSON.parse(m[0])
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

export async function POST(req: Request) {
  const input = await req.json()
  const groupId = (input?.groupId as string) || ""
  if (!groupId) return bad(400)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_url || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role_key || ""
  const appKey = process.env.TENCENT_APP_KEY || process.env.tencent_app_key || ""
  if (!url || !key || !appKey) return bad(500)

  const supabase = createClient(url, key)

  const { data: prefs } = await supabase
    .from("preferences_weekly")
    .select("spice_level,times_per_day,keywords,long_distance")
    .eq("group_id", groupId)
    .order("week_start_tokyo", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: history } = await supabase
    .from("challenges")
    .select("title,description")
    .eq("group_id", groupId)
    .order("scheduled_at", { ascending: false })
    .limit(200)

  const payload = {
    spiceLevel: prefs?.spice_level ?? 3,
    timesPerDay: prefs?.times_per_day ?? 2,
    keywords: (prefs?.keywords || "").split(",").map(s => s.trim()).filter(Boolean),
    longDistanceMode: !!prefs?.long_distance,
    priorChallenges: (history || []).map(h => ({ title: h.title, description: h.description })),
  }

  const body = {
    request_id: crypto.randomUUID(),
    content: JSON.stringify(payload),
    session_id: groupId,
    bot_app_key: appKey,
    visitor_biz_id: groupId,
    stream: "disable",
  }

  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 20000)
  let text = ""
  try {
    const res = await fetch("https://wss.lke.cloud.tencent.com/v1/qbot/chat/sse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    })
    if (!res.ok) return bad(res.status)
    text = await res.text()
  } catch {
    return bad(504)
  } finally {
    clearTimeout(t)
  }

  const out = extractSse(text)
  if (!out) return bad(502)
  try {
    const now = new Date()
    const timesPerDay = Number(prefs?.times_per_day ?? 2)
    const expireHours = timesPerDay === 1 ? 24 : timesPerDay === 2 ? 12 : 8
    const expiresAt = new Date(now.getTime() + expireHours * 60 * 60 * 1000)
    const row = {
      group_id: groupId,
      scheduled_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: "Incomplete" as const,
      long_distance: !!prefs?.long_distance,
      title: out.title,
      description: out.description,
    }
    await supabase.from("challenges").insert(row)
    await supabase.from("notifications").insert({ group_id: groupId, type: "scheduled", created_at: new Date().toISOString() })
  } catch {}
  return ok(out)
}
