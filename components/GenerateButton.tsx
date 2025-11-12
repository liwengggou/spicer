"use client"
import { useState } from "react"
import { callEdge } from "../lib/edge"
import { log } from "../lib/logger"

export function GenerateButton({ groupId }: { groupId: string }) {
  const [status, setStatus] = useState<string>("")
  const [result, setResult] = useState<{ title: string; description: string } | null>(null)
  async function run() {
    setStatus("Generating…")
    try {
      const res = await fetch("/api/generate-challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId }) })
      if (!res.ok) throw new Error(`api_generate_challenge_error_${res.status}`)
      const out = await res.json()
      setResult(out)
      setStatus("Generated")
      log({ name: "generate_challenge_ok", group_id: groupId, data: { title: out?.title } })
    } catch (err) {
      const msg = typeof err === "string" ? err : (err && (err as Error).message) || "error"
      setStatus(`Failed: ${msg}`)
      log({ name: "generate_challenge_error", group_id: groupId, error: msg })
    }
  }
  return (
    <div className="space-y-3">
      <button
        onClick={run}
        className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-primary text-background-dark text-sm font-semibold tracking-[0.015em] glow-effect transition-transform active:scale-95"
      >
        Generate
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
