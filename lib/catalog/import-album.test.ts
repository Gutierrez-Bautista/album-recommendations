import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  albumArtists,
  albums,
  artists,
} from '@/src/db/schema/catalog'
import type { SpotifyAlbumMetadata } from '../spotify/types'

const {
  getSpotifyAlbumMock,
  transactionMock,
  insertMock,
  deleteMock,
  albumValuesMock,
  albumConflictMock,
  albumReturningMock,
  artistValuesMock,
  artistConflictMock,
  artistReturningMock,
  relationValuesMock,
  deleteWhereMock,
} = vi.hoisted(() => ({
  getSpotifyAlbumMock: vi.fn(),
  transactionMock: vi.fn(),
  insertMock: vi.fn(),
  deleteMock: vi.fn(),
  albumValuesMock: vi.fn(),
  albumConflictMock: vi.fn(),
  albumReturningMock: vi.fn(),
  artistValuesMock: vi.fn(),
  artistConflictMock: vi.fn(),
  artistReturningMock: vi.fn(),
  relationValuesMock: vi.fn(),
  deleteWhereMock: vi.fn(),
}))

vi.mock('../spotify/albums', () => ({
  getSpotifyAlbum: getSpotifyAlbumMock,
}))

vi.mock('@/src/db', () => ({
  default: {
    transaction: transactionMock,
  },
}))

import { importSpotifyAlbum } from './import-album'

const SPOTIFY_ALBUM_ID = 'spotify-album-id'
const FETCHED_AT = new Date('2026-09-06T01:00:00.000Z')

