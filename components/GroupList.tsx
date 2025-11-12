"use client"
import { useEffect, useState } from "react"
import { supabase, useSession } from "../lib/supabaseClient"
import Link from "next/link"
import { logger } from "../lib/logger"

interface Group {
  id: string
  created_at: string | null
  role: string
}

export function GroupList() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const session = useSession()

  useEffect(() => {
    if (!session) return
    loadGroups()
  }, [session])

  const loadGroups = async () => {
    try {
      logger.info("Loading user groups")
      
      if (!supabase) {
        throw new Error("Supabase client not available")
      }
      
      const { data, error } = await supabase
        .from("group_participants")
        .select("group_id, role, groups(created_at)")

      if (error) {
        logger.error("Failed to load groups", { error })
        throw error
      }

      const formattedGroups = (data || []).map((item: any) => ({
        id: item.group_id,
        created_at: item.groups?.created_at ?? null,
        role: item.role
      }))

      setGroups(formattedGroups)
      logger.info("Groups loaded", { count: formattedGroups.length })
    } catch (err) {
      logger.error("Error loading groups", { error: err })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 p-4">
        <h2 className="text-lg font-medium mb-3">Your Groups</h2>
        <p className="text-sm opacity-80">Loading groups...</p>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 p-4">
        <h2 className="text-lg font-medium mb-3">Your Groups</h2>
        <p className="text-sm opacity-80">You haven't joined any groups yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/10 p-4">
      <h2 className="text-lg font-medium mb-3">Your Groups</h2>
      
      <div className="space-y-2">
        {groups.map(group => (
          <div key={group.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
            <div>
              <p className="font-medium text-sm">Group {group.id.slice(0, 8)}</p>
              <p className="text-xs opacity-60">
                {group.created_at ? new Date(group.created_at).toLocaleDateString() : ""} • {group.role}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Link
                href={`/groups/${group.id}/preferences`}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Preferences
              </Link>
              <Link
                href={`/groups/${group.id}/history`}
                className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded transition-colors"
              >
                History
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
