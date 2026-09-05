import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import db from '@/src/db/index'
import {
  userLegalAcceptances,
} from '@/src/db/schema'

import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '@/lib/legal'

export const getCurrentSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  })
})

export const requireSession = cache(async () => {
  const session = await getCurrentSession()

  if (!session) {
    redirect('/login')
  }

  return session
})

export const hasCurrentLegalAcceptance = cache(
  async (userId: string) => {
    const [acceptance] = await db
      .select({
        userId: userLegalAcceptances.userId,
      })
      .from(userLegalAcceptances)
      .where(
        and(
          eq(
            userLegalAcceptances.userId,
            userId,
          ),
          eq(
            userLegalAcceptances.termsVersion,
            CURRENT_TERMS_VERSION,
          ),
          eq(
            userLegalAcceptances.privacyPolicyVersion,
            CURRENT_PRIVACY_VERSION,
          ),
        ),
      )
      .limit(1)

    return Boolean(acceptance)
  },
)

export const requireAppAccess = cache(async () => {
  const session = await requireSession()

  const hasAccepted =
    await hasCurrentLegalAcceptance(session.user.id)

  if (!hasAccepted) {
    redirect('/legal')
  }

  return session
})