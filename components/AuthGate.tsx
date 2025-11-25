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
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: typeof window !== "undefined" ? window.location.href : undefined }
      })
    } catch (error) {
      console.error("OAuth sign in error:", error)
    }
  }

  const handleSignOut = async () => {
    if (!supabase) return
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Sign out error:", error)
    }
  }
  
  if (!session) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-white/80 text-base font-medium leading-normal text-center pt-3 max-w-xs mx-auto">Sign in with Google to continue</p>
        <button
          className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-full h-14 px-5 bg-primary text-background-dark text-base font-semibold leading-normal tracking-[0.015em] glow-effect transition-transform active:scale-95"
          disabled={!supabase}
          onClick={handleSignIn}
        >
          Sign in with Google
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-3 text-xs text-white/60">
        <span>{session.user?.email || "Signed in"}</span>
        <button
          onClick={handleSignOut}
          className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10 transition"
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  )
}
