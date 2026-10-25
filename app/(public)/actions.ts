'use server'
import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/lib/legal";

export async function setGuestLegalAcceptanceCookie() {
  if (!CURRENT_TERMS_VERSION?.trim() || !CURRENT_PRIVACY_VERSION?.trim()) {
    throw new Error('Legal acceptance is temporarily unavailable. Please try again later.')
  }

  const cookiesStore = await cookies()
  cookiesStore.set(
    'legalAcceptance',
    JSON.stringify({
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      acceptedAt: new Date().toISOString()
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365
    }
  )
  refresh()
}
