import { redirect } from 'next/navigation'

import {
  hasCurrentLegalAcceptance,
  requireSession,
} from '@/lib/auth-guards'

import LegalAcceptanceForm from './_components/legal-acceptance-form'

export default async function LegalPage() {
  const session = await requireSession()

  const hasAccepted =
    await hasCurrentLegalAcceptance(session.user.id)

  if (hasAccepted) {
    redirect('/')
  }

  return (
    <main className='flex justify-center items-center min-h-screen max-sm:px-6'>
      <div className='flex flex-col justify-center items-center sm:bg-zinc-900 sm:p-4 rounded-lg'>
        <h1 className='text-3xl font-bold'>Terms and privacy</h1>

        <p className='my-4 text-center text-zinc-300'>
          You must accept the current legal documents
          before accessing the application.
        </p>

        <LegalAcceptanceForm />

      </div>
    </main>
  )
}