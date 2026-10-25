import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import { AlbumNotFoundError, CatalogAlbumHasNoArtistsError } from '@/lib/catalog/errors'
import { albums, albumArtists, artists } from '@/src/db/schema/catalog'
import { dailyPicks } from '@/src/db/schema/recommendations'
import { albumTags, tagCategories, tags } from '@/src/db/schema/tags'
import { InvalidPickDateError } from './errors'

const { selectMock, fetchMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  fetchMock: vi.fn(),
}))

// Only read operations are available; the real connection is never imported.
vi.mock('@/src/db', () => ({ default: { select: selectMock } }))

import { getDailyPickByDate, getDailyPickHistory } from './queries'

function query(rows: object[] = []) {
  const result = Promise.resolve(rows)
  return {
    rows,
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    then: result.then.bind(result),
  }
}

function compile(expression: SQL) {
  return new PgDialect().sqlToQuery(expression)
}

function arrangeQueries(...queries: ReturnType<typeof query>[]) {
  let index = 0
  selectMock.mockImplementation(() => {
    const next = queries[index++]
    if (!next) {
      throw new Error('Unexpected read query')
    }
    return next
  })
}

const PICK_DATE = '2026-10-20'
const ALBUM_ID = 'album-database-id'
const persistedAlbum = {
  id: ALBUM_ID,
  spotifyId: 'spotify-album-id',
  name: 'Example Album',
  coverUrl: 'https://i.scdn.co/image/example-cover',
  spotifyAlbumType: 'album',
  releaseKind: 'ep',
  releaseDateRaw: '2026-09',
  releaseDatePrecision: 'month',
  releaseYear: 2026,
  totalTracks: 5,
  durationMs: 1_200_000,
  hasSpotifyMarkedExplicitTracks: true,
  spotifyMetadataFetchedAt: new Date('2026-10-01T12:00:00.000Z'),
  createdAt: new Date('2026-10-01T12:00:00.000Z'),
  updatedAt: new Date('2026-10-01T12:00:00.000Z'),
  archivedAt: null,
} satisfies typeof albums.$inferSelect

// Album credits are intentionally not alphabetical.
const persistedArtists = [
  { id: 'primary-artist-id', name: 'Z Primary Artist' },
  { id: 'guest-artist-id', name: 'A Guest Artist' },
]

const persistedTags = [
  {
    id: 'ambient-1', name: 'Ambient', categoryId: 'genre-1',
    category: 'Genre', categoryDescription: 'Musical genre',
  },
  {
    id: 'ambient-2', name: 'Ambient', categoryId: 'genre-1',
    category: 'Genre', categoryDescription: 'Musical genre',
  },
  {
    id: 'rock', name: 'Rock', categoryId: 'genre-1',
    category: 'Genre', categoryDescription: 'Musical genre',
  },
  {
    id: 'jazz', name: 'Jazz', categoryId: 'genre-2',
    category: 'Genre', categoryDescription: 'Another category with the same name',
  },
  {
    id: 'calm', name: 'Calm', categoryId: 'mood',
    category: 'Mood', categoryDescription: null,
  },
]

const expectedCategories = [
  {
    id: 'genre-1', name: 'Genre', description: 'Musical genre',
    tags: [
      { id: 'ambient-1', name: 'Ambient' },
      { id: 'ambient-2', name: 'Ambient' },
      { id: 'rock', name: 'Rock' },
    ],
  },
  {
    id: 'genre-2', name: 'Genre', description: 'Another category with the same name',
    tags: [{ id: 'jazz', name: 'Jazz' }],
  },
  {
    id: 'mood', name: 'Mood', description: null,
    tags: [{ id: 'calm', name: 'Calm' }],
  },
]

