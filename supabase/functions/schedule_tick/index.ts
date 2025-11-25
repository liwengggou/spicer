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

function log(data: unknown) {
  try {
    console.log(JSON.stringify(data))
  } catch (_) {
    console.log(String(data))
  }
}

const PHYSICAL_TERMS = [
  "kiss",
  "cuddle",
  "cuddling",
  "hug",
  "massage",
  "touch",
  "hold hands",
  "hand holding",
  "spoon",
  "spooning",
  "in-person",
  "physically",
  "physical touch",
  "shoulder rub",
  "back rub",
  "body heat",
  "sit together",
  "walk together",
  "go for a walk",
  "go for a run",
  "go for a drive",
  "movie night together",
  "cook together",
  "dinner date",
  "picnic",
  "cafe date",
  "restaurant",
]

function findLongDistanceViolations(challenge: { title?: string; description?: string }, enabled: boolean) {
  if (!enabled) return []
  const haystack = `${(challenge.title || "").toLowerCase()} ${(challenge.description || "").toLowerCase()}`
  const matches = PHYSICAL_TERMS.filter((term) => haystack.includes(term))
  return Array.from(new Set(matches))
}

function getExpiryDuration(timesPerDay: number, slotHour: number) {
  if (timesPerDay === 1) return { hours: 24 }
  if (timesPerDay === 2) return { hours: 12 }
  if (slotHour === 8) return { hours: 8 }
  if (slotHour === 16) return { hours: 4 }
  return { hours: 12 }
}

function slotsFor(timesPerDay: number) {
  if (timesPerDay === 1) return [8]
  if (timesPerDay === 2) return [8, 20]
  return [8, 16, 20]
}

async function fetchHistory(groupId: string) {
  const pageSize = 500
  let from = 0
  const all: Array<{ title: string; description: string }> = []
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

function parseSse(text: string) {
  try {
    const lines = text.split(/\r?\n/)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      if (line.startsWith("data:")) {
        const payload = JSON.parse(line.slice(5).trim())
        if (payload?.type === "reply" && payload?.payload?.content) {
          const match = String(payload.payload.content).match(/\{[\s\S]*\}/)
          if (match) {
            const parsed = JSON.parse(match[0])
            if (parsed?.title && parsed?.description) {
              return parsed
            }
          }
        }
      }
    }
  } catch (_) {}
  return null
}

async function sendExpiryReminders(nowTokyo: DateTime) {
  const startIso = nowTokyo.toISO()
  const endIso = nowTokyo.plus({ minutes: 30 }).toISO()
  if (!startIso || !endIso) return 0
  const { data } = await supabase
    .from("challenges")
    .select("id,group_id")
    .eq("status", "Incomplete")
    .gt("expires_at", startIso)
    .lte("expires_at", endIso)

  if (!data?.length) return 0
  const challengeIds = data.map((row) => row.id)
  if (!challengeIds.length) return 0

  const { data: existing } = await supabase
    .from("notifications")
    .select("challenge_id")
    .eq("type", "expiry_reminder")
    .in("challenge_id", challengeIds)

  const seen = new Set(existing?.map((row) => row.challenge_id).filter(Boolean) || [])
  const inserts = data
    .filter((row) => !seen.has(row.id))
    .map((row) => ({
      group_id: row.group_id,
      challenge_id: row.id,
      type: "expiry_reminder",
      created_at: startIso,
    }))

  if (!inserts.length) return 0
  await supabase.from("notifications").insert(inserts)
  log({ name: "schedule_tick_expiry_reminders", count: inserts.length })
  return inserts.length
}

async function sendExpiryAlerts(nowTokyo: DateTime) {
  const cutoffIso = nowTokyo.toISO()
  if (!cutoffIso) return 0
  const { data } = await supabase
    .from("challenges")
    .select("id,group_id")
    .eq("status", "Incomplete")
    .lte("expires_at", cutoffIso)

  if (!data?.length) return 0
  const challengeIds = data.map((row) => row.id)
  if (!challengeIds.length) return 0
  const { data: existing } = await supabase
    .from("notifications")
    .select("challenge_id")
    .eq("type", "challenge_expired")
    .in("challenge_id", challengeIds)

  const seen = new Set(existing?.map((row) => row.challenge_id).filter(Boolean) || [])
  const inserts = data
    .filter((row) => !seen.has(row.id))
    .map((row) => ({
      group_id: row.group_id,
      challenge_id: row.id,
      type: "challenge_expired",
      created_at: cutoffIso,
    }))
  if (!inserts.length) return 0
  await supabase.from("notifications").insert(inserts)
  log({ name: "schedule_tick_expiry_alerts", count: inserts.length })
  return inserts.length
}

