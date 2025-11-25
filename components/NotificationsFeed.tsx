"use client"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { DateTime } from "luxon"

type Item = { id?: string; type: string; created_at: string; challenge_id?: string }

const LABELS: Record<string, string> = {
  challenge_scheduled: "Challenge scheduled",
  scheduled: "Challenge scheduled",
  participant_completed: "Partner marked complete",
  challenge_completed: "Both complete",
  invite_consumed: "Invite accepted",
  expiry_reminder: "Expiry reminder",
  challenge_expired: "Challenge expired",
}

function describe(item: Item) {
  return LABELS[item.type] || item.type
}

function formatTime(ts: string) {
  return DateTime.fromISO(ts).setZone("Asia/Tokyo").toFormat("MMM d HH:mm")
}

export function NotificationsFeed({ groupId }: { groupId: string }) {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    if (!supabase || !groupId) return

    async function loadInitial() {
      const { data } = await supabase
        .from("notifications")
        .select("id,type,created_at,challenge_id")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(20)
      setItems(data || [])
    }

    loadInitial()

    const ch = supabase
      .channel(`notifications-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as Item
          setItems((prev) => [row, ...prev].slice(0, 20))
        }
      )
    ch.subscribe()
    return () => {
      ch.unsubscribe()
    }
  }, [groupId])

  if (!groupId) return null

  return (
    <div className="rounded-lg border border-white/10 p-4 space-y-2">
      <div className="text-sm font-medium">Notifications</div>
      {items.length === 0 ? (
        <p className="text-xs text-white/70">No notifications yet.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {items.map((n) => (
            <li key={n.id || `${n.type}-${n.created_at}`}
                className="flex items-center justify-between text-white/80">
              <span>{describe(n)}</span>
              <span className="opacity-60">{formatTime(n.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
