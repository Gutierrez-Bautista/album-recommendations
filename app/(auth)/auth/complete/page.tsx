import { redirect } from 'next/navigation'

import {
  hasCurrentLegalAcceptance,
  requireSession,
} from '@/lib/auth-guards'

export default async function CompleteLoginPage() {
  const session = await requireSession()

  const hasAccepted =
    await hasCurrentLegalAcceptance(session.user.id)

  if (!hasAccepted) {
    redirect('/legal')
  }

  redirect('/')
}