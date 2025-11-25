import { z } from "zod"
import { DateTime } from "luxon"
import { getCurrentWeekStart, getNextWeekStart, isPreferencesFrozen } from "../../../lib/preferences"
import { logger } from "../../../lib/logger"
import { getServiceSupabaseClient, requireUser } from "../../../lib/serverSupabase"

const PrefSchema = z.object({
  spiceLevel: z.number().min(1).max(5),
  timesPerDay: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  keywords: z.string().optional(),
  longDistance: z.boolean(),
})

export async function POST(req: Request) {
  try {
    const input = await req.json()
    const groupId = input?.groupId as string | undefined
    if (!groupId) return new Response("Missing group", { status: 400 })

    const parsed = PrefSchema.safeParse(input?.preferences)
    if (!parsed.success) {
      return new Response("Invalid preferences", { status: 400 })
    }

    const user = await requireUser(req)
    if (!user) return new Response("Unauthorized", { status: 401 })

    const supabase = getServiceSupabaseClient()

    const { data: group } = await supabase
      .from("groups")
      .select("created_by")
      .eq("id", groupId)
      .limit(1)
      .single()

    if (!group || group.created_by !== user.id) {
      return new Response("Only the creator can edit preferences", { status: 403 })
    }

    const nowTokyo = DateTime.now().setZone("Asia/Tokyo")
    const frozen = isPreferencesFrozen(nowTokyo)
    const weekStart = frozen ? getNextWeekStart(nowTokyo) : getCurrentWeekStart(nowTokyo)

    const payload = {
      group_id: groupId,
      week_start_tokyo: weekStart,
      spice_level: parsed.data.spiceLevel,
      times_per_day: parsed.data.timesPerDay,
      keywords: (parsed.data.keywords || "").trim(),
      long_distance: parsed.data.longDistance,
    }

    // When frozen, persist the next-week value but return a 409 to signal the conflict to the client.
    // This preserves "deferred" changes while making the freeze explicit.
    if (frozen) {
      const { data: existingNext, error: existingNextError } = await supabase
        .from("preferences_weekly")
        .select("id")
        .eq("group_id", groupId)
        .eq("week_start_tokyo", weekStart)
        .limit(1)

      if (existingNextError) {
        logger.error("preferences_save_lookup_failed", { error: existingNextError })
        return new Response("Failed to save preferences", { status: 500 })
      }

      const existingId = existingNext?.[0]?.id as string | undefined
      const nextMutation = existingId
        ? supabase.from("preferences_weekly").update(payload).eq("id", existingId)
        : supabase.from("preferences_weekly").insert(payload)

      const { error: nextError } = await nextMutation
      if (nextError) {
        logger.error("preferences_save_failed", { error: nextError })
        return new Response("Failed to save preferences", { status: 500 })
      }

      logger.preferencesSaved(groupId, parsed.data, weekStart, true)

      return new Response(
        JSON.stringify({
          weekStart,
          frozen: true,
          deferred: true,
          message: "Preferences are frozen; saved for next week.",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 409,
        },
      )
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("preferences_weekly")
      .select("id")
      .eq("group_id", groupId)
      .eq("week_start_tokyo", weekStart)
      .limit(1)

    if (existingError) {
      logger.error("preferences_save_lookup_failed", { error: existingError })
      return new Response("Failed to save preferences", { status: 500 })
    }

    const existingId = existingRows?.[0]?.id as string | undefined
    const mutation = existingId
      ? supabase.from("preferences_weekly").update(payload).eq("id", existingId)
      : supabase.from("preferences_weekly").insert(payload)

    const { error } = await mutation

    if (error) {
      logger.error("preferences_save_failed", { error })
      return new Response("Failed to save preferences", { status: 500 })
    }

    logger.preferencesSaved(groupId, parsed.data, weekStart, frozen)

    return new Response(JSON.stringify({ weekStart, frozen }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    logger.error("preferences_unhandled", { error })
    return new Response("Server error", { status: 500 })
  }
}
