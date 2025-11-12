"use client"
import { useState, useEffect } from "react"
import { supabase } from "../lib/supabaseClient"
import { logger } from "../lib/logger"

export function CreateGroup() {
  const [isCreating, setIsCreating] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      if (!supabase) {
        console.error("Supabase client not available")
        return
      }
      
      console.log("Checking authentication status...")
      const { data, error } = await supabase.auth.getUser()
      console.log("Auth check result:", { data, error })
      setUser(data.user)
      
      if (!data.user) {
        setError("Please sign in first to create a group")
      } else {
        console.log("User is authenticated:", data.user.id)
        // Test database connectivity
        try {
          console.log("Testing database connectivity...")
          const { data: testData, error: testError } = await supabase
            .from("groups")
            .select("id")
            .limit(1)
          
          console.log("Database test result:", { testData, testError })
          
          if (testError) {
            console.error("Database connectivity issue:", testError)
            setError(`Database error: ${testError.message}`)
          }
        } catch (dbError) {
          console.error("Database test failed:", dbError)
          setError("Database connection failed")
        }
      }
    }
    
    checkAuth()
  }, [])

  const handleCreateGroup = async () => {
    setIsCreating(true)
    setError(null)
    
    try {
      logger.info("Creating new group")
      console.log("Starting group creation...")
      
      if (!supabase) {
        console.error("Supabase client not available")
        throw new Error("Supabase client not available")
      }
      
      console.log("Getting current user...")
      const { data: userData, error: userError } = await supabase.auth.getUser()
      console.log("User data:", userData)
      console.log("User error:", userError)
      
      const userId = userData.user?.id
      if (!userId) {
        console.error("No user ID found")
        throw new Error("No user ID")
      }
      
      console.log("Calling server API to create group...")
      const res = await fetch("/api/create-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      })
      if (!res.ok) {
        console.error("Server API error:", res.status)
        throw new Error("Failed to create group")
      }
      const payload = await res.json()
      logger.groupCreated(payload.groupId, userId)
      const inviteUrl = `${window.location.origin}/invite/${payload.token}`
      setInviteLink(inviteUrl)
      logger.inviteGenerated(payload.groupId, payload.token)
      console.log("Group creation completed successfully!")

    } catch (err) {
      logger.error("Failed to create group", { error: err })
      console.error("Group creation error:", err)
      setError(err instanceof Error ? err.message : "Failed to create group")
    } finally {
      setIsCreating(false)
    }
  }

  const copyToClipboard = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink)
      logger.info("Invite link copied to clipboard")
    }
  }

  return (
    <div className="rounded-lg border border-white/10 p-4">
      <h2 className="text-lg font-medium mb-3">Create New Group</h2>
      
      {!inviteLink ? (
        <div className="space-y-3">
          <p className="text-sm opacity-80">
            Create a new spice challenge group for you and a partner.
          </p>
          
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 p-2 rounded">
              {error}
            </div>
          )}
          
          <button
            onClick={handleCreateGroup}
            disabled={isCreating || !user}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-medium transition-colors"
          >
            {isCreating ? "Creating..." : user ? "Create Group" : "Sign in to Create Group"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-green-400">Group created successfully!</p>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Invite Link:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
              />
              <button
                onClick={copyToClipboard}
                className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
          
          <p className="text-xs opacity-60">
            Share this link with your partner. They'll join the group when they click it.
          </p>
        </div>
      )}
    </div>
  )
}
