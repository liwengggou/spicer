"use client"
import { useState } from "react"
import { AuthGate } from "../components/AuthGate"
import { supabase, useSession } from "../lib/supabaseClient"
import { NotificationsFeed } from "../components/NotificationsFeed"
import { GroupList } from "../components/GroupList"
import { ExpiryReminders } from "../components/ExpiryReminders"

export default function HomePage() {
  const session = useSession()
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [groupRefreshToken, setGroupRefreshToken] = useState(0)
  const handleCTA = async () => {
    if (!session && supabase) {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: typeof window !== "undefined" ? window.location.href : undefined }
      })
      return
    }
    try {
      setIsCreating(true)
      setError(null)
      const token = session?.access_token
      if (!token) throw new Error("No session token")
      const res = await fetch("/api/create-group", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      })
      if (!res.ok) throw new Error("Failed to create group")
      const payload = await res.json()
      const inviteUrl = `${window.location.origin}/invite/${payload.token}`
      setInviteLink(inviteUrl)
      setSelectedGroupId(String(payload.groupId))
      setGroupRefreshToken((prev) => prev + 1)
    } catch (e: any) {
      setError(e?.message || "Failed to create group")
    } finally {
      setIsCreating(false)
    }
  }
  
  // Pick the most recent group after sign-in
  return (
    <div className="space-y-10">
      <section className="relative flex w-full items-center justify-center overflow-hidden">
        <div
          className="absolute top-1/4 -left-1/4 w-[150vw] h-[150vw] md:w-[100vw] md:h-[100vw] gradient-blob"
          aria-hidden="true"
        />
        <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-end px-2 pb-8 text-center">
          <div className="flex-grow flex flex-col justify-center items-center pt-8">
            <h1 className="text-white tracking-tight text-4xl font-semibold leading-tight max-w-sm">
              Daily challenges. Custom to your mood.
            </h1>
            <p className="text-white/80 text-base font-medium leading-normal pt-3 max-w-xs">
              Built by AI. Inspired by your love story.
            </p>
          </div>
          <div className="flex w-full pt-8">
            <button
              onClick={handleCTA}
              className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-full h-14 px-5 bg-primary text-background-dark text-base font-semibold leading-normal tracking-[0.015em] glow-effect transition-transform active:scale-95"
              disabled={isCreating}
            >
              <span className="truncate">{isCreating ? "Creating..." : "Let’s Spice Things Up"}</span>
            </button>
          </div>
          {error && (
            <div className="mt-4 text-sm text-red-400 bg-red-900/20 p-2 rounded">
              {error}
            </div>
          )}
          {inviteLink && (
            <div className="mt-6 w-full text-left space-y-2">
              <p className="text-sm text-green-400">Group created successfully!</p>
              <label className="text-sm font-medium">Invite Link:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded"
                />
                <button
                  onClick={async () => navigator.clipboard.writeText(inviteLink)}
                  className="px-3 py-2 bg-primary text-background-dark rounded glow-effect text-sm"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div id="post-hero" className="space-y-6">
        <AuthGate>
          <div className="space-y-4">
            <GroupList
              selectedGroupId={selectedGroupId ?? undefined}
              onSelect={setSelectedGroupId}
              refreshKey={groupRefreshToken}
            />
            {selectedGroupId ? (
              <>
                <ExpiryReminders groupId={selectedGroupId} />
                <NotificationsFeed groupId={selectedGroupId} />
              </>
            ) : (
              <p className="text-sm text-white/70">Pick a group to see reminders and notifications.</p>
            )}
          </div>
        </AuthGate>
      </div>
    </div>
  )
}
