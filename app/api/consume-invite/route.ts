import { logger } from "../../../lib/logger"
import { getServiceSupabaseClient, requireUser } from "../../../lib/serverSupabase"

export async function POST(req: Request) {
  try {
    const input = await req.json()
    const token = input?.token as string | undefined
    if (!token) return new Response("Missing invite token", { status: 400 })

    const user = await requireUser(req)
    if (!user) return new Response("Unauthorized", { status: 401 })

    const supabase = getServiceSupabaseClient()
    const { data: inv } = await supabase
      .from("invites")
      .select("group_id,used_at")
      .eq("token", token)
      .limit(1)
      .maybeSingle()

    if (!inv) return new Response("Invite not found", { status: 404 })
    if (inv.used_at) return new Response("Invite already used", { status: 409 })

    const groupId = inv.group_id as string

    const { count } = await supabase
      .from("group_participants")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", groupId)

    if ((count || 0) >= 2) {
      return new Response("Group already full", { status: 409 })
    }

    const { error: insertError } = await supabase
      .from("group_participants")
      .insert({ group_id: groupId, user_id: user.id, role: "member" })

    if (insertError) {
      logger.error("invite_consume_insert_failed", { error: insertError })
      return new Response("Unable to join group", { status: 500 })
    }

    const { error: markUsedError } = await supabase
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token)

    if (markUsedError) {
      logger.error("invite_mark_used_failed", { error: markUsedError })
      return new Response("Unable to mark invite", { status: 500 })
    }

    await supabase
      .from("notifications")
      .insert({ group_id: groupId, type: "invite_consumed", created_at: new Date().toISOString() })

    logger.notificationSent(groupId, "invite_consumed")

    logger.inviteConsumed(token, user.id, groupId)

    return new Response(JSON.stringify({ groupId }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    logger.error("invite_consume_unhandled", { error })
    return new Response("Server error", { status: 500 })
  }
}
