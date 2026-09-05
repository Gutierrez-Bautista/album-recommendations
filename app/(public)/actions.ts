'use server'
import { cookies } from "next/headers";

export async function setGuestLegalAcceptanceCookie() {
  const cookiesStore = await cookies()
  cookiesStore.set(
    'legalAcceptance',
    JSON.stringify({
      termsVersion: process.env.CURRENT_TERMS_VERSION!,
      privacyVersion: process.env.CURRENT_PRIVACY_VERSION!,
      acceptedAt: (new Date()).toISOString
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365
    }
  )
}