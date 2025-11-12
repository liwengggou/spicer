"use client"
import { supabase, useSession } from "../lib/supabaseClient"
import { formatTokyo } from "../lib/time"
import { useState } from "react"
import { log } from "../lib/logger"

export function ChallengeItem({ c }: { c: any }) {
  const session = useSession()
  const [status, setStatus] = useState(c.status)
  async function toggleComplete() {
    if (!supabase || !session) return
    try {
      await supabase.from("challenge_completion").insert({ challenge_id: c.id, user_id: session.user.id, completed_at: new Date().toISOString() })
      const { data } = await supabase.from("challenge_completion").select("user_id").eq("challenge_id", c.id)
      if ((data || []).length >= 2) {
        await supabase.from("challenges").update({ status: "Complete" }).eq("id", c.id)
        setStatus("Complete")
        log({ name: "challenge_both_complete", challenge_id: c.id })
      } else {
        log({ name: "challenge_one_complete", challenge_id: c.id })
      }
    } catch {}
  }
  return (
    <li className="rounded border border-white/10 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{c.title}</h3>
          <p className="text-sm opacity-80">{c.description}</p>
        </div>
        <span className="text-xs opacity-70">{formatTokyo(c.scheduled_at)} • {status} • {c.long_distance ? "LD" : ""}</span>
      </div>
      <div className="mt-2">
        <button onClick={toggleComplete} className="rounded bg-white px-3 py-2 text-black">Mark complete</button>
      </div>
    </li>
  )
}
