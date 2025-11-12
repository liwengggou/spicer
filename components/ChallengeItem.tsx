"use client"
import { supabase, useSession } from "../lib/supabaseClient"
import { formatTokyo } from "../lib/time"
import { useState } from "react"
import { log } from "../lib/logger"

export function ChallengeItem({ c }: { c: any }) {
  const session = useSession()
  const [status, setStatus] = useState(c.status)
  const isComplete = status === "Complete"
  const isExpired = new Date(c.scheduled_at).getTime() < Date.now() && !isComplete
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
    <li className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">{c.title}</h3>
          <p className="text-sm opacity-80">{c.description}</p>
        </div>
        <div className="flex items-center gap-1">
          {c.long_distance && (
            <span className="text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded-full">📱</span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isComplete
                ? "bg-green-600/20 text-green-300"
                : isExpired
                ? "bg-red-600/20 text-red-300"
                : "bg-yellow-600/20 text-yellow-300"
            }`}
          >
            {isComplete ? "Complete" : isExpired ? "Expired" : "Pending"}
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs opacity-60">{formatTokyo(c.scheduled_at)}</span>
        <button
          onClick={toggleComplete}
          className="rounded-full bg-primary text-background-dark glow-effect text-xs font-semibold px-3 py-2 transition-transform active:scale-95"
        >
          Mark complete
        </button>
      </div>
    </li>
  )
}