const INVALID_DATES = [
  '', '2026-1-01', '2026-01-1', '26-01-01', '10000-01-01',
  '2026/01/01', '2026-10-20T00:00:00Z', ' 2026-10-20', '2026-10-20 ',
  '2026-10-20\n', '2026-00-10', '2026-13-01', '2026-01-00',
  '2026-01-32', '2026-04-31', '2026-02-29', '2024-02-30',
  '1900-02-29', '2100-02-29', '0000-01-01',
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

describe('getDailyPickByDate', () => {
  let pick: ReturnType<typeof query>
  let album: ReturnType<typeof query>
  let albumArtistRows: ReturnType<typeof query>
  let albumTagRows: ReturnType<typeof query>

  beforeEach(() => {
    pick = query([{ pickDate: PICK_DATE, albumId: ALBUM_ID }])
    album = query([{ ...persistedAlbum }])
    albumArtistRows = query([...persistedArtists])
    albumTagRows = query([...persistedTags])
    arrangeQueries(pick, album, albumArtistRows, albumTagRows)
  })

  it('returns only the declared album details from stored catalog data', async () => {
    await expect(getDailyPickByDate(PICK_DATE)).resolves.toEqual({
      pickDate: PICK_DATE,
      album: {
        id: ALBUM_ID,
        spotifyId: persistedAlbum.spotifyId,
        name: persistedAlbum.name,
        coverUrl: persistedAlbum.coverUrl,
        spotifyAlbumType: 'album',
        releaseKind: 'ep',
        releaseDateRaw: '2026-09',
        totalTracks: 5,
        durationMs: 1_200_000,
        hasSpotifyMarkedExplicitTracks: true,
        artists: persistedArtists,
        tagCategories: expectedCategories,
      },
    })

    expect(pick.from).toHaveBeenCalledWith(dailyPicks)
    expect(compile(pick.where.mock.calls[0][0])).toMatchObject({
      sql: '"daily_picks"."pick_date" = $1', params: [PICK_DATE],
    })
    expect(pick.limit).toHaveBeenCalledWith(1)
    expect(album.from).toHaveBeenCalledWith(albums)
    expect(compile(album.where.mock.calls[0][0])).toMatchObject({
      sql: '"albums"."id" = $1', params: [ALBUM_ID],
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null only when no pick exists without reading or generating an album', async () => {
    pick.rows.length = 0

    await expect(getDailyPickByDate(PICK_DATE)).resolves.toBeNull()

    expect(selectMock).toHaveBeenCalledOnce()
    expect(album.from).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserves nullable fields, a year-only release date and a false explicit flag', async () => {
    album.rows[0] = {
      ...persistedAlbum,
      coverUrl: null,
      releaseKind: null,
      durationMs: null,
      releaseDateRaw: '1984',
      releaseDatePrecision: 'year',
      releaseYear: 1984,
      hasSpotifyMarkedExplicitTracks: false,
    }

    await expect(getDailyPickByDate(PICK_DATE)).resolves.toMatchObject({
      album: {
        coverUrl: null, releaseKind: null, durationMs: null,
        releaseDateRaw: '1984', hasSpotifyMarkedExplicitTracks: false,
      },
    })
  })

  it('orders artists by their credited positions rather than their names', async () => {
    const details = await getDailyPickByDate(PICK_DATE)

    expect(details?.album.artists).toEqual(persistedArtists)
    expect(albumArtistRows.from).toHaveBeenCalledWith(artists)
    expect(albumArtistRows.innerJoin).toHaveBeenCalledWith(albumArtists, expect.anything())
    expect(compile(albumArtistRows.where.mock.calls[0][0])).toMatchObject({
      sql: '"album_artists"."album_id" = $1', params: [ALBUM_ID],
    })
    expect(albumArtistRows.orderBy).toHaveBeenCalledWith(albumArtists.position)
  })

  it('groups assigned tags by category ID and preserves deterministic name and ID ordering', async () => {
    const details = await getDailyPickByDate(PICK_DATE)

    expect(details?.album.tagCategories).toEqual(expectedCategories)
    expect(albumTagRows.from).toHaveBeenCalledWith(tags)
    expect(albumTagRows.innerJoin).toHaveBeenNthCalledWith(1, albumTags, expect.anything())
    expect(albumTagRows.innerJoin).toHaveBeenNthCalledWith(2, tagCategories, expect.anything())
    expect(compile(albumTagRows.where.mock.calls[0][0])).toMatchObject({
      sql: '"album_tags"."album_id" = $1', params: [ALBUM_ID],
    })
    expect(albumTagRows.orderBy).toHaveBeenCalledWith(
      tagCategories.name, tagCategories.id, tags.name, tags.id,
    )
  })

  it('returns no categories when the album has no assigned tags', async () => {
    albumTagRows.rows.length = 0

    await expect(getDailyPickByDate(PICK_DATE)).resolves.toMatchObject({
      album: { tagCategories: [] },
    })

    expect(selectMock).toHaveBeenCalledTimes(4)
  })

  it('reads a pick whose album has since been archived', async () => {
    album.rows[0] = { ...persistedAlbum, archivedAt: new Date('2026-10-21T00:00:00.000Z') }

    await expect(getDailyPickByDate(PICK_DATE)).resolves.toMatchObject({
      pickDate: PICK_DATE, album: { id: ALBUM_ID, name: persistedAlbum.name },
    })

    expect(compile(album.where.mock.calls[0][0])).toMatchObject({
      sql: '"albums"."id" = $1', params: [ALBUM_ID],
    })
  })

  it.each(INVALID_DATES)('rejects invalid pick date %j before any database read', async (pickDate) => {
    const request = getDailyPickByDate(pickDate)

    await expect(request).rejects.toBeInstanceOf(InvalidPickDateError)
    await expect(request).rejects.toMatchObject({ pickDate })
    expect(selectMock).not.toHaveBeenCalled()
  })

  it.each(['0001-01-01', '0099-12-31', '2000-02-29', '2024-02-29', '9999-12-31'])(
    'accepts valid date %s without changing its calendar representation',
    async (pickDate) => {
      pick.rows[0] = { pickDate, albumId: ALBUM_ID }

      await expect(getDailyPickByDate(pickDate)).resolves.toMatchObject({ pickDate })

      expect(compile(pick.where.mock.calls[0][0]).params).toEqual([pickDate])
    },
  )

  it('propagates a missing catalog album instead of returning null', async () => {
    album.rows.length = 0
    const request = getDailyPickByDate(PICK_DATE)

    await expect(request).rejects.toBeInstanceOf(AlbumNotFoundError)
    await expect(request).rejects.toMatchObject({ albumId: ALBUM_ID })
    expect(albumArtistRows.from).not.toHaveBeenCalled()
  })

  it('propagates an album without artists instead of returning incomplete details', async () => {
    albumArtistRows.rows.length = 0
    const request = getDailyPickByDate(PICK_DATE)

    await expect(request).rejects.toBeInstanceOf(CatalogAlbumHasNoArtistsError)
    await expect(request).rejects.toMatchObject({ albumId: ALBUM_ID })
    expect(albumTagRows.from).not.toHaveBeenCalled()
  })

  it.each(['pick', 'album', 'artists', 'tags'])(
    'propagates the original database error during the %s read',
    async (stage) => {
      const failure = new Error(`Database read failed: ${stage}`)
      if (stage === 'pick') {
        pick.limit.mockRejectedValueOnce(failure)
      } else if (stage === 'album') {
        album.where.mockRejectedValueOnce(failure)
      } else if (stage === 'artists') {
        albumArtistRows.orderBy.mockRejectedValueOnce(failure)
      } else {
        albumTagRows.orderBy.mockRejectedValueOnce(failure)
      }

      await expect(getDailyPickByDate(PICK_DATE)).rejects.toBe(failure)
    },
  )
})

describe('getDailyPickHistory', () => {
  let history: ReturnType<typeof query>
  const rows = [
    { pickDate: '2026-10-19', albumId: 'archived-album', albumName: 'Archived Album' },
    { pickDate: '2026-10-18', albumId: 'older-album', albumName: 'Older Album' },
    { pickDate: '2026-10-17', albumId: 'oldest-album', albumName: 'Oldest Album' },
  ]

  beforeEach(() => {
    history = query([...rows])
    arrangeQueries(history)
  })

  it('queries strictly earlier picks newest first and includes archived albums', async () => {
    await expect(getDailyPickHistory(2, 0, PICK_DATE)).resolves.toEqual({
      entries: [
        { pickDate: '2026-10-19', albumName: 'Archived Album' },
        { pickDate: '2026-10-18', albumName: 'Older Album' },
      ],
      hasMore: true,
    })

    expect(history.from).toHaveBeenCalledWith(dailyPicks)
    expect(history.leftJoin).toHaveBeenCalledWith(albums, expect.anything())
    expect(compile(history.leftJoin.mock.calls[0][1])).toMatchObject({
      sql: '"daily_picks"."album_id" = "albums"."id"', params: [],
    })
    expect(compile(history.where.mock.calls[0][0])).toMatchObject({
      sql: '"daily_picks"."pick_date" < $1', params: [PICK_DATE],
    })
    expect(compile(history.orderBy.mock.calls[0][0]).sql).toBe('"daily_picks"."pick_date" desc')
    expect(history.limit).toHaveBeenCalledWith(3)
    expect(history.offset).toHaveBeenCalledWith(0)
    expect(selectMock).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    { quantity: 1, offset: 0, pageRows: rows.slice(0, 2), hasMore: true },
    { quantity: 1, offset: 1, pageRows: rows.slice(1, 3), hasMore: true },
    { quantity: 1, offset: 2, pageRows: rows.slice(2), hasMore: false },
    { quantity: 2, offset: 0, pageRows: rows, hasMore: true },
    { quantity: 3, offset: 0, pageRows: rows, hasMore: false },
    { quantity: 4, offset: 0, pageRows: rows, hasMore: false },
    { quantity: 2, offset: 3, pageRows: [], hasMore: false },
    { quantity: 100, offset: 20, pageRows: [], hasMore: false },
  ])('paginates with quantity=$quantity, offset=$offset and hasMore=$hasMore', async ({
    quantity, offset, pageRows, hasMore,
  }) => {
    history.rows.splice(0, history.rows.length, ...pageRows)

    await expect(getDailyPickHistory(quantity, offset, PICK_DATE)).resolves.toEqual({
      entries: pageRows.slice(0, quantity).map(({ pickDate, albumName }) => ({ pickDate, albumName })),
      hasMore,
    })

    expect(history.limit).toHaveBeenCalledWith(quantity + 1)
    expect(history.offset).toHaveBeenCalledWith(offset)
    expect(selectMock).toHaveBeenCalledOnce()
  })

  it('uses the caller cutoff date even when the resulting history is empty', async () => {
    history.rows.length = 0

    await expect(getDailyPickHistory(10, 0, '2026-10-17')).resolves.toEqual({
      entries: [], hasMore: false,
    })

    expect(compile(history.where.mock.calls[0][0])).toMatchObject({
      sql: '"daily_picks"."pick_date" < $1', params: ['2026-10-17'],
    })
  })

  it('accepts a full maximum-size page and detects its extra row', async () => {
    const fullPage = Array.from({ length: 101 }, (_, index) => ({
      pickDate: new Date(Date.UTC(2026, 9, 19 - index)).toISOString().slice(0, 10),
      albumId: `album-${index}`,
      albumName: `Album ${index}`,
    }))
    history.rows.splice(0, history.rows.length, ...fullPage)

    const result = await getDailyPickHistory(100, 0, PICK_DATE)

    expect(result.entries).toHaveLength(100)
    expect(result.entries[99]).toEqual({
      pickDate: fullPage[99].pickDate, albumName: 'Album 99',
    })
    expect(result.hasMore).toBe(true)
    expect(history.limit).toHaveBeenCalledWith(101)
  })

  it.each([0, -1, 101, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid quantity %s before any database read',
    async (quantity) => {
      await expect(getDailyPickHistory(quantity, 0, PICK_DATE)).rejects.toBeInstanceOf(RangeError)
      expect(selectMock).not.toHaveBeenCalled()
    },
  )

  it.each([-1, -0.5, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid offset %s before any database read',
    async (offset) => {
      await expect(getDailyPickHistory(10, offset, PICK_DATE)).rejects.toBeInstanceOf(RangeError)
      expect(selectMock).not.toHaveBeenCalled()
    },
  )

  it.each(INVALID_DATES)('rejects invalid cutoff date %j before any database read', async (beforeDate) => {
    const request = getDailyPickHistory(10, 0, beforeDate)

    await expect(request).rejects.toBeInstanceOf(InvalidPickDateError)
    await expect(request).rejects.toMatchObject({ pickDate: beforeDate })
    expect(selectMock).not.toHaveBeenCalled()
  })

  it.each(['0001-01-01', '2000-02-29', '2024-02-29', '9999-12-31'])(
    'accepts valid cutoff date %s',
    async (beforeDate) => {
      history.rows.length = 0

      await expect(getDailyPickHistory(10, 0, beforeDate)).resolves.toEqual({
        entries: [], hasMore: false,
      })

      expect(compile(history.where.mock.calls[0][0]).params).toEqual([beforeDate])
    },
  )

  it('propagates the original history database error', async () => {
    const failure = new Error('History database unavailable')
    history.offset.mockRejectedValueOnce(failure)

    await expect(getDailyPickHistory(10, 0, PICK_DATE)).rejects.toBe(failure)
  })

  it.each([0, 2])('rejects a missing album at result index %s, including the lookahead row', async (index) => {
    history.rows[index] = { ...rows[index], albumName: null }
    const request = getDailyPickHistory(2, 0, PICK_DATE)

    await expect(request).rejects.toBeInstanceOf(AlbumNotFoundError)
    await expect(request).rejects.toMatchObject({ albumId: rows[index].albumId })
  })
})
