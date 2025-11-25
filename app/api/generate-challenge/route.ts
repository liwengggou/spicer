import { DateTime } from "luxon"
import { logger } from "../../../lib/logger"
import { computeNextSlot } from "../../../lib/scheduling"
import { getServiceSupabaseClient, requireUser } from "../../../lib/serverSupabase"
import { isLongDistanceSafe } from "../../../lib/challengeValidation"

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status: 200 })
}

function bad(status = 400, message?: string, code?: string, details?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ error: message || "", code, ...(details ? { details } : {}) }),
    { headers: { "Content-Type": "application/json" }, status },
  )
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

async function fetchFullHistory(supabase: ReturnType<typeof getServiceSupabaseClient>, groupId: string) {
  const pageSize = 500
  let from = 0
  const all: { title: string; description: string }[] = []
  while (true) {
    const { data, error } = await supabase
      .from("challenges")
      .select("title,description")
      .eq("group_id", groupId)
      .order("scheduled_at", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

export async function POST(req: Request) {
  try {
    const input = await req.json()
    const groupId = (input?.groupId as string) || ""
    if (!groupId) return bad(400, "Missing group")

    const user = await requireUser(req)
    if (!user) return bad(401, "Unauthorized")

    const appKey = process.env.TENCENT_APP_KEY || process.env.tencent_app_key || ""
    if (!appKey) return bad(500, "Missing AI key")

    const supabase = getServiceSupabaseClient()

    const { data: membership } = await supabase
      .from("group_participants")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!membership) return bad(403, "Not part of this group")

    const { count, error: countError } = await supabase
      .from("group_participants")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", groupId)

    if (countError) {
      logger.error("participant_count_failed", { error: countError })
      return bad(500)
    }

    const participantCount = count || 0
    if (participantCount !== 2) {
      return bad(409, "Need exactly two participants", "needs_two_participants", { participant_count: participantCount })
    }

    const { data: prefs } = await supabase
      .from("preferences_weekly")
      .select("spice_level,times_per_day,keywords,long_distance")
      .eq("group_id", groupId)
      .order("week_start_tokyo", { ascending: false })
      .limit(1)
      .maybeSingle()

    const timesPerDay = prefs?.times_per_day ?? 2
    const longDistance = !!prefs?.long_distance
    const { scheduledAtTokyo, expiresAtTokyo, slotHour } = computeNextSlot(timesPerDay)
    const scheduledIso = scheduledAtTokyo.toUTC().toISO()
    const expiresIso = expiresAtTokyo.toUTC().toISO()

    if (!scheduledIso || !expiresIso) {
      return bad(500, "Unable to determine schedule", "schedule_calculation_failed")
    }

    const { data: existing } = await supabase
      .from("challenges")
      .select("id,title,description,long_distance,status,scheduled_at,expires_at")
      .eq("group_id", groupId)
      .eq("scheduled_at", scheduledIso)
      .maybeSingle()

    if (existing) {
      logger.info("generate_challenge_slot_conflict", {
        group_id: groupId,
        scheduled_at: scheduledIso,
        slot_hour: slotHour,
        times_per_day: timesPerDay,
      })
      return bad(409, "Slot already scheduled", "slot_already_scheduled", {
        scheduled_at: scheduledIso,
        slot_hour: slotHour,
        existing_challenge_id: existing.id,
      })
    }

    const history = await fetchFullHistory(supabase, groupId)

    const payload = {
      spiceLevel: prefs?.spice_level ?? 3,
      timesPerDay,
      keywords: (prefs?.keywords || "").split(",").map(s => s.trim()).filter(Boolean),
      longDistanceMode: longDistance,
      guidance: longDistance
        ? "This couple is long-distance today. Only suggest non-physical, remote-friendly challenges (video, voice, digital)."
        : "Physical intimacy is allowed if it matches the spice level.",
      priorChallenges: history.map(h => ({ title: h.title, description: h.description })),
    }

    logger.aiRequest(groupId, payload, payload.priorChallenges.length)

    const body = {
      request_id: crypto.randomUUID(),
      content: JSON.stringify(payload),
      session_id: groupId,
      bot_app_key: appKey,
      visitor_biz_id: groupId,
      stream: "disable",
    }

    const ac = new AbortController()
    const timeout = setTimeout(() => ac.abort(), 20000)
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
    } catch (err) {
      logger.error("ai_generate_failed", { error: err })
      return bad(504)
    } finally {
      clearTimeout(timeout)
    }

    const out = extractSse(text)
    if (!out) return bad(502)
    const { ok: longDistanceSafe, violations } = isLongDistanceSafe(out, longDistance)
    if (!longDistanceSafe) {
      logger.longDistanceViolation(groupId, out, violations)
      return bad(422, "Long-distance mode requires remote-friendly challenges", "long_distance_violation", { violations })
    }
    logger.aiResponse(groupId, out)

    const challengeRow = {
      group_id: groupId,
      scheduled_at: scheduledIso,
      expires_at: expiresIso,
      status: "Incomplete" as const,
      long_distance: longDistance,
      title: out.title,
      description: out.description,
    }

    const { data: inserted, error: insertError } = await supabase
      .from("challenges")
      .insert(challengeRow)
      .select("id")
      .single()

    if (insertError || !inserted) {
      logger.error("challenge_insert_failed", { error: insertError })
      return bad(500)
    }

    await supabase
      .from("notifications")
      .insert({
        group_id: groupId,
        type: "challenge_scheduled",
        challenge_id: inserted.id,
        created_at: DateTime.now().toISO(),
      })

    logger.notificationSent(groupId, "challenge_scheduled", inserted.id)
    logger.challengeScheduled(groupId, inserted.id, scheduledIso || "", timesPerDay)

    return ok({
      ...out,
      scheduled_at: scheduledIso,
      expires_at: challengeRow.expires_at,
      slot_hour: slotHour,
    })
  } catch (error) {
    logger.error("generate_challenge_unhandled", { error })
    return bad(500)
  }
}
