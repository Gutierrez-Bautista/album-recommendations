'use client'

import { authClient } from "@/lib/auth-client"
import { useRef, useState } from "react"

export function useDeleteAccount() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  async function deleteAccount() {
    if (inFlight.current) return

    const confirmed = window.confirm(
      'this will delete your account, library, and Spotify connection. It cannot be undone. Are you sure you want to continue?',
    )

    if (!confirmed) {
      return
    }

    window.alert('After deleting your account, you will be redirected to the main page. You will also need to remove access from Spotify at https://www.spotify.com/account/apps/')

    inFlight.current = true
    setPending(true)
    setError(null)

    try {
      const result = await authClient.deleteUser({
        callbackURL: '/login?accountDeleted=1',
      })

      if (result.error) {
        setError(result.error.code === 'SESSION_NOT_FRESH'
          ? 'For your security, sign in again before deleting your account.'
          : 'Unable to delete your account. Please try again.')
      } else {
        // Fallback if Better Auth does not redirect automatically.
        window.location.replace('/login?accountDeleted=1')
        return
      }
    } catch {
      setError('Unable to delete your account. Please try again.')
    }

    inFlight.current = false
    setPending(false)
  }

  return { deleteAccount, pending, error }
}

export function DeleteAccountBtn () {
  const { deleteAccount, pending, error } = useDeleteAccount()

  return (
    <div>
      <button
        type="button"
        onClick={deleteAccount}
        disabled={pending}
        className="text-sm border rounded-full w-60 max-w-full px-6 py-2 cursor-pointer transition hover:border-(--danger) hover:text-(--danger) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--danger) disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? 'Deleting account…'
          : 'Delete account'}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-(--danger)">
          {error}
        </p>
      )}
    </div>
  )
}
