"use client"
import { DateTime } from "luxon"
import { formatTokyo } from "../lib/time"
import { useState } from "react"
import { useSession } from "../lib/supabaseClient"

export function ChallengeItem({ c }: { c: any }) {
  const session = useSession()
  const [status, setStatus] = useState(c.status)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const isComplete = status === "Complete"
  const expiresTokyo = DateTime.fromISO(c.expires_at).setZone("Asia/Tokyo")
  const nowTokyo = DateTime.now().setZone("Asia/Tokyo")
  const isExpired = nowTokyo > expiresTokyo && !isComplete
  const statusLabel = isComplete ? "Complete" : "Incomplete"

  async function toggleComplete() {
    if (!session?.access_token || pending || isComplete || isExpired) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/challenges/${c.id}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `status_${res.status}`)
      }
      const body = await res.json()
      if (body?.status) {
        setStatus(body.status)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete challenge")
    } finally {
      setPending(false)
    }
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
            {statusLabel}
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs opacity-60">
        <div className="space-y-1">
          <p>Scheduled: {formatTokyo(c.scheduled_at)} Tokyo</p>
          <p>Expires: {formatTokyo(c.expires_at)} Tokyo</p>
        </div>
        <button
          onClick={toggleComplete}
          disabled={!session || isComplete || isExpired || pending}
          className="rounded-full bg-primary text-background-dark glow-effect text-xs font-semibold px-3 py-2 transition-transform active:scale-95 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Mark complete"}
        </button>
      </div>
      {isExpired && (
        <p className="mt-2 text-xs text-red-300">Past the expiry window in Tokyo; completion is locked.</p>
      )}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </li>
  )
}
