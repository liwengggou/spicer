import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  const input = await req.json()
  const userId = input?.userId as string | undefined
  if (!userId) return new Response("", { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_url || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role_key || ""
  if (!url || !key) return new Response("", { status: 500 })

  const supabase = createClient(url, key)

  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .insert({ created_by: userId })
    .select()
    .single()

  if (groupError || !groupData) return new Response("", { status: 500 })

  const { error: participantError } = await supabase
    .from("group_participants")
    .insert({ group_id: groupData.id, user_id: userId, role: "creator" })

  if (participantError) return new Response("", { status: 500 })

  const token = crypto.randomUUID()

  const { error: inviteError } = await supabase
    .from("invites")
    .insert({ token, group_id: groupData.id, created_by: userId })

  if (inviteError) return new Response("", { status: 500 })

  return new Response(JSON.stringify({ groupId: groupData.id, token }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  })
}
