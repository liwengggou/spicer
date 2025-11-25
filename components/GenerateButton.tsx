"use client"
import { useState } from "react"
import { log } from "../lib/logger"
import { useSession } from "../lib/supabaseClient"

export function GenerateButton({ groupId }: { groupId: string }) {
  const session = useSession()
  const [status, setStatus] = useState<string>("")
  const [result, setResult] = useState<{ title: string; description: string } | null>(null)
  const [pending, setPending] = useState(false)

  async function run() {
    if (!session?.access_token) {
      setStatus("Sign in required")
      return
    }
    setPending(true)
    setStatus("Generating…")
    try {
      const res = await fetch("/api/generate-challenge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ groupId })
      })
      if (!res.ok) {
        const raw = await res.text().catch(() => "")
        let message = `api_generate_challenge_error_${res.status}`
        if (raw) {
          try {
            const parsed = JSON.parse(raw)
            if (parsed?.error) {
              message = parsed.error
            } else if (parsed?.code) {
              message = parsed.code
            }
          } catch {
            message = raw
          }
        }
        throw new Error(message)
      }
      const out = await res.json()
      setResult(out)
      setStatus("Generated")
      log({ name: "generate_challenge_ok", group_id: groupId, data: { title: out?.title } })
    } catch (err) {
      const msg = typeof err === "string" ? err : (err && (err as Error).message) || "error"
      setStatus(`Failed: ${msg}`)
      log({ name: "generate_challenge_error", group_id: groupId, error: msg })
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="space-y-3">
      <button
        onClick={run}
        disabled={pending}
        className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-primary text-background-dark text-sm font-semibold tracking-[0.015em] glow-effect transition-transform active:scale-95 disabled:opacity-60"
      >
        {pending ? "Working..." : "Generate"}
      </button>
      {status && <p className="text-xs opacity-80">{status}</p>}
      {result && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
          <div className="font-medium">{result.title}</div>
          <div className="text-sm opacity-80">{result.description}</div>
        </div>
      )}
    </div>
  )
}
