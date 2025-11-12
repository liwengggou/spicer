"use client"
import { useEffect, useState } from "react"
import { AuthGate } from "../components/AuthGate"
import { supabase, useSession } from "../lib/supabaseClient"
import Link from "next/link"
import { GenerateButton } from "../components/GenerateButton"
import { NotificationsFeed } from "../components/NotificationsFeed"
import { CreateGroup } from "../components/CreateGroup"
import { GroupList } from "../components/GroupList"
import { ExpiryReminders } from "../components/ExpiryReminders"

export default function HomePage() {
  const session = useSession()
  const [selectedGroupId, setSelectedGroupId] = useState<string>("demo")
  const [isCreating, setIsCreating] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const handleCTA = async () => {
    if (!session && supabase) {
      await supabase.auth.signInWithOAuth({ provider: "google" })
      return
    }
    try {
      setIsCreating(true)
      setError(null)
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error("No user ID")
      const res = await fetch("/api/create-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      })
      if (!res.ok) throw new Error("Failed to create group")
      const payload = await res.json()
      const inviteUrl = `${window.location.origin}/invite/${payload.token}`
      setInviteLink(inviteUrl)
      setSelectedGroupId(String(payload.groupId))
    } catch (e: any) {
      setError(e?.message || "Failed to create group")
    } finally {
      setIsCreating(false)
    }
  }
  
  // Pick the most recent group after sign-in
  useEffect(() => {
    async function pickLatest() {
      if (!session || !supabase) return
      const { data } = await supabase
        .from("group_participants")
        .select("group_id")
        .limit(1)
      const first = data && data[0]
      if (first?.group_id) setSelectedGroupId(String(first.group_id))
    }
    pickLatest()
  }, [session])
  
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
            <GroupList />
            <ExpiryReminders groupId={selectedGroupId} />
          </div>
        </AuthGate>
      </div>
    </div>
  )
}
