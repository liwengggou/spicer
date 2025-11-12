import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("supabase_url") || ""
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("service_role_key") || ""
const supabase = createClient(supabaseUrl, supabaseKey)

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status: 200 })
}

function bad(status = 400) {
  return new Response("", { status })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return bad(405)
  const input = await req.json()
  const { token, userId } = input as { token: string; userId: string }
  const { data: inv } = await supabase.from("invites").select("group_id,used_at").eq("token", token).limit(1).maybeSingle()
  if (!inv || inv.used_at) return bad(409)
  const group_id = inv.group_id
  const { error: e1 } = await supabase.from("group_participants").insert({ group_id, user_id: userId, role: "member" })
  if (e1) return bad(500)
  const { error: e2 } = await supabase.from("invites").update({ used_at: new Date().toISOString() }).eq("token", token)
  if (e2) return bad(500)
  await supabase.from("notifications").insert({ group_id, type: "invite_consumed", created_at: new Date().toISOString() })
  return ok({ groupId: group_id })
}
