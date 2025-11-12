"use client"
import { supabase } from "../../../../lib/supabaseClient"
import { useEffect, useState } from "react"
import { log } from "../../../../lib/logger"
import { ChallengeItem } from "../../../../components/ChallengeItem"
import { RoadmapView } from "../../../../components/RoadmapView"
import { useParams } from "next/navigation"
import { GenerateButton } from "../../../../components/GenerateButton"

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>()
  const [items, setItems] = useState<any[]>([])
  
  useEffect(() => {
    async function load() {
      try {
        if (!supabase) {
          console.error("Supabase client not available")
          return
        }
        
        const { data, error } = await supabase
          .from("challenges")
          .select("id,title,description,scheduled_at,status,long_distance")
          .eq("group_id", String(id))
          .order("scheduled_at", { ascending: false })
          
        if (error) throw error
        setItems(data || [])
        log({ name: "history_loaded", data: { count: (data || []).length } })
      } catch (err) {
        console.error("Failed to load history", err)
      }
    }
    load()
  }, [id])
  
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">History & Roadmap</h1>
      <div className="p-3 bg-purple-600/20 border border-purple-600/30 rounded">
        <div className="text-sm font-medium mb-2">Generate Challenge</div>
        <GenerateButton groupId={String(id)} />
      </div>
      
      <RoadmapView groupId={String(id)} />
      
      <div className="space-y-4">
        <h2 className="text-lg font-medium">All Challenges</h2>
        <ul className="space-y-3">
          {items.map((c, i) => (
            <ChallengeItem key={i} c={c} />
          ))}
        </ul>
      </div>
    </div>
  )
}
