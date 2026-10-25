import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AlbumNotFoundError, CatalogAlbumHasNoArtistsError } from '@/lib/catalog/errors'
import type { DailyPickDetails, getDailyPickByDate } from '@/lib/daily-pick/queries'

const { getDailyPickByDateMock, fetchMock } = vi.hoisted(() => ({
  getDailyPickByDateMock: vi.fn<typeof getDailyPickByDate>(),
  fetchMock: vi.fn(),
}))

vi.mock('@/lib/daily-pick/queries', () => ({
  getDailyPickByDate: getDailyPickByDateMock,
}))

import * as route from './route'

const { GET } = route
const PICK_DATE = '2026-10-21'
const dailyPick = {
  pickDate: PICK_DATE,
  album: {
    id: 'album-id',
    spotifyId: 'spotify-album-id',
    name: 'Example Album',
    coverUrl: null,
    spotifyAlbumType: 'album',
    releaseKind: 'ep',
    releaseDateRaw: '1984',
    totalTracks: 5,
    durationMs: null,
    hasSpotifyMarkedExplicitTracks: false,
    artists: [
      { id: 'primary-artist', name: 'Z Primary Artist' },
      { id: 'guest-artist', name: 'A Guest Artist' },
    ],
    tagCategories: [
      {
        id: 'genre', name: 'Genre', description: null,
        tags: [{ id: 'ambient', name: 'Ambient' }],
      },
    ],
  },
} satisfies DailyPickDetails

function pickRequest(date: string | null = PICK_DATE): Request {
  const url = new URL('https://daily-album.test/api/daily-pick')
  if (date !== null) {
    url.searchParams.set('date', date)
  }
  return new Request(url)
}

