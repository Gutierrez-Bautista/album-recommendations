'use server'

import { redirect } from 'next/navigation'

import db from '@/src/db'
import {
  userLegalAcceptances,
} from '@/src/db/schema'
import { requireSession } from '@/lib/auth-guards'
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '@/lib/legal'

export async function acceptLegalTerms(
  formData: FormData,
) {
  const legalAccepted =
    formData.get('legalAcceptance') === 'on'

  if (!legalAccepted) {
    throw new Error(
      'You must accept the legal terms to continue.',
    )
  }

  const session = await requireSession()

  await db
    .insert(userLegalAcceptances)
    .values({
      userId: session.user.id,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyPolicyVersion: CURRENT_PRIVACY_VERSION,
      acceptedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [
        userLegalAcceptances.userId,
        userLegalAcceptances.termsVersion,
        userLegalAcceptances.privacyPolicyVersion,
      ],
    })

  redirect('/')
}