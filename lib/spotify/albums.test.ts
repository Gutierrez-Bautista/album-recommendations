import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SPOTIFY_ALBUM_ID,
  spotifyAlbumFixture,
} from '../../tests/fixtures/spotify-album'
import {
  InvalidSpotifyAlbumInputError,
  SpotifyNotFoundError,
  SpotifyRateLimitError,
  SpotifyServiceError,
} from './errors'

const { spotifyFetchMock } = vi.hoisted(() => ({
  spotifyFetchMock: vi.fn<
    (endpoint: string, init?: RequestInit) => Promise<Response>
  >(),
}))

vi.mock('./client', () => ({
  spotifyFetch: spotifyFetchMock,
}))

import { getSpotifyAlbum } from './albums'

describe('getSpotifyAlbum', () => {
  beforeEach(() => {
    spotifyFetchMock.mockReset()
  })

  it.each([
    SPOTIFY_ALBUM_ID,
    `https://open.spotify.com/album/${SPOTIFY_ALBUM_ID}?si=share-code`,
  ])('fetches and normalizes an album from %s', async (input) => {
    spotifyFetchMock.mockResolvedValue(
      Response.json(spotifyAlbumFixture),
    )

    await expect(getSpotifyAlbum(input)).resolves.toMatchObject({
      spotifyId: SPOTIFY_ALBUM_ID,
      name: 'Example Album',
      coverImageUrl: 'https://i.scdn.co/image/large-cover',
    })

    expect(spotifyFetchMock).toHaveBeenCalledOnce()
    expect(spotifyFetchMock).toHaveBeenCalledWith(
      `/albums/${SPOTIFY_ALBUM_ID}?market=AR`,
    )
  })

  it('rejects invalid input before calling Spotify', async () => {
    await expect(getSpotifyAlbum('invalid')).rejects.toBeInstanceOf(
      InvalidSpotifyAlbumInputError,
    )

    expect(spotifyFetchMock).not.toHaveBeenCalled()
  })

  it('throws SpotifyNotFoundError for a missing album', async () => {
    spotifyFetchMock.mockResolvedValue(
      new Response(null, { status: 404 }),
    )

    const request = getSpotifyAlbum(SPOTIFY_ALBUM_ID)

    await expect(request).rejects.toBeInstanceOf(SpotifyNotFoundError)
    await expect(request).rejects.toMatchObject({
      name: 'SpotifyNotFoundError',
      status: 404,
    })
  })

  it.each([
    { retryAfter: '42', expected: 42 },
    { retryAfter: 'invalid', expected: undefined },
    { retryAfter: undefined, expected: undefined },
  ])(
    'throws SpotifyRateLimitError with Retry-After $retryAfter',
    async ({ retryAfter, expected }) => {
      const headers = retryAfter
        ? { 'Retry-After': retryAfter }
        : undefined

      spotifyFetchMock.mockResolvedValue(
        new Response(null, { status: 429, headers }),
      )

      const request = getSpotifyAlbum(SPOTIFY_ALBUM_ID)

      await expect(request).rejects.toBeInstanceOf(SpotifyRateLimitError)
      await expect(request).rejects.toMatchObject({
        status: 429,
        retryAfterSeconds: expected,
      })
    },
  )

  it.each([403, 500, 503])(
    'throws SpotifyServiceError for status %s',
    async (status) => {
      spotifyFetchMock.mockResolvedValue(new Response(null, { status }))

      const request = getSpotifyAlbum(SPOTIFY_ALBUM_ID)

      await expect(request).rejects.toBeInstanceOf(SpotifyServiceError)
      await expect(request).rejects.toMatchObject({ status })
    },
  )
})
