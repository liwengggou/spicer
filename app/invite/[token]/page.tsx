"use client"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase, useSession } from "../../../lib/supabaseClient"
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ token })
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
          className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-full h-14 px-5 bg-primary text-background-dark text-base font-semibold leading-normal tracking-[0.015em] glow-effect transition-transform active:scale-95"
        >
          Sign in with Google
        </button>
      )}
    </div>
  )
}
