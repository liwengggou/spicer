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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Spicer</h1>
      <p className="text-sm opacity-80">Daily Tokyo-time spice challenges for pairs</p>
      <AuthGate>
        <div className="space-y-4">
          <CreateGroup />
          <GroupList />
          
          <ExpiryReminders groupId={selectedGroupId} />
        </div>
      </AuthGate>
    </div>
  )
}
