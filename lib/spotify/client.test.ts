import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_URL = 'https://api.spotify.com/v1'

const fetchMock = vi.fn<typeof fetch>()

function tokenResponse(
  accessToken: string,
  expiresIn = 3600,
): Response {
  return Response.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
  })
}

function apiResponse(status = 200): Response {
  return new Response(null, { status })
}

function countTokenRequests(): number {
  return fetchMock.mock.calls.filter(
    ([input]) => String(input) === SPOTIFY_TOKEN_URL,
  ).length
}

describe('spotifyFetch', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'client-id')
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'client-secret')
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('requests a token and sends it as a Bearer token', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('access-token'))
      .mockResolvedValueOnce(apiResponse())

    const { spotifyFetch } = await import('./client')

    await spotifyFetch('/albums/example?market=AR', {
      headers: {
        Accept: 'application/json',
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)

    const tokenInit = fetchMock.mock.calls[0]?.[1]
    const tokenHeaders = new Headers(tokenInit?.headers)

    expect(fetchMock.mock.calls[0]?.[0]).toBe(SPOTIFY_TOKEN_URL)
    expect(tokenInit?.method).toBe('POST')
    expect(tokenHeaders.get('Authorization')).toBe(
      `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
    )
    expect(tokenHeaders.get('Content-Type')).toBe(
      'application/x-www-form-urlencoded',
    )
    expect(tokenInit?.body?.toString()).toBe(
      'grant_type=client_credentials',
    )

    const apiInit = fetchMock.mock.calls[1]?.[1]
    const apiHeaders = new Headers(apiInit?.headers)

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `${SPOTIFY_API_URL}/albums/example?market=AR`,
    )
    expect(apiHeaders.get('Authorization')).toBe('Bearer access-token')
    expect(apiHeaders.get('Accept')).toBe('application/json')
  })

  it('reuses a valid cached token', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('cached-token'))
      .mockResolvedValueOnce(apiResponse())
      .mockResolvedValueOnce(apiResponse())

    const { spotifyFetch } = await import('./client')

    await spotifyFetch('/albums/first')
    await spotifyFetch('/albums/second')

    expect(countTokenRequests()).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('renews a token inside the expiration margin', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-05T12:00:00Z'))

    fetchMock
      .mockResolvedValueOnce(tokenResponse('first-token', 120))
      .mockResolvedValueOnce(apiResponse())
      .mockResolvedValueOnce(tokenResponse('second-token', 120))
      .mockResolvedValueOnce(apiResponse())

    const { spotifyFetch } = await import('./client')

    await spotifyFetch('/albums/first')

    vi.advanceTimersByTime(61_000)

    await spotifyFetch('/albums/second')

    expect(countTokenRequests()).toBe(2)

    const secondApiHeaders = new Headers(
      fetchMock.mock.calls[3]?.[1]?.headers,
    )

    expect(secondApiHeaders.get('Authorization')).toBe(
      'Bearer second-token',
    )
  })

  it('shares one pending token request between concurrent calls', async () => {
    let resolveTokenRequest!: (response: Response) => void

    const pendingTokenResponse = new Promise<Response>((resolve) => {
      resolveTokenRequest = resolve
    })

    fetchMock.mockImplementation((input) => {
      if (String(input) === SPOTIFY_TOKEN_URL) {
        return pendingTokenResponse
      }

      return Promise.resolve(apiResponse())
    })

    const { spotifyFetch } = await import('./client')

    const firstRequest = spotifyFetch('/albums/first')
    const secondRequest = spotifyFetch('/albums/second')

    expect(countTokenRequests()).toBe(1)

    resolveTokenRequest(tokenResponse('shared-token'))

    await Promise.all([firstRequest, secondRequest])

    expect(countTokenRequests()).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('refreshes the token and retries once after a 401', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('expired-token'))
      .mockResolvedValueOnce(apiResponse(401))
      .mockResolvedValueOnce(tokenResponse('renewed-token'))
      .mockResolvedValueOnce(apiResponse())

    const { spotifyFetch } = await import('./client')

    await expect(spotifyFetch('/albums/example')).resolves.toHaveProperty(
      'status',
      200,
    )

    const retryHeaders = new Headers(
      fetchMock.mock.calls[3]?.[1]?.headers,
    )

    expect(countTokenRequests()).toBe(2)
    expect(retryHeaders.get('Authorization')).toBe(
      'Bearer renewed-token',
    )
  })

  it('throws after Spotify responds with a second 401', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('first-token'))
      .mockResolvedValueOnce(apiResponse(401))
      .mockResolvedValueOnce(tokenResponse('second-token'))
      .mockResolvedValueOnce(apiResponse(401))

    const { spotifyFetch } = await import('./client')
    const { SpotifyUnauthorizedError } = await import('./errors')

    await expect(spotifyFetch('/albums/example')).rejects.toBeInstanceOf(
      SpotifyUnauthorizedError,
    )

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('fails before fetching when Spotify credentials are missing', async () => {
    vi.stubEnv('SPOTIFY_CLIENT_ID', '')
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', '')

    const { spotifyFetch } = await import('./client')

    await expect(spotifyFetch('/albums/example')).rejects.toThrow(
      'Missing Spotify credentials',
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a token endpoint failure', async () => {
    fetchMock.mockResolvedValueOnce(apiResponse(500))

    const { spotifyFetch } = await import('./client')

    await expect(spotifyFetch('/albums/example')).rejects.toThrow(
      'Spotify authentication failed with status 500',
    )

    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
