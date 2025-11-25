import { DateTime } from "luxon"
import { logger } from "../../../../../lib/logger"
import { getServiceSupabaseClient, requireUser } from "../../../../../lib/serverSupabase"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const challengeId = params.id
    if (!challengeId) {
      return new Response("Missing challenge", { status: 400 })
    }

    const user = await requireUser(req)
    if (!user) return new Response("Unauthorized", { status: 401 })

    const supabase = getServiceSupabaseClient()

    const { data: challenge } = await supabase
      .from("challenges")
      .select("id,group_id,expires_at,status")
      .eq("id", challengeId)
      .limit(1)
      .single()

    if (!challenge) return new Response("Challenge not found", { status: 404 })

    const { data: membership } = await supabase
      .from("group_participants")
      .select("role")
      .eq("group_id", challenge.group_id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!membership) return new Response("Not allowed", { status: 403 })

    const expiresTokyo = DateTime.fromISO(challenge.expires_at).setZone("Asia/Tokyo")
    const nowTokyo = DateTime.now().setZone("Asia/Tokyo")
    if (nowTokyo > expiresTokyo) {
      return new Response("Challenge already expired", { status: 409 })
    }

    const { data: alreadyCompleted } = await supabase
      .from("challenge_completion")
      .select("completed_at")
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (alreadyCompleted) {
      return new Response(JSON.stringify({ status: challenge.status }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    }

    const timestamp = DateTime.now().toISO()
    const { error: insertError } = await supabase
      .from("challenge_completion")
      .insert({
        challenge_id: challengeId,
        user_id: user.id,
        completed_at: timestamp,
      })

    if (insertError) {
      logger.error("challenge_completion_insert_failed", { challenge_id: challengeId, error: insertError })
      return new Response("Unable to mark complete", { status: 500 })
    }

    const { count, error: completionCountError } = await supabase
      .from("challenge_completion")
      .select("user_id", { count: "exact", head: true })
      .eq("challenge_id", challengeId)

    if (completionCountError) {
      logger.error("challenge_completion_count_failed", { challenge_id: challengeId, error: completionCountError })
      return new Response("Unable to compute completion count", { status: 500 })
    }

    await supabase
      .from("notifications")
      .insert({
        group_id: challenge.group_id,
        challenge_id: challengeId,
        type: "participant_completed",
        created_at: DateTime.now().toISO(),
      })
    logger.notificationSent(challenge.group_id, "participant_completed", challengeId)

    let finalStatus = challenge.status
    const bothCompleted = (count || 0) >= 2
    if (bothCompleted && challenge.status !== "Complete") {
      const { error: updateError } = await supabase
        .from("challenges")
        .update({ status: "Complete" })
        .eq("id", challengeId)

      if (updateError) {
        logger.error("challenge_status_update_failed", { challenge_id: challengeId, error: updateError })
      } else {
        finalStatus = "Complete"
        await supabase
          .from("notifications")
          .insert({
            group_id: challenge.group_id,
            challenge_id: challengeId,
            type: "challenge_completed",
            created_at: DateTime.now().toISO(),
          })
        logger.notificationSent(challenge.group_id, "challenge_completed", challengeId)
      }
    }

    logger.challengeCompleted(challengeId, user.id, challenge.group_id, (count || 0) >= 2)

    return new Response(JSON.stringify({ status: finalStatus, completions: count || 1 }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    logger.error("challenge_complete_unhandled", { error })
    return new Response("Server error", { status: 500 })
  }
}
