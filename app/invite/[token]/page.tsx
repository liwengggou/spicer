"use client"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase, useSession } from "../../../lib/supabaseClient"
import { callEdge } from "../../../lib/edge"
import { logger } from "../../../lib/logger"

export default function InviteJoinPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const session = useSession()
  const [status, setStatus] = useState<string>("Validating invite…")
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    async function consume() {
      if (!session) return setStatus("Sign in required")
      setStatus("Joining group…")
      setJoining(true)
      try {
        const res = await fetch("/api/consume-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, userId: session.user.id })
        })
        if (!res.ok) throw new Error(`consume_invite_${res.status}`)
        const result = await res.json()
        logger.inviteConsumed(token, session.user.id, result.groupId)
        setStatus("Joined! Redirecting…")
        router.replace(`/groups/${result.groupId}/history`)
        return
      } catch (err) {
        logger.error("Failed to consume invite", { token, error: err })
        setStatus("Invite invalid or already used")
        return
      }
      setJoining(false)
    }
    consume()
  }, [session, router, token])

  async function signInWithGoogle() {
    if (!supabase) return
    setStatus("Redirecting to Google…")
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.href : undefined }
    })
  }

  return (
    <div className="space-y-3 text-sm">
      <p>Invite token: {String(token)} — {status}</p>
      {!session && (
        <button
          onClick={signInWithGoogle}
          disabled={joining}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
        >
          Sign in with Google to join
        </button>
      )}
    </div>
  )
}
