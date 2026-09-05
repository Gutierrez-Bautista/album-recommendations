import { getCurrentSession } from "@/lib/auth-guards"
import TermsModal from './_components/guests-terms-modal'
import { cookies } from "next/headers"

export default async function PublicLayout ({ children }: LayoutProps<'/'>) {
  const session = await getCurrentSession()

  const legalAcceptanceCookie = (await cookies()).get('legalAcceptance')?.value
  const showModal = !legalAcceptanceCookie || JSON.parse(legalAcceptanceCookie)?.termsVersion !== process.env.CURRENT_TERMS_VERSION || JSON.parse(legalAcceptanceCookie)?.privacyVersion !== process.env.CURRENT_PRIVACY_VERSION

  return (
    <>
      { session === null && showModal &&
          <TermsModal />
      }
      {children}
    </>
  )
}