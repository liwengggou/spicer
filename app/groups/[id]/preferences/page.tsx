"use client"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { supabase, useSession } from "../../../../lib/supabaseClient"
import { DateTime } from "luxon"
import { logger } from "../../../../lib/logger"
import { z } from "zod"
import { isPreferencesFrozen, getCurrentWeekStart, getNextWeekStart } from "../../../../lib/preferences"

const PrefSchema = z.object({
  spiceLevel: z.number().min(1).max(5),
  timesPerDay: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  keywords: z.string().optional(),
  longDistance: z.boolean(),
})

export default function PreferencesPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const session = useSession()
  const [form, setForm] = useState({ spiceLevel: 3, timesPerDay: 2, keywords: "", longDistance: false })
  const [status, setStatus] = useState<string>("")
  const [isFrozen, setIsFrozen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [deleteStatus, setDeleteStatus] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [role, setRole] = useState<"creator" | "member" | null>(null)

  const loadCurrentPreferences = useCallback(async () => {
    try {
      if (!supabase) {
        logger.error("Supabase client not available")
        return
      }
      
      const { data, error } = await supabase
        .from("preferences_weekly")
        .select("*")
        .eq("group_id", String(id))
        .order("week_start_tokyo", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data && !error) {
        setForm({
          spiceLevel: data.spice_level,
          timesPerDay: data.times_per_day,
          keywords: data.keywords || "",
          longDistance: data.long_distance
        })
      }
    } catch (err) {
      logger.info("No current preferences found", { groupId: String(id) })
    }
  }, [id])

  useEffect(() => {
    const frozen = isPreferencesFrozen()
    setIsFrozen(frozen)
    loadCurrentPreferences()
  }, [loadCurrentPreferences])

  const loadMembership = useCallback(async () => {
    if (!supabase || !session?.user?.id) return
    try {
      const { data, error } = await supabase
        .from("group_participants")
        .select("role")
        .eq("group_id", String(id))
        .eq("user_id", session.user.id)
        .maybeSingle()
      if (error) throw error
      setRole((data?.role as "creator" | "member" | null) || null)
    } catch (err) {
      logger.error("Failed to load membership", { groupId: String(id), error: err })
    }
  }, [id, session?.user?.id])

  useEffect(() => {
    loadMembership()
  }, [loadMembership])

  const isCreator = role === "creator"

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => {
      if (k === "longDistance" && f.longDistance !== v) {
        logger.longDistanceToggled(String(id), v as boolean)
      }
      return { ...f, [k]: v }
    })
  }

  async function save() {
    if (!isCreator) {
      setStatus("Only the creator can edit preferences")
      return
    }
    const parsed = PrefSchema.safeParse(form)
    if (!parsed.success) return setStatus("Invalid preferences")
    
    setIsCreating(true)
    
    try {
      if (!supabase) {
        throw new Error("Supabase client not available")
      }

      const nowTokyo = DateTime.now().setZone("Asia/Tokyo")
      const frozenNow = isPreferencesFrozen(nowTokyo)
      const targetWeekStart = frozenNow ? getNextWeekStart(nowTokyo) : getCurrentWeekStart(nowTokyo)
      
      logger.info("Saving preferences", { 
        groupId: String(id), 
        weekStart: targetWeekStart, 
        isFrozen: frozenNow,
        preferences: parsed.data 
      })
      
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("Missing session token")

      const res = await fetch("/api/save-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          groupId: String(id),
          preferences: {
            spiceLevel: form.spiceLevel,
            timesPerDay: form.timesPerDay as 1|2|3,
            keywords: form.keywords || "",
            longDistance: form.longDistance,
          }
        })
      })
      if (res.status === 409) {
        const payload = await res.json().catch(() => null)
        const appliesTo = payload?.weekStart || targetWeekStart
        const formattedWeek = DateTime.fromISO(appliesTo, { zone: "Asia/Tokyo" }).toFormat("MMM d, yyyy")
        setIsFrozen(true)
        setStatus(`Preferences frozen mid-week. Saved for next week starting ${formattedWeek}.`)
        logger.preferencesSaved(String(id), parsed.data, appliesTo, true)
        return
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        const message = res.status === 403 ? "Only the creator can edit preferences" : text
        throw new Error(message || `save_preferences_${res.status}`)
      }
      const payload = await res.json().catch(() => null)
      
      const appliesTo = payload?.weekStart || targetWeekStart
      const appliedFrozen = payload?.frozen ?? frozenNow
      const formattedWeek = DateTime.fromISO(appliesTo, { zone: "Asia/Tokyo" }).toFormat("MMM d, yyyy")
      setIsFrozen(appliedFrozen)
      setStatus(appliedFrozen ? `Saved for week starting ${formattedWeek}` : "Saved")
      logger.preferencesSaved(String(id), parsed.data, appliesTo, appliedFrozen)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed")
      logger.error("Failed to save preferences", { error: e })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!isCreator) {
      setDeleteStatus("Only the creator can delete this group")
      return
    }
    if (!deleteConfirmVisible) {
      setDeleteConfirmVisible(true)
      setDeleteStatus("Type DELETE to confirm.")
      return
    }
    if (deleteInput !== "DELETE") {
      setDeleteStatus("Please type DELETE to confirm.")
      return
    }
    setIsDeleting(true)
    setDeleteStatus("")
    try {
      if (!supabase) throw new Error("Supabase client not available")
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("Missing session token")
      const res = await fetch(`/api/groups/${id}/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `delete_group_${res.status}`)
      }
      setDeleteStatus("Group deleted. Redirecting…")
      router.replace("/")
    } catch (err) {
      setDeleteStatus(err instanceof Error ? err.message : "Failed to delete group")
    } finally {
      setIsDeleting(false)
    }
  }

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
              Preferences
            </h1>
            <p className="text-white/80 text-base font-medium leading-normal pt-3 max-w-xs">
              Group: {String(id)}
            </p>
          </div>
        </div>
      </section>

      {!isCreator && (
        <div className="p-3 bg-red-900/20 border border-red-600/30 rounded">
          <p className="text-sm text-red-200">
            You&apos;re a member of this group. Only the creator can edit preferences or delete the group.
          </p>
        </div>
      )}

      {isFrozen && (
        <div className="p-3 bg-yellow-900/20 border border-yellow-600/30 rounded">
          <p className="text-sm text-yellow-400">
            ⚠️ Preferences are frozen for this week (mid-week policy). Changes will apply starting next week.
          </p>
        </div>
      )}

      <div className="space-y-4 bg-white/5 border border-white/10 rounded-lg p-4">
        <label className="block text-white/90">Spice Level
          <input
            type="number"
            min={1}
            max={5}
            value={form.spiceLevel}
            onChange={(e) => update("spiceLevel", Number(e.target.value))}
            className="mt-1 w-24 rounded bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-white/50 disabled:opacity-60"
            disabled={isCreating || !isCreator}
          />
        </label>
        <label className="block text-white/90">Times Per Day
          <select
            value={form.timesPerDay}
            onChange={(e) => update("timesPerDay", Number(e.target.value) as 1|2|3)}
            className="mt-1 rounded bg-white/5 border border-white/10 px-3 py-2 text-white disabled:opacity-60"
            disabled={isCreating || !isCreator}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        <label className="block text-white/90">Keywords
          <input
            type="text"
            value={form.keywords}
            onChange={(e) => update("keywords", e.target.value)}
            className="mt-1 w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-white/50 disabled:opacity-60"
            disabled={isCreating || !isCreator}
            placeholder="e.g., surprises, outdoors"
          />
        </label>
        <label className="flex items-center gap-2 text-white/90">
          <input
            type="checkbox"
            checked={form.longDistance}
            onChange={(e) => update("longDistance", e.target.checked)}
            disabled={isCreating || !isCreator}
            className="rounded border-white/20 bg-white/5"
          />
          Long-Distance Relationship Mode
        </label>
        <div className="pt-2">
          <button
            onClick={save}
            className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-6 bg-primary text-background-dark text-base font-semibold leading-normal tracking-[0.015em] glow-effect transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isCreating || !isCreator}
          >
            <span className="truncate">
              {isCreator ? (isFrozen ? "Save for Next Week" : "Save Preferences") : "Creator only"}
            </span>
          </button>
        </div>
        {status && <p className="text-sm text-white/80">{status}</p>}
      </div>

      <div className="space-y-3 bg-red-950/20 border border-red-600/40 rounded-lg p-4">
        <div>
          <h3 className="text-base font-semibold text-red-200">Danger zone</h3>
          <p className="text-xs text-red-200/70">
            Deleting a group permanently removes preferences, challenges, and history for both participants.
          </p>
        </div>
        {deleteConfirmVisible ? (
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-red-200/80">Type DELETE to confirm</label>
            <input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              className="w-full rounded bg-red-950/40 border border-red-500/40 px-3 py-2 text-sm text-white"
              placeholder="DELETE"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting || !isCreator}
                className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold h-11 glow-effect disabled:opacity-60"
              >
                {isDeleting ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmVisible(false)
                  setDeleteInput("")
                  setDeleteStatus("")
                }}
                className="flex-1 rounded-full border border-white/20 text-sm h-11"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirmVisible(true)}
            className="rounded-full bg-red-700/80 hover:bg-red-600 transition text-sm font-semibold h-11 px-6 disabled:opacity-50"
            disabled={!isCreator}
          >
            Delete group
          </button>
        )}
        {deleteStatus && <p className="text-xs text-red-200/80">{deleteStatus}</p>}
      </div>
    </div>
  )
}
