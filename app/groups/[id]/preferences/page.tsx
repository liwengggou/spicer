"use client"
import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { supabase } from "../../../../lib/supabaseClient"
import { DateTime } from "luxon"
import { log, logger } from "../../../../lib/logger"
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
  const [form, setForm] = useState({ spiceLevel: 3, timesPerDay: 2, keywords: "", longDistance: false })
  const [status, setStatus] = useState<string>("")
  const [isFrozen, setIsFrozen] = useState(false)
  const [currentPrefs, setCurrentPrefs] = useState<any>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    const frozen = isPreferencesFrozen()
    setIsFrozen(frozen)
    loadCurrentPreferences()
  }, [])

  const loadCurrentPreferences = async () => {
    try {
      if (!supabase) {
        logger.error("Supabase client not available")
        return
      }
      
      const weekStart = getCurrentWeekStart()
      const { data, error } = await supabase
        .from("preferences_weekly")
        .select("*")
        .eq("group_id", String(id))
        .eq("week_start_tokyo", weekStart)
        .single()

      if (data && !error) {
        setCurrentPrefs(data)
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
  }

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => {
      if (k === "longDistance" && f.longDistance !== v) {
        logger.longDistanceToggled(String(id), v as boolean)
      }
      return { ...f, [k]: v }
    })
  }

  async function save() {
    if (isFrozen && currentPrefs) {
      setStatus("Preferences are frozen for this week. Changes will apply next week.")
      return
    }

    const parsed = PrefSchema.safeParse(form)
    if (!parsed.success) return setStatus("Invalid preferences")
    
    setIsCreating(true)
    
    try {
      const weekStart = isFrozen ? getNextWeekStart() : getCurrentWeekStart()
      
      if (!supabase) {
        throw new Error("Supabase client not available")
      }
      
      logger.info("Saving preferences", { 
        groupId: String(id), 
        weekStart, 
        isFrozen,
        preferences: parsed.data 
      })
      
      const res = await fetch("/api/save-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: String(id),
          weekStart,
          preferences: {
            spiceLevel: form.spiceLevel,
            timesPerDay: form.timesPerDay as 1|2|3,
            keywords: form.keywords || "",
            longDistance: form.longDistance,
          }
        })
      })
      if (!res.ok) throw new Error(`save_preferences_${res.status}`)
      
      setStatus(isFrozen ? "Saved for next week" : "Saved")
      logger.preferencesSaved(String(id), parsed.data, weekStart, isFrozen)
    } catch (e) {
      setStatus("Save failed")
      logger.error("Failed to save preferences", { error: e })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-10">
      <section className="relative flex w-full items-center justify-center overflow-hidden">
        <div
          className="absolute top-1/4 -left-1/4 w-[150vw] h-[150vw] md:w-[100vw] md:h-[100vw] gradient-blob"
          aria-hidden="true"
        />
        <div className="relative z-10 flex w/full max-w-md flex-col items-center justify-end px-2 pb-8 text-center">
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
            disabled={isFrozen && !!currentPrefs}
          />
        </label>
        <label className="block text-white/90">Times Per Day
          <select
            value={form.timesPerDay}
            onChange={(e) => update("timesPerDay", Number(e.target.value) as 1|2|3)}
            className="mt-1 rounded bg-white/5 border border-white/10 px-3 py-2 text-white disabled:opacity-60"
            disabled={isFrozen && !!currentPrefs}
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
            disabled={isFrozen && !!currentPrefs}
            placeholder="e.g., surprises, outdoors"
          />
        </label>
        <label className="flex items-center gap-2 text-white/90">
          <input
            type="checkbox"
            checked={form.longDistance}
            onChange={(e) => update("longDistance", e.target.checked)}
            disabled={isFrozen && !!currentPrefs}
            className="rounded border-white/20 bg-white/5"
          />
          Long-Distance Relationship Mode
        </label>
        <div className="pt-2">
          <button
            onClick={save}
            className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-6 bg-primary text-background-dark text-base font-semibold leading-normal tracking-[0.015em] glow-effect transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isCreating}
          >
            <span className="truncate">{isFrozen && currentPrefs ? "Save for Next Week" : "Save Preferences"}</span>
          </button>
        </div>
        {status && <p className="text-sm text-white/80">{status}</p>}
      </div>
    </div>
  )
}
