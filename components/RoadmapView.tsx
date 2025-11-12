"use client"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { DateTime } from "luxon"
import { logger } from "../lib/logger"

interface Challenge {
  id: string
  title: string
  description: string
  scheduled_at: string
  status: string
  long_distance: boolean
}

interface WeekGroup {
  weekStart: string
  weekLabel: string
  challenges: Challenge[]
}

export function RoadmapView({ groupId }: { groupId: string }) {
  const [weeks, setWeeks] = useState<WeekGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRoadmap()
  }, [groupId])

  const loadRoadmap = async () => {
    try {
      logger.info("Loading roadmap", { groupId })
      
      if (!supabase) {
        throw new Error("Supabase client not available")
      }
      
      const { data, error } = await supabase
        .from("challenges")
        .select("id, title, description, scheduled_at, status, long_distance")
        .eq("group_id", groupId)
        .order("scheduled_at", { ascending: true })

      if (error) throw error

      // Group challenges by week (Tokyo timezone)
      const weekGroups: { [key: string]: Challenge[] } = {}
      
      data?.forEach(challenge => {
        const scheduledDate = DateTime.fromISO(challenge.scheduled_at).setZone("Asia/Tokyo")
        const weekStart = scheduledDate.startOf("week").toFormat("yyyy-MM-dd")
        
        if (!weekGroups[weekStart]) {
          weekGroups[weekStart] = []
        }
        weekGroups[weekStart].push(challenge)
      })

      // Convert to array and add labels
      const weeksArray: WeekGroup[] = Object.entries(weekGroups)
        .map(([weekStart, challenges]) => {
          const weekDate = DateTime.fromISO(weekStart).setZone("Asia/Tokyo")
          const weekEnd = weekDate.endOf("week")
          
          return {
            weekStart,
            weekLabel: `${weekDate.toFormat("MMM d")} - ${weekEnd.toFormat("MMM d, yyyy")}`,
            challenges
          }
        })
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart))

      setWeeks(weeksArray)
      logger.roadmapRendered(groupId, weeksArray.length)
      logger.historyRetrieved(groupId, data?.length || 0)
    } catch (err) {
      logger.error("Failed to load roadmap", { groupId, error: err })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Roadmap</h2>
        <p className="text-sm opacity-80">Loading roadmap...</p>
      </div>
    )
  }

  if (weeks.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Roadmap</h2>
        <p className="text-sm opacity-80">No challenges scheduled yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">Roadmap</h2>
      
      <div className="space-y-6">
        {weeks.map(week => (
          <div key={week.weekStart} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-medium mb-3 opacity-80">{week.weekLabel}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {week.challenges.map(challenge => {
                const scheduledTime = DateTime.fromISO(challenge.scheduled_at).setZone("Asia/Tokyo")
                const isComplete = challenge.status === "Complete"
                const isExpired = scheduledTime < DateTime.now().setZone("Asia/Tokyo") && !isComplete
                
                return (
                  <div 
                    key={challenge.id}
                    className={`p-3 rounded-lg border ${
                      isComplete 
                        ? "bg-green-900/20 border-green-600/30" 
                        : isExpired 
                        ? "bg-red-900/20 border-red-600/30"
                        : "bg-gray-900/20 border-gray-600/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium">{challenge.title}</h4>
                      <div className="flex items-center gap-1">
                        {challenge.long_distance && (
                          <span className="text-xs bg-blue-600/20 text-blue-300 px-1 py-0.5 rounded">
                            📱
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isComplete 
                            ? "bg-green-600/20 text-green-300" 
                            : isExpired 
                            ? "bg-red-600/20 text-red-300"
                            : "bg-yellow-600/20 text-yellow-300"
                        }`}>
                          {isComplete ? "Complete" : isExpired ? "Expired" : "Pending"}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-xs opacity-80 mb-2">{challenge.description}</p>
                    
                    <p className="text-xs opacity-60">
                      {scheduledTime.toFormat("EEE, MMM d @ HH:mm")} Tokyo
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
