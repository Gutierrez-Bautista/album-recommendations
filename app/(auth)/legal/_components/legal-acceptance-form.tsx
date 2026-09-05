'use client'

import { useState } from 'react'
import Link from 'next/link'

import { acceptLegalTerms } from '../actions'
import { authClient } from '@/lib/auth-client'

function CancelLegalOnboardingButton({
  pending,
  setPending,
}: {
  pending: boolean
  setPending: (pending: boolean) => void
}) {
  const [error, setError] = useState<string | null>(null)

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
          : 'Decline and delete account'}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export default function LegalAcceptanceForm() {
  const [accepted, setAccepted] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <form action={acceptLegalTerms}>
      <label className='flex items-center gap-2 max-sm:items-start'>
        <input
          type="checkbox"
          name="legalAcceptance"
          checked={accepted}
          onChange={(event) => {
            setAccepted(event.target.checked)
          }}
          disabled={deleting}
          required
          className='size-5 cursor-pointer accent-(--app-primary-light)'
        />

        <span>
          I accept the{' '}
          <Link href="/terms" className='text-(--app-primary-light) underline'>
            Terms and Conditions
          </Link>{' '}
          and acknowledge that I have read the{' '}
          <Link href="/privacy" className='text-(--app-primary-light) underline'>
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      <div className='flex max-sm:flex-col max-sm:items-center px-8 gap-5 justify-center mt-5'>
        <CancelLegalOnboardingButton pending={deleting} setPending={setDeleting} />

        <button
          type="submit"
          disabled={!accepted || deleting}
          className={`px-6 py-2 w-60 rounded-full transition ${accepted ? 'cursor-pointer hover:scale-105 bg-(--app-primary) hover:bg-(--app-primary-hover) text-white' : 'opacity-50 cursor-not-allowed bg-gray-700 text-gray-400'}`}
        >
          Accept and continue
        </button>
      </div>

    </form>
  )
}