import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  const input = await req.json()
  const token = input?.token as string | undefined
  const userId = input?.userId as string | undefined
  if (!token || !userId) return new Response("", { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_url || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role_key || ""
  if (!url || !key) return new Response("", { status: 500 })

  const supabase = createClient(url, key)

  const { data: inv } = await supabase
    .from("invites")
    .select("group_id,used_at")
    .eq("token", token)
    .limit(1)
    .maybeSingle()

  if (!inv || inv.used_at) return new Response("", { status: 409 })

  const groupId = inv.group_id as string

  const { error: e1 } = await supabase
    .from("group_participants")
    .insert({ group_id: groupId, user_id: userId, role: "member" })
  if (e1) return new Response("", { status: 500 })

  const { error: e2 } = await supabase
    .from("invites")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
  if (e2) return new Response("", { status: 500 })

  await supabase
    .from("notifications")
    .insert({ group_id: groupId, type: "invite_consumed", created_at: new Date().toISOString() })

  return new Response(JSON.stringify({ groupId }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  })
}
