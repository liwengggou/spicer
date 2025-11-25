import { logger } from "../../../lib/logger"
import { getServiceSupabaseClient, requireUser } from "../../../lib/serverSupabase"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) {
      return new Response("Unauthorized", { status: 401 })
    }

    const supabase = getServiceSupabaseClient()
    const { data: groupData, error: groupError } = await supabase
      .from("groups")
      .insert({ created_by: user.id })
      .select()
      .single()

    if (groupError || !groupData) {
      logger.error("group_create_failed", { error: groupError })
      return new Response("Failed to create group", { status: 500 })
    }

    const { error: participantError } = await supabase
      .from("group_participants")
      .insert({ group_id: groupData.id, user_id: user.id, role: "creator" })

    if (participantError) {
      logger.error("group_creator_insert_failed", { error: participantError })
      return new Response("Failed to link creator", { status: 500 })
    }

    const token = crypto.randomUUID()

    const { error: inviteError } = await supabase
      .from("invites")
      .insert({ token, group_id: groupData.id, created_by: user.id })

    if (inviteError) {
      logger.error("invite_generation_failed", { error: inviteError })
      return new Response("Failed to create invite", { status: 500 })
    }

    logger.groupCreated(groupData.id, user.id)
    logger.inviteGenerated(groupData.id, token)

    return new Response(JSON.stringify({ groupId: groupData.id, token }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    logger.error("group_create_unhandled", { error })
    return new Response("Server error", { status: 500 })
  }
}
