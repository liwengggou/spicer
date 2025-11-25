"use client"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { supabase, useSession } from "../lib/supabaseClient"
import { logger } from "../lib/logger"
import { formatTokyoDate } from "../lib/time"

interface Group {
  id: string
  created_at: string | null
  role: string
}

interface Props {
  selectedGroupId?: string | null
  onSelect?: (groupId: string) => void
  refreshKey?: number
}

export function GroupList({ selectedGroupId, onSelect, refreshKey }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const session = useSession()

  const loadGroups = useCallback(async () => {
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
      if (!selectedGroupId && formattedGroups[0]) {
        onSelect?.(formattedGroups[0].id)
      }
      logger.info("Groups loaded", { count: formattedGroups.length })
    } catch (err) {
      logger.error("Error loading groups", { error: err })
    } finally {
      setLoading(false)
    }
  }, [selectedGroupId, onSelect])

  useEffect(() => {
    if (!session) return
    loadGroups()
  }, [session, refreshKey, loadGroups])

  useEffect(() => {
    if (!selectedGroupId && groups[0]) {
      onSelect?.(groups[0].id)
    }
  }, [selectedGroupId, groups, onSelect])

  if (loading) {
    return (
      <section className="relative flex w-full items-center justify-center overflow-hidden">
        <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-end px-2 pb-8 text-center">
          <h2 className="text-white tracking-tight text-2xl font-semibold">Your Group</h2>
          <p className="text-white/80 text-sm font-medium pt-3">Loading groups...</p>
        </div>
      </section>
    )
  }

  if (groups.length === 0) {
    return (
      <section className="relative flex w-full items-center justify-center overflow-hidden">
        <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-end px-2 pb-8 text-center">
          <h2 className="text-white tracking-tight text-2xl font-semibold">Your Group</h2>
          <p className="text-white/80 text-sm font-medium pt-3">You haven&apos;t joined any groups yet.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="relative flex w-full items-center justify-center overflow-hidden">
      <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-end px-2 pb-8 text-center">
        <h2 className="text-white tracking-tight text-2xl font-semibold">Your Group</h2>
        <div className="w-full pt-6 space-y-3">
          {groups.map(group => (
            <div
              key={group.id}
              className={`flex items-center justify-between p-3 border rounded-xl transition hover:border-white/30 ${
                selectedGroupId === group.id ? "bg-primary/10 border-primary/40" : "bg-white/5 border-white/10"
              }`}
            >
              <div>
                <button
                  className="font-semibold text-sm text-left"
                  onClick={() => onSelect?.(group.id)}
                >
                  Group {group.id.slice(0, 8)}
                </button>
                <p className="text-xs opacity-60">
                  {group.created_at ? formatTokyoDate(group.created_at) : ""} • {group.role}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/groups/${group.id}/preferences`}
                  className="flex items-center justify-center h-9 px-4 rounded-full bg-primary text-background-dark text-xs font-semibold glow-effect transition-transform active:scale-95"
                >
                  Preferences
                </Link>
                <Link
                  href={`/groups/${group.id}/history`}
                  className="flex items-center justify-center h-9 px-4 rounded-full bg-white/10 text-white text-xs font-semibold transition-transform active:scale-95"
                >
                  History
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
