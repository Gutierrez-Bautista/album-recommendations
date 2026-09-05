'use client'

import { authClient } from "@/lib/auth-client"
import { useState } from "react"

export function DeleteAccountBtn () {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<null | string>()
  const handleCancel = async () => {
  
    const confirmed = window.confirm(
      'this will delete your account, library, and Spotify connection. It cannot be undone. Are you sure you want to continue?',
    )

    if (!confirmed) {
      return
    }

    alert('After deleting your account, you will be redirected to the main page. You will also need to remove access from Spotify at https://www.spotify.com/account/apps/')

    setPending(true)
    setError(null)

    const result = await authClient.deleteUser({
      callbackURL: '/login?accountDeleted=1',
    })

    if (result.error) {
      if (result.error.code === 'SESSION_NOT_FRESH') {
        setError(
          'Por seguridad, debes volver a iniciar sesión antes de eliminar la cuenta.',
        )
      } else {
        setError(
          'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
        )
      }

      setPending(false)
      return
    }

    // Fallback si Better Auth no realiza automáticamente la redirección.
    window.location.replace('/login?accountDeleted=1')
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="text-sm border rounded-full w-60 px-6 py-2 cursor-pointer transition hover:border-red-600 hover:text-red-600 disabled:opacity-50"
      >
        {pending
          ? 'deleting account'
          : 'Delete account'}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}