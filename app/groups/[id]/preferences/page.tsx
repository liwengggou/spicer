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
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Preferences for {String(id)}</h1>
      
      {isFrozen && (
        <div className="p-3 bg-yellow-900/20 border border-yellow-600/30 rounded">
          <p className="text-sm text-yellow-400">
            ⚠️ Preferences are frozen for this week (mid-week policy). 
            Changes will apply starting next week.
          </p>
        </div>
      )}
      
      <div className="space-y-4">
        <label className="block">Spice Level
          <input 
            type="number" 
            min={1} 
            max={5} 
            value={form.spiceLevel} 
            onChange={(e) => update("spiceLevel", Number(e.target.value))} 
            className="mt-1 w-24 rounded bg-white/10 p-2"
            disabled={isFrozen && !!currentPrefs}
          />
        </label>
        <label className="block">Times Per Day
          <select 
            value={form.timesPerDay} 
            onChange={(e) => update("timesPerDay", Number(e.target.value) as 1|2|3)} 
            className="mt-1 rounded bg-white/10 p-2"
            disabled={isFrozen && !!currentPrefs}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        <label className="block">Keywords
          <input 
            type="text" 
            value={form.keywords} 
            onChange={(e) => update("keywords", e.target.value)} 
            className="mt-1 w-full rounded bg-white/10 p-2"
            disabled={isFrozen && !!currentPrefs}
          />
        </label>
        <label className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={form.longDistance} 
            onChange={(e) => update("longDistance", e.target.checked)}
            disabled={isFrozen && !!currentPrefs}
          />
          Long-Distance Relationship Mode
        </label>
        <button 
          onClick={save} 
          className="rounded bg-white px-3 py-2 text-black disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={isCreating}
        >
          {isFrozen && currentPrefs ? "Save for Next Week" : "Save"}
        </button>
        {status && <p className="text-sm opacity-80">{status}</p>}
      </div>
    </div>
  )
}
