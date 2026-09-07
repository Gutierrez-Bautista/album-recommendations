import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SPOTIFY_ALBUM_ID,
  createSpotifyTrackFixture,
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
      releaseYear: 2026,
      durationMs: 420_000,
      hasSpotifyMarkedExplicitTracks: true,
      coverImageUrl: 'https://i.scdn.co/image/large-cover',
    })

    expect(spotifyFetchMock).toHaveBeenCalledOnce()
    expect(spotifyFetchMock).toHaveBeenCalledWith(
      `/albums/${SPOTIFY_ALBUM_ID}?market=AR`,
    )
  })

  it('fetches every track page before normalizing the album', async () => {
    const firstPageTracks = [
      createSpotifyTrackFixture({
        id: 'track-one',
        name: 'Track One',
        durationMs: 180_000,
        trackNumber: 1,
      }),
      createSpotifyTrackFixture({
        id: 'track-two',
        name: 'Track Two',
        durationMs: 240_000,
        trackNumber: 2,
      }),
    ]

    const lastPageTrack = createSpotifyTrackFixture({
      id: 'track-three',
      name: 'Track Three',
      durationMs: 300_000,
      explicit: true,
      trackNumber: 3,
    })

    const paginatedAlbum: SpotifyApi.SingleAlbumResponse = {
      ...spotifyAlbumFixture,
      total_tracks: 3,
      tracks: {
        ...spotifyAlbumFixture.tracks,
        items: firstPageTracks,
        limit: 2,
        next:
          `https://api.spotify.com/v1/albums/${SPOTIFY_ALBUM_ID}`
          + '/tracks?market=AR&limit=2&offset=2',
        total: 3,
      },
    }

    const lastPage: SpotifyApi.AlbumTracksResponse = {
      href:
        `https://api.spotify.com/v1/albums/${SPOTIFY_ALBUM_ID}`
        + '/tracks?market=AR&limit=2&offset=2',
      items: [lastPageTrack],
      limit: 2,
      next: null,
      offset: 2,
      previous:
        `https://api.spotify.com/v1/albums/${SPOTIFY_ALBUM_ID}`
        + '/tracks?market=AR&limit=2&offset=0',
      total: 3,
    }

    spotifyFetchMock
      .mockResolvedValueOnce(Response.json(paginatedAlbum))
      .mockResolvedValueOnce(Response.json(lastPage))

    await expect(
      getSpotifyAlbum(SPOTIFY_ALBUM_ID),
    ).resolves.toMatchObject({
      totalTracks: 3,
      durationMs: 720_000,
      hasSpotifyMarkedExplicitTracks: true,
    })

    expect(spotifyFetchMock).toHaveBeenCalledTimes(2)
    expect(spotifyFetchMock).toHaveBeenNthCalledWith(
      1,
      `/albums/${SPOTIFY_ALBUM_ID}?market=AR`,
    )
    expect(spotifyFetchMock).toHaveBeenNthCalledWith(
      2,
      `/albums/${SPOTIFY_ALBUM_ID}/tracks`
      + '?market=AR&limit=2&offset=2',
    )
  })

  it('rejects when a later track page fails', async () => {
    const paginatedAlbum: SpotifyApi.SingleAlbumResponse = {
      ...spotifyAlbumFixture,
      total_tracks: 3,
      tracks: {
        ...spotifyAlbumFixture.tracks,
        limit: 2,
        next:
          `https://api.spotify.com/v1/albums/${SPOTIFY_ALBUM_ID}`
          + '/tracks?market=AR&limit=2&offset=2',
        total: 3,
      },
    }

    spotifyFetchMock
      .mockResolvedValueOnce(Response.json(paginatedAlbum))
      .mockResolvedValueOnce(
        new Response(null, { status: 503 }),
      )

    const request = getSpotifyAlbum(SPOTIFY_ALBUM_ID)

    await expect(request).rejects.toBeInstanceOf(
      SpotifyServiceError,
    )
    await expect(request).rejects.toMatchObject({
      status: 503,
    })

    expect(spotifyFetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid input before calling Spotify', async () => {
    await expect(
      getSpotifyAlbum('invalid'),
    ).rejects.toBeInstanceOf(
      InvalidSpotifyAlbumInputError,
    )

    expect(spotifyFetchMock).not.toHaveBeenCalled()
  })

  it('rejects an album ID rejected by Spotify', async () => {
    spotifyFetchMock.mockResolvedValue(
      Response.json(
        {
          error: {
            status: 400,
            message: 'Invalid base62 id',
          },
        },
        {
          status: 400,
        },
      ),
    )

    const request = getSpotifyAlbum(SPOTIFY_ALBUM_ID)

    await expect(request).rejects.toBeInstanceOf(
      InvalidSpotifyAlbumInputError,
    )

    expect(spotifyFetchMock).toHaveBeenCalledOnce()
  })

  it('throws SpotifyNotFoundError for a missing album', async () => {
    spotifyFetchMock.mockResolvedValue(
      new Response(null, { status: 404 }),
    )

    const request = getSpotifyAlbum(SPOTIFY_ALBUM_ID)

    await expect(request).rejects.toBeInstanceOf(
      SpotifyNotFoundError,
    )
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
        new Response(null, {
          status: 429,
          headers,
        }),
      )

      const request = getSpotifyAlbum(SPOTIFY_ALBUM_ID)

      await expect(request).rejects.toBeInstanceOf(
        SpotifyRateLimitError,
      )
      await expect(request).rejects.toMatchObject({
        status: 429,
        retryAfterSeconds: expected,
      })
    },
  )

  it.each([403, 500, 503])(
    'throws SpotifyServiceError for status %s',
    async (status) => {
      spotifyFetchMock.mockResolvedValue(
        new Response(null, { status }),
      )

      const request = getSpotifyAlbum(SPOTIFY_ALBUM_ID)

      await expect(request).rejects.toBeInstanceOf(
        SpotifyServiceError,
      )
      await expect(request).rejects.toMatchObject({
        status,
      })
    },
  )
})