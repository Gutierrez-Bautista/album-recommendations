import { getCurrentSession, hasCurrentLegalAcceptance } from "@/lib/auth-guards"
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/lib/legal"
import TermsModal from './_components/guests-terms-modal'
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

function hasGuestLegalAcceptance(cookieValue: string | undefined): boolean {
  if (!cookieValue ||
    typeof CURRENT_TERMS_VERSION !== 'string' || !CURRENT_TERMS_VERSION.trim() ||
    typeof CURRENT_PRIVACY_VERSION !== 'string' || !CURRENT_PRIVACY_VERSION.trim()) {
    return false
  }

  try {
    const acceptance: unknown = JSON.parse(cookieValue)
    return typeof acceptance === 'object' && acceptance !== null && !Array.isArray(acceptance) &&
      'termsVersion' in acceptance && typeof acceptance.termsVersion === 'string' &&
      'privacyVersion' in acceptance && typeof acceptance.privacyVersion === 'string' &&
      acceptance.termsVersion === CURRENT_TERMS_VERSION &&
      acceptance.privacyVersion === CURRENT_PRIVACY_VERSION
  } catch {
    return false
  }
}

export default async function PublicLayout ({ children }: LayoutProps<'/'>) {
  const session = await getCurrentSession()

  if (session) {
    if (!await hasCurrentLegalAcceptance(session.user.id)) {
      redirect('/legal')
    }
    return children
  }

  const legalAcceptanceCookie = (await cookies()).get('legalAcceptance')?.value
  return hasGuestLegalAcceptance(legalAcceptanceCookie) ? children : <TermsModal />
}