export default async function handler(_req: Request): Promise<Response> {
  if (!appKey) {
    log({ name: "schedule_tick_missing_app_key" })
    return ok({ scheduled: 0, error: "missing_app_key" })
  }
  const nowTokyo = DateTime.now().setZone("Asia/Tokyo")
  const reminderCount = await sendExpiryReminders(nowTokyo)
  const expiredCount = await sendExpiryAlerts(nowTokyo)
  if (nowTokyo.minute !== 0) {
    return ok({ skipped: "not-slot-minute", reminderCount, expiredCount })
  }
  const slotHour = nowTokyo.hour
  const allowedHours = [8, 16, 20]
  if (!allowedHours.includes(slotHour)) {
    return ok({ skipped: "not-slot-hour", reminderCount, expiredCount })
  }

  const scheduledAtTokyo = nowTokyo.startOf("hour")
  const scheduledIso = scheduledAtTokyo.toUTC().toISO()
  if (!scheduledIso) return ok({ skipped: "no-iso" })

  const { data: participants } = await supabase
    .from("group_participants")
    .select("group_id,user_id")

  const groupMembership = new Map<string, Set<string>>()
  for (const row of participants || []) {
    if (!groupMembership.has(row.group_id)) {
      groupMembership.set(row.group_id, new Set())
    }
    groupMembership.get(row.group_id)!.add(row.user_id)
  }

  const eligibleGroups = Array.from(groupMembership.entries())
    .filter(([, members]) => members.size === 2)
    .map(([groupId]) => groupId)

  if (eligibleGroups.length === 0) {
    return ok({ scheduled: 0, reminderCount, expiredCount })
  }

  const { data: prefRows } = await supabase
    .from("preferences_weekly")
    .select("group_id,week_start_tokyo,spice_level,times_per_day,keywords,long_distance")
    .in("group_id", eligibleGroups)
    .order("week_start_tokyo", { ascending: false })

  const prefMap = new Map<string, { group_id: string; spice_level: number | null; times_per_day: number | null; keywords: string | null; long_distance: boolean | null }>()
  for (const row of prefRows || []) {
    if (!prefMap.has(row.group_id)) {
      prefMap.set(row.group_id, row)
    }
  }

  const targetGroups = eligibleGroups
    .map((groupId) => {
      const pref = prefMap.get(groupId)
      const timesPerDay = pref?.times_per_day ?? 2
      const allowedSlots = slotsFor(timesPerDay)
      if (!allowedSlots.includes(slotHour)) return null
      return {
        groupId,
        timesPerDay,
        spiceLevel: pref?.spice_level ?? 3,
        keywords: pref?.keywords || "",
        longDistance: !!pref?.long_distance,
      }
    })
    .filter(Boolean) as Array<{ groupId: string; timesPerDay: number; spiceLevel: number; keywords: string; longDistance: boolean }>

  if (targetGroups.length === 0) {
    return ok({ scheduled: 0, reminderCount, expiredCount })
  }

  const { data: existingRows } = await supabase
    .from("challenges")
    .select("group_id")
    .in("group_id", targetGroups.map((g) => g.groupId))
    .eq("scheduled_at", scheduledIso)

  const alreadyScheduled = new Set(existingRows?.map((row) => row.group_id) || [])

  const tasks: Array<{ groupId: string; title: string; description: string; timesPerDay: number; longDistance: boolean }> = []

  for (const group of targetGroups) {
    if (alreadyScheduled.has(group.groupId)) continue
    try {
      const history = await fetchHistory(group.groupId)
      const payload = {
        spiceLevel: group.spiceLevel,
        timesPerDay: group.timesPerDay,
        keywords: group.keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        longDistanceMode: group.longDistance,
        guidance: group.longDistance
          ? "Only propose non-physical, remote-friendly activities (video, voice, digital)."
          : "Physical intimacy is allowed if it matches the spice level.",
        priorChallenges: history.map((h) => ({ title: h.title, description: h.description })),
      }

      log({ name: "schedule_tick_ai_request", group_id: group.groupId, priorCount: payload.priorChallenges.length })

      const body = {
        request_id: crypto.randomUUID(),
        content: JSON.stringify(payload),
        session_id: group.groupId,
        bot_app_key: appKey,
        visitor_biz_id: group.groupId,
        stream: "disable",
      }

      const res = await fetch(tencentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        log({ name: "schedule_tick_ai_error", group_id: group.groupId, status: res.status })
        continue
      }
      const text = await res.text()
      const parsed = parseSse(text)
      if (!parsed) {
        log({ name: "schedule_tick_ai_parse_error", group_id: group.groupId })
        continue
      }
      const violations = findLongDistanceViolations(parsed, group.longDistance)
      if (violations.length) {
        log({ name: "long_distance_violation", group_id: group.groupId, terms: violations, sample_title: parsed.title })
        continue
      }
      tasks.push({
        groupId: group.groupId,
        title: parsed.title,
        description: parsed.description,
        timesPerDay: group.timesPerDay,
        longDistance: group.longDistance,
      })
    } catch (error) {
      log({ name: "schedule_tick_group_error", group_id: group.groupId, error })
    }
  }

  if (tasks.length === 0) {
    return ok({ scheduled: 0, reminderCount, expiredCount })
  }

  const inserts = tasks
    .map((task) => {
      const expiryIso = scheduledAtTokyo.plus(getExpiryDuration(task.timesPerDay, slotHour)).toUTC().toISO()
      if (!expiryIso) return null
      return {
        group_id: task.groupId,
        scheduled_at: scheduledIso,
        expires_at: expiryIso,
        status: "Incomplete",
        long_distance: task.longDistance,
        title: task.title,
        description: task.description,
      }
    })
    .filter(Boolean) as Array<{ group_id: string; scheduled_at: string; expires_at: string; status: string; long_distance: boolean; title: string; description: string }>

  if (inserts.length === 0) {
    return ok({ scheduled: 0, reminderCount, expiredCount })
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("challenges")
    .insert(inserts)
    .select("id,group_id")

  if (insertError) {
    log({ name: "schedule_tick_insert_error", error: insertError })
    return ok({ scheduled: 0, error: "insert_failed", reminderCount, expiredCount })
  }

  for (const row of insertedRows || []) {
    await supabase
      .from("notifications")
      .insert({ group_id: row.group_id, challenge_id: row.id, type: "challenge_scheduled", created_at: new Date().toISOString() })
  }

  log({ name: "schedule_tick", scheduled: insertedRows?.length || 0, slotHour })
  return ok({ scheduled: insertedRows?.length || 0, slotHour, reminderCount, expiredCount })
}