const albumMetadata: SpotifyAlbumMetadata = {
  spotifyId: SPOTIFY_ALBUM_ID,
  name: 'Example Album',
  spotifyAlbumType: 'album',
  releaseDateRaw: '2026-09-05',
  releaseDatePrecision: 'day',
  releaseYear: 2026,
  totalTracks: 10,
  durationMs: 2_400_000,
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

const persistedAlbum = {
  id: 'album-database-id',
  spotifyId: SPOTIFY_ALBUM_ID,
}

const persistedArtistOne = {
  id: 'artist-one-database-id',
  spotifyId: 'artist-one',
}

const persistedArtistTwo = {
  id: 'artist-two-database-id',
  spotifyId: 'artist-two',
}

describe('importSpotifyAlbum', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(FETCHED_AT)

    getSpotifyAlbumMock.mockResolvedValue(albumMetadata)

    albumReturningMock.mockResolvedValue([persistedAlbum])
    albumConflictMock.mockReturnValue({
      returning: albumReturningMock,
    })
    albumValuesMock.mockReturnValue({
      onConflictDoUpdate: albumConflictMock,
    })

    artistReturningMock
      .mockResolvedValueOnce([persistedArtistOne])
      .mockResolvedValueOnce([persistedArtistTwo])

    artistConflictMock.mockReturnValue({
      returning: artistReturningMock,
    })
    artistValuesMock.mockReturnValue({
      onConflictDoUpdate: artistConflictMock,
    })

    relationValuesMock.mockResolvedValue(undefined)
    deleteWhereMock.mockResolvedValue(undefined)

    insertMock.mockImplementation((table: unknown) => {
      if (table === albums) {
        return {
          values: albumValuesMock,
        }
      }

      if (table === artists) {
        return {
          values: artistValuesMock,
        }
      }

      if (table === albumArtists) {
        return {
          values: relationValuesMock,
        }
      }

      throw new Error('Unexpected insert table')
    })

    deleteMock.mockImplementation((table: unknown) => {
      if (table === albumArtists) {
        return {
          where: deleteWhereMock,
        }
      }

      throw new Error('Unexpected delete table')
    })

    const tx = {
      insert: insertMock,
      delete: deleteMock,
    }

    transactionMock.mockImplementation(
      async (
        callback: (transaction: unknown) => Promise<unknown>,
      ) => callback(tx),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('persists the album, artists and ordered relations', async () => {
    await expect(
      importSpotifyAlbum({
        spotifyInput: SPOTIFY_ALBUM_ID,
        releaseKind: 'ep',
      }),
    ).resolves.toEqual(persistedAlbum)

    expect(getSpotifyAlbumMock).toHaveBeenCalledOnce()
    expect(getSpotifyAlbumMock).toHaveBeenCalledWith(
      SPOTIFY_ALBUM_ID,
    )

    expect(transactionMock).toHaveBeenCalledOnce()

    const expectedAlbumUpdate = {
      name: 'Example Album',
      spotifyAlbumType: 'album',
      releaseKind: 'ep',
      releaseDateRaw: '2026-09-05',
      releaseDatePrecision: 'day',
      releaseYear: 2026,
      totalTracks: 10,
      durationMs: 2_400_000,
      hasSpotifyMarkedExplicitTracks: true,
      coverUrl: 'https://i.scdn.co/image/example-cover',
      spotifyMetadataFetchedAt: FETCHED_AT,
      updatedAt: FETCHED_AT,
    }

    expect(albumValuesMock).toHaveBeenCalledWith({
      spotifyId: SPOTIFY_ALBUM_ID,
      ...expectedAlbumUpdate,
    })

    expect(albumConflictMock).toHaveBeenCalledWith({
      target: albums.spotifyId,
      set: expectedAlbumUpdate,
    })

    expect(artistValuesMock).toHaveBeenNthCalledWith(1, {
      spotifyId: 'artist-one',
      name: 'Artist One',
      spotifyMetadataFetchedAt: FETCHED_AT,
      updatedAt: FETCHED_AT,
    })

    expect(artistValuesMock).toHaveBeenNthCalledWith(2, {
      spotifyId: 'artist-two',
      name: 'Artist Two',
      spotifyMetadataFetchedAt: FETCHED_AT,
      updatedAt: FETCHED_AT,
    })

    expect(artistConflictMock).toHaveBeenNthCalledWith(1, {
      target: artists.spotifyId,
      set: {
        name: 'Artist One',
        spotifyMetadataFetchedAt: FETCHED_AT,
        updatedAt: FETCHED_AT,
      },
    })

    expect(artistConflictMock).toHaveBeenNthCalledWith(2, {
      target: artists.spotifyId,
      set: {
        name: 'Artist Two',
        spotifyMetadataFetchedAt: FETCHED_AT,
        updatedAt: FETCHED_AT,
      },
    })

    expect(deleteMock).toHaveBeenCalledWith(albumArtists)
    expect(deleteWhereMock).toHaveBeenCalledOnce()

    expect(relationValuesMock).toHaveBeenCalledWith([
      {
        albumId: 'album-database-id',
        artistId: 'artist-one-database-id',
        position: 0,
      },
      {
        albumId: 'album-database-id',
        artistId: 'artist-two-database-id',
        position: 1,
      },
    ])
  })

  it('rejects albums without artists before opening a transaction', async () => {
    getSpotifyAlbumMock.mockResolvedValue({
      ...albumMetadata,
      artists: [],
    })

    await expect(
      importSpotifyAlbum({
        spotifyInput: SPOTIFY_ALBUM_ID,
        releaseKind: 'album',
      }),
    ).rejects.toThrow(
      `Spotify album has no artists: ${SPOTIFY_ALBUM_ID}`,
    )

    expect(transactionMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('does not open a transaction when the Spotify lookup fails', async () => {
    const spotifyError = new Error('Spotify unavailable')

    getSpotifyAlbumMock.mockRejectedValue(spotifyError)

    await expect(
      importSpotifyAlbum({
        spotifyInput: SPOTIFY_ALBUM_ID,
        releaseKind: 'album',
      }),
    ).rejects.toBe(spotifyError)

    expect(transactionMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
    expect(deleteMock).not.toHaveBeenCalled()
  })
})