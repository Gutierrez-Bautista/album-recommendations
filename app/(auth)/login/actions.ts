'use server'

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export const startSpotifyLogin = async () => {
  const result = await auth.api.signInSocial({
    headers: await headers(),
    body: {
      provider: 'spotify',
      callbackURL: '/auth/complete',
      errorCallbackURL: '/login',
    },
  })

  if (!result.url) {
    throw new Error('Could not start Spotify login. Please try again later.')
  }

  redirect(result.url)
}