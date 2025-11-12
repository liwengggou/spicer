"use client"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { DateTime } from "luxon"
import { logger } from "../lib/logger"

interface Reminder {
  id: string
  title: string
  description: string
  scheduled_at: string
  expires_at: string
  time_until_expiry: string
  is_urgent: boolean
}

export function ExpiryReminders({ groupId }: { groupId: string }) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReminders()
    
    // Check every minute for updates
    const interval = setInterval(loadReminders, 60000)
    return () => clearInterval(interval)
  }, [groupId])

  const loadReminders = async () => {
    try {
      logger.info("Loading expiry reminders", { groupId })
      
      if (!supabase) {
        throw new Error("Supabase client not available")
      }
      
      const now = DateTime.now().setZone("Asia/Tokyo")
      const { data, error } = await supabase
        .from("challenges")
        .select("id, title, description, scheduled_at, expires_at, status")
        .eq("group_id", groupId)
        .eq("status", "Incomplete")
        .gt("expires_at", now.toISO())
        .lt("expires_at", now.plus({ hours: 2 }).toISO())
        .order("expires_at", { ascending: true })

      if (error) throw error

      const remindersData: Reminder[] = (data || []).map(challenge => {
        const expiresAt = DateTime.fromISO(challenge.expires_at).setZone("Asia/Tokyo")
        const timeUntilExpiry = expiresAt.diff(now).as("minutes")
        
        return {
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          scheduled_at: challenge.scheduled_at,
          expires_at: challenge.expires_at,
          time_until_expiry: formatTimeUntilExpiry(timeUntilExpiry),
          is_urgent: timeUntilExpiry < 30
        }
      })

      setReminders(remindersData)
      logger.info("Expiry reminders loaded", { groupId, count: remindersData.length })
    } catch (err) {
      logger.error("Failed to load expiry reminders", { groupId, error: err })
    } finally {
      setLoading(false)
    }
  }

  const formatTimeUntilExpiry = (minutes: number): string => {
    if (minutes < 1) return "Less than 1 minute"
    if (minutes < 60) return `${Math.ceil(minutes)} minutes`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = Math.ceil(minutes % 60)
    if (remainingMinutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`
    return `${hours}h ${remainingMinutes}m`
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 p-4">
        <h3 className="text-sm font-medium mb-2">Upcoming Expiry</h3>
        <p className="text-xs opacity-60">Loading reminders...</p>
      </div>
    )
  }

  if (reminders.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-white/10 p-4">
      <h3 className="text-sm font-medium mb-3">⏰ Upcoming Expiry</h3>
      
      <div className="space-y-2">
        {reminders.map(reminder => (
          <div 
            key={reminder.id}
            className={`p-2 rounded border text-xs ${
              reminder.is_urgent 
                ? "bg-red-900/20 border-red-600/30" 
                : "bg-yellow-900/20 border-yellow-600/30"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium">{reminder.title}</p>
                <p className="opacity-70 mt-1">{reminder.description}</p>
              </div>
              
              <div className="text-right ml-2">
                <p className={`font-medium ${
                  reminder.is_urgent ? "text-red-300" : "text-yellow-300"
                }`}>
                  {reminder.time_until_expiry}
                </p>
                <p className="opacity-60">
                  {DateTime.fromISO(reminder.expires_at).setZone("Asia/Tokyo").toFormat("HH:mm")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-xs opacity-60 mt-3">
        These challenges will expire soon. Complete them with your partner before time runs out!
      </p>
    </div>
  )
}