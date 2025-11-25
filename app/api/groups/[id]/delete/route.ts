import { logger } from "../../../../lib/logger"
import { getServiceSupabaseClient, requireUser } from "../../../../lib/serverSupabase"

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const groupId = params.id
    if (!groupId) {
      return new Response("Missing group", { status: 400 })
    }

    const user = await requireUser(req)
    if (!user) {
      return new Response("Unauthorized", { status: 401 })
    }

    const supabase = getServiceSupabaseClient()
    const { data: group } = await supabase
      .from("groups")
      .select("created_by")
      .eq("id", groupId)
      .limit(1)
      .maybeSingle()

    if (!group) {
      return new Response("Group not found", { status: 404 })
    }

    if (group.created_by !== user.id) {
      return new Response("Only the creator can delete this group", { status: 403 })
    }

    const { error } = await supabase.from("groups").delete().eq("id", groupId)
    if (error) {
      logger.error("group_delete_failed", { error, groupId })
      return new Response("Failed to delete group", { status: 500 })
    }

    logger.groupDeleted(groupId, user.id)
    return new Response(null, { status: 204 })
  } catch (error) {
    logger.error("group_delete_unhandled", { error })
    return new Response("Server error", { status: 500 })
  }
}