describe('GET /api/daily-pick', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'))
    getDailyPickByDateMock.mockReset()
    getDailyPickByDateMock.mockResolvedValue(dailyPick)
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    expect(fetchMock).not.toHaveBeenCalled()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses dynamic execution on Node.js and only exports a GET handler', () => {
    expect(route.runtime).toBe('nodejs')
    expect(route.dynamic).toBe('force-dynamic')
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      expect(route).not.toHaveProperty(method)
    }
  })

  it('returns the unmodified details without requiring authentication', async () => {
    const response = await GET(pickRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(await response.json()).toEqual(dailyPick)
    expect(getDailyPickByDateMock).toHaveBeenCalledExactlyOnceWith(PICK_DATE)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('returns a generic 404 when no pick exists', async () => {
    getDailyPickByDateMock.mockResolvedValue(null)

    const response = await GET(pickRequest())

    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Daily pick not found' })
    expect(getDailyPickByDateMock).toHaveBeenCalledExactlyOnceWith(PICK_DATE)
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each([
    null, '', ' ', 'private-invalid-date',
    '2026-1-01', '2026-01-1', '26-01-01', '10000-01-01',
    '2026/01/01', '2026-10-21T00:00:00Z', ' 2026-10-21', '2026-10-21 ',
    '2026-10-21\n', '2026-00-10', '2026-13-01', '2026-01-00',
    '2026-01-32', '2026-04-31', '2026-02-29', '2024-02-30',
    '1900-02-29', '2100-02-29', '0000-01-01',
  ])('rejects missing or invalid date %j before querying', async (date) => {
    const response = await GET(pickRequest(date))

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Invalid date' })
    expect(getDailyPickByDateMock).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })

  it.each([
    '0001-01-01', '0099-12-31', '1900-02-28', '2000-02-29',
    '2024-02-29', '2026-04-30', '2026-12-31', '9999-12-31',
  ])('preserves the requested calendar date %s', async (pickDate) => {
    const details = { ...dailyPick, pickDate }
    getDailyPickByDateMock.mockResolvedValue(details)

    const response = await GET(pickRequest(pickDate))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual(details)
    expect(getDailyPickByDateMock).toHaveBeenCalledExactlyOnceWith(pickDate)
  })

  it('accepts a browser date ahead of the server UTC date', async () => {
    vi.setSystemTime(new Date('2026-10-21T23:30:00.000Z'))
    const pickDate = '2026-10-22'
    const details = { ...dailyPick, pickDate }
    getDailyPickByDateMock.mockResolvedValue(details)

    const response = await GET(pickRequest(pickDate))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(details)
    expect(getDailyPickByDateMock).toHaveBeenCalledExactlyOnceWith(pickDate)
  })

  it.each([
    [new Error('private database failure'), 'UnexpectedError'],
    [new RangeError('private database range failure'), 'RangeError'],
    [new TypeError('private database type failure'), 'TypeError'],
    [new AlbumNotFoundError('private-album-id'), 'AlbumNotFoundError'],
    [new CatalogAlbumHasNoArtistsError('private-album-id'), 'CatalogAlbumHasNoArtistsError'],
    [null, 'UnexpectedError'],
    ['private-rejection', 'UnexpectedError'],
    [{ message: 'private-rejection' }, 'UnexpectedError'],
  ])('sanitizes internal failures: %s', async (error, errorType) => {
    getDailyPickByDateMock.mockRejectedValue(error)

    const response = await GET(pickRequest())

    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Unable to load daily pick' })
    expect(getDailyPickByDateMock).toHaveBeenCalledExactlyOnceWith(PICK_DATE)
    expect(console.error).toHaveBeenCalledExactlyOnceWith('Daily pick read failed', {
      stage: 'query', errorType,
    })
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not expose error messages, properties, stacks or causes in responses or logs', async () => {
    const privateDetails = 'private database credentials and internal query'
    const error = new Error(privateDetails, { cause: new Error(privateDetails) })
    error.name = 'InvalidPickDateError'
    error.stack = privateDetails
    getDailyPickByDateMock.mockRejectedValue(error)

    const response = await GET(pickRequest())
    const responseText = await response.text()

    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(JSON.parse(responseText)).toEqual({ error: 'Unable to load daily pick' })
    expect(responseText).not.toContain(privateDetails)
    expect(responseText).not.toContain(error.name)
    expect(console.error).toHaveBeenCalledExactlyOnceWith('Daily pick read failed', {
      stage: 'query', errorType: 'UnexpectedError',
    })
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('logs a trusted domain class label even when its name contains sensitive data', async () => {
    const error = new AlbumNotFoundError('private-album-id')
    error.name = 'private-error-name private-access-token'
    getDailyPickByDateMock.mockRejectedValue(error)

    const response = await GET(pickRequest())

    expect(response.status).toBe(500)
    expect(console.error).toHaveBeenCalledExactlyOnceWith('Daily pick read failed', {
      stage: 'query', errorType: 'AlbumNotFoundError',
    })
  })

  it('distinguishes response failures from query failures without logging response data', async () => {
    vi.spyOn(Response, 'json').mockImplementationOnce(() => {
      throw new TypeError('private response serialization details')
    })

    const response = await GET(pickRequest())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Unable to load daily pick' })
    expect(console.error).toHaveBeenCalledExactlyOnceWith('Daily pick read failed', {
      stage: 'response', errorType: 'TypeError',
    })
  })

  it('validates before loading queries and handles initialization failures', async () => {
    const loadQueriesMock = vi.fn(() => {
      throw new Error('private database initialization details')
    })
    vi.doMock('@/lib/daily-pick/queries', loadQueriesMock)

    try {
      const invalidResponse = await GET(pickRequest(null))
      expect(invalidResponse.status).toBe(400)
      expect(invalidResponse.headers.get('Cache-Control')).toBe('no-store')
      expect(await invalidResponse.json()).toEqual({ error: 'Invalid date' })
      expect(loadQueriesMock).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()

      const response = await GET(pickRequest())

      expect(response.status).toBe(500)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(await response.json()).toEqual({ error: 'Unable to load daily pick' })
      expect(loadQueriesMock).toHaveBeenCalledOnce()
      expect(getDailyPickByDateMock).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalledExactlyOnceWith('Daily pick read failed', {
        stage: 'initialization', errorType: 'UnexpectedError',
      })
      expect(console.warn).not.toHaveBeenCalled()
    } finally {
      vi.doMock('@/lib/daily-pick/queries', () => ({
        getDailyPickByDate: getDailyPickByDateMock,
      }))
    }
  })
})
