import 'server-only'
import { SpotifyUnauthorizedError } from './errors'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const EXPIRATION_MARGIN_MS = 60_000

type SpotifyTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

type CachedToken = {
  accessToken: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null
let pendingTokenRequest: Promise<CachedToken> | null = null

async function requestSpotifyAccessToken(): Promise<CachedToken> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials')
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`,
  ).toString('base64')

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `Spotify authentication failed with status ${response.status}`,
    )
  }

  const data = (await response.json()) as SpotifyTokenResponse

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

async function getSpotifyAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - EXPIRATION_MARGIN_MS) {
    return cachedToken.accessToken
  }

  pendingTokenRequest ??= requestSpotifyAccessToken()
    .then((token) => {
      cachedToken = token
      return token
    })
    .finally(() => {
      pendingTokenRequest = null
    })

  const token = await pendingTokenRequest

  return token.accessToken
}

function invalidateSpotifyAccessToken(): void {
  cachedToken = null
}

const SPOTIFY_API_URL = 'https://api.spotify.com/v1'

async function requestSpotifyApi(
  endpoint: string,
  accessToken: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers)

  headers.set('Authorization', `Bearer ${accessToken}`)

  return fetch(`${SPOTIFY_API_URL}${endpoint}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
}

export async function spotifyFetch(
  endpoint: string,
  init?: RequestInit,
): Promise<Response> {
  const accessToken = await getSpotifyAccessToken()
  let response = await requestSpotifyApi(endpoint, accessToken, init)

  if (response.status === 401) {
    invalidateSpotifyAccessToken()

    const renewedAccessToken = await getSpotifyAccessToken()
    response = await requestSpotifyApi(endpoint, renewedAccessToken, init)
  }

  if (response.status === 401) {
    throw new SpotifyUnauthorizedError()
  }

  return response
}