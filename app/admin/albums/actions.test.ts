import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { SpotifyAlbumHasNoArtistsError } from '@/lib/catalog/errors'
import {
  InvalidSpotifyAlbumInputError,
  SpotifyNotFoundError,
  SpotifyRateLimitError,
  SpotifyServiceError,
} from '@/lib/spotify/errors'
import type { SpotifyAlbumMetadata } from '@/lib/spotify/types'

const {
  requireAdminMock,
  getSpotifyAlbumMock,
  importSpotifyAlbumMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  getSpotifyAlbumMock: vi.fn(),
  importSpotifyAlbumMock: vi.fn(),
}))

vi.mock('@/lib/auth-guards', () => ({
  requireAdmin: requireAdminMock,
}))

vi.mock('@/lib/spotify/albums', () => ({
  getSpotifyAlbum: getSpotifyAlbumMock,
}))

vi.mock('@/lib/catalog/import-album', () => ({
  importSpotifyAlbum: importSpotifyAlbumMock,
}))

import {
  importAlbumAction,
  previewAlbumAction,
  type AlbumImportState,
  type AlbumPreviewState,
} from './actions'

const SPOTIFY_ALBUM_ID = '1xhO0GSoezdPJcSuNe1ySv'

const albumMetadata: SpotifyAlbumMetadata = {
  spotifyId: SPOTIFY_ALBUM_ID,
  name: 'Example Album',
  spotifyAlbumType: 'album',
  releaseDateRaw: '2026-09-05',
  releaseDatePrecision: 'day',
  releaseYear: 2026,
  totalTracks: 2,
  durationMs: 420_000,
  hasSpotifyMarkedExplicitTracks: true,
  spotifyUrl:
    `https://open.spotify.com/album/${SPOTIFY_ALBUM_ID}`,
  coverImageUrl: 'https://i.scdn.co/image/example-cover',
  artists: [
    {
      spotifyId: 'artist-one',
      name: 'Artist One',
      spotifyUrl:
        'https://open.spotify.com/artist/artist-one',
    },
    {
      spotifyId: 'artist-two',
      name: 'Artist Two',
      spotifyUrl:
        'https://open.spotify.com/artist/artist-two',
    },
  ],
}

const initialPreviewState: AlbumPreviewState = {
  status: 'idle',
}

const initialImportState: AlbumImportState = {
  status: 'idle',
}

function createFormData({
  spotifyInput = SPOTIFY_ALBUM_ID,
  releaseKind,
}: {
  spotifyInput?: string
  releaseKind?: string
} = {}): FormData {
  const formData = new FormData()

  formData.set('spotifyInput', spotifyInput)

  if (releaseKind !== undefined) {
    formData.set('releaseKind', releaseKind)
  }

  return formData
}

beforeEach(() => {
  vi.resetAllMocks()

  requireAdminMock.mockResolvedValue({
    user: {
      id: 'admin-id',
      role: 'admin',
    },
  })
})

describe('previewAlbumAction', () => {
  it('returns validation errors before calling Spotify', async () => {
    const result = await previewAlbumAction(
      initialPreviewState,
      createFormData({
        spotifyInput: '',
      }),
    )

    expect(requireAdminMock).toHaveBeenCalledOnce()

    expect(result).toMatchObject({
      status: 'validation-error',
      fieldErrors: {
        spotifyInput: expect.any(Array),
      },
    })

    expect(getSpotifyAlbumMock).not.toHaveBeenCalled()
  })

  it('returns a safe album preview', async () => {
    getSpotifyAlbumMock.mockResolvedValue(albumMetadata)

    const result = await previewAlbumAction(
      initialPreviewState,
      createFormData(),
    )

    expect(requireAdminMock).toHaveBeenCalledOnce()
    expect(getSpotifyAlbumMock).toHaveBeenCalledWith(
      SPOTIFY_ALBUM_ID,
    )

    expect(result).toEqual({
      status: 'success',
      preview: {
        spotifyId: SPOTIFY_ALBUM_ID,
        name: 'Example Album',
        spotifyAlbumType: 'album',
        releaseDateRaw: '2026-09-05',
        releaseYear: 2026,
        totalTracks: 2,
        durationMs: 420_000,
        hasSpotifyMarkedExplicitTracks: true,
        coverImageUrl:
          'https://i.scdn.co/image/example-cover',
        spotifyUrl:
          `https://open.spotify.com/album/${SPOTIFY_ALBUM_ID}`,
        artists: [
          {
            spotifyId: 'artist-one',
            name: 'Artist One',
          },
          {
            spotifyId: 'artist-two',
            name: 'Artist Two',
          },
        ],
      },
    })
  })

  it.each([
    {
      name: 'an invalid Spotify ID',
      error: new InvalidSpotifyAlbumInputError(
        SPOTIFY_ALBUM_ID,
      ),
      expectedMessage:
        'Enter a valid Spotify album URL or ID',
    },
    {
      name: 'a missing Spotify album',
      error: new SpotifyNotFoundError(
        'album',
        SPOTIFY_ALBUM_ID,
      ),
      expectedMessage:
        'No Spotify album was found for this URL or ID.',
    },
  ])(
    'maps $name to a field error',
    async ({ error, expectedMessage }) => {
      getSpotifyAlbumMock.mockRejectedValue(error)

      const result = await previewAlbumAction(
        initialPreviewState,
        createFormData(),
      )

      expect(result).toEqual({
        status: 'validation-error',
        fieldErrors: {
          spotifyInput: [expectedMessage],
        },
      })
    },
  )

  it.each([
    {
      retryAfterSeconds: 30,
      expectedMessage:
        'Spotify is temporarily limiting requests. Try again in 30 seconds.',
    },
    {
      retryAfterSeconds: undefined,
      expectedMessage:
        'Spotify is temporarily limiting requests. Try again later.',
    },
  ])(
    'maps rate limiting with retryAfterSeconds=$retryAfterSeconds',
    async ({ retryAfterSeconds, expectedMessage }) => {
      getSpotifyAlbumMock.mockRejectedValue(
        new SpotifyRateLimitError(retryAfterSeconds),
      )

      const result = await previewAlbumAction(
        initialPreviewState,
        createFormData(),
      )

      expect(result).toEqual({
        status: 'error',
        message: expectedMessage,
      })
    },
  )

  it('maps Spotify service failures to a safe message', async () => {
    getSpotifyAlbumMock.mockRejectedValue(
      new SpotifyServiceError(503),
    )

    const result = await previewAlbumAction(
      initialPreviewState,
      createFormData(),
    )

    expect(result).toEqual({
      status: 'error',
      message:
        'Spotify is temporarily unavailable. Try again later.',
    })
  })
})

describe('importAlbumAction', () => {
  it('returns validation errors before importing', async () => {
    const result = await importAlbumAction(
      initialImportState,
      createFormData({
        releaseKind: 'mixtape',
      }),
    )

    expect(requireAdminMock).toHaveBeenCalledOnce()

    expect(result).toMatchObject({
      status: 'validation-error',
      fieldErrors: {
        releaseKind: expect.any(Array),
      },
    })

    expect(importSpotifyAlbumMock).not.toHaveBeenCalled()
  })

  it('imports validated album data', async () => {
    importSpotifyAlbumMock.mockResolvedValue({
      id: 'album-database-id',
      spotifyId: SPOTIFY_ALBUM_ID,
    })

    const result = await importAlbumAction(
      initialImportState,
      createFormData({
        releaseKind: 'ep',
      }),
    )

    expect(requireAdminMock).toHaveBeenCalledOnce()

    expect(importSpotifyAlbumMock).toHaveBeenCalledOnce()
    expect(importSpotifyAlbumMock).toHaveBeenCalledWith({
      spotifyInput: SPOTIFY_ALBUM_ID,
      releaseKind: 'ep',
    })

    expect(result).toEqual({
      status: 'success',
      albumId: 'album-database-id',
      message: 'Album imported successfully',
    })
  })

  it('maps incomplete album metadata to a safe message', async () => {
    importSpotifyAlbumMock.mockRejectedValue(
      new SpotifyAlbumHasNoArtistsError(SPOTIFY_ALBUM_ID),
    )

    const result = await importAlbumAction(
      initialImportState,
      createFormData({
        releaseKind: 'album',
      }),
    )

    expect(result).toEqual({
      status: 'error',
      message:
        'Spotify returned incomplete album metadata. Try again later.',
    })
  })

  it('maps Spotify input errors during import', async () => {
    importSpotifyAlbumMock.mockRejectedValue(
      new InvalidSpotifyAlbumInputError(
        SPOTIFY_ALBUM_ID,
      ),
    )

    const result = await importAlbumAction(
      initialImportState,
      createFormData({
        releaseKind: 'album',
      }),
    )

    expect(result).toEqual({
      status: 'validation-error',
      fieldErrors: {
        spotifyInput: [
          'Enter a valid Spotify album URL or ID',
        ],
      },
    })
  })

  it('logs unexpected errors and returns a generic message', async () => {
    const unexpectedError = new Error(
      'Database connection failed',
    )

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    importSpotifyAlbumMock.mockRejectedValue(
      unexpectedError,
    )

    const result = await importAlbumAction(
      initialImportState,
      createFormData({
        releaseKind: 'album',
      }),
    )

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unexpected album action error',
      unexpectedError,
    )

    expect(result).toEqual({
      status: 'error',
      message:
        'An unexpected error occurred. Try again later.',
    })
  })
})