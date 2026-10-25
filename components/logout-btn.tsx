'use client'

import { authClient } from "@/lib/auth-client";
import { useRef, useState } from "react";

export function useSignOut() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  async function signOut() {
    if (inFlight.current) return

    inFlight.current = true
    setPending(true)
    setError(null)

    try {
      const result = await authClient.signOut({ callbackURL: '/login' })
      if (result.error) {
        setError('Unable to sign out. Please try again.')
      } else {
        window.location.replace(result.data?.url || '/')
        return
      }
    } catch {
      setError('Unable to sign out. Please try again.')
    }

    inFlight.current = false
    setPending(false)
  }

  return { signOut, pending, error }
}

export default function LogoutButton () {
  const { signOut, pending, error } = useSignOut()

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="bg-(--app-primary) px-6 py-2 rounded-full cursor-pointer hover:bg-(--app-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--app-primary-light) disabled:cursor-not-allowed disabled:opacity-50"
        onClick={signOut}
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-(--danger)">{error}</p>}
    </div>
  )
}
