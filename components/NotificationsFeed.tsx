"use client"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

type Item = { id?: string; type: string; created_at: string }

export function NotificationsFeed({ groupId }: { groupId: string }) {
  const [items, setItems] = useState<Item[]>([])
  useEffect(() => {
    if (!supabase) return
    const ch = supabase.channel("notifications").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `group_id=eq.${groupId}` }, (payload) => {
      const row = payload.new as any
      setItems((prev) => [{ type: row.type, created_at: row.created_at }, ...prev].slice(0, 20))
    })
    ch.subscribe()
    return () => {
      ch.unsubscribe()
    }
  }, [groupId])
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Notifications</div>
      <ul className="space-y-1">
        {items.map((n, i) => (
          <li key={i} className="text-xs opacity-80">{n.type} • {new Date(n.created_at).toLocaleString()}</li>
        ))}
      </ul>
    </div>
  )
}
