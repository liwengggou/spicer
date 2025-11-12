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
    <div className="space-y-2">
      <button onClick={run} className="rounded bg-white px-3 py-2 text-black">Generate</button>
      {status && <p className="text-xs opacity-80">{status}</p>}
      {result && (
        <div className="rounded border border-white/10 p-3">
          <div className="font-medium">{result.title}</div>
          <div className="text-sm opacity-80">{result.description}</div>
        </div>
      )}
    </div>
  )
}
