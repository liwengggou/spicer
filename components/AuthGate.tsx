"use client"
import { PropsWithChildren } from "react"
import { useSession, supabase } from "../lib/supabaseClient"

export function AuthGate({ children }: PropsWithChildren) {
  const session = useSession()
  
  const handleSignIn = async () => {
    if (!supabase) {
      console.error("Supabase client is null")
      return
    }
    
    try {
      await supabase.auth.signInWithOAuth({ provider: "google" })
    } catch (error) {
      console.error("OAuth sign in error:", error)
    }
  }
  
  if (!session) {
    return (
      <div className="space-y-4">
        <p className="text-sm">Sign in with Google to continue</p>
        <button
          className="rounded bg-white px-3 py-2 text-black"
          onClick={handleSignIn}
        >
          Sign in with Google
        </button>
      </div>
    )
  }
  return <>{children}</>
}
