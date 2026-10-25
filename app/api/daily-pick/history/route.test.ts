import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AlbumNotFoundError, CatalogAlbumHasNoArtistsError } from '@/lib/catalog/errors'
import type {
  DailyPickHistoryResult,
  getDailyPickByDate,
  getDailyPickHistory,
} from '@/lib/daily-pick/queries'

const { getDailyPickHistoryMock, getDailyPickByDateMock } = vi.hoisted(() => ({
  getDailyPickHistoryMock: vi.fn<typeof getDailyPickHistory>(),
  getDailyPickByDateMock: vi.fn<typeof getDailyPickByDate>(),
}))

vi.mock('@/lib/daily-pick/queries', () => ({
  getDailyPickHistory: getDailyPickHistoryMock,
  getDailyPickByDate: getDailyPickByDateMock,
}))

import * as route from './route'

const BEFORE_DATE = '2026-10-24'
const HISTORY: DailyPickHistoryResult = {
  entries: [
    { pickDate: '2026-10-23', albumName: 'Newer Album' },
    { pickDate: '2026-10-22', albumName: 'Older Album' },
  ],
  hasMore: true,
}

function historyRequest(parameters: Record<string, string> = {
  quantity: '20', offset: '0', beforeDate: BEFORE_DATE,
}): Request {
  return new Request(
    `https://daily-album.test/api/daily-pick/history?${new URLSearchParams(parameters)}`,
  )
}

const INVALID_NUMBERS = [
  '', ' ', '\t', '\n', ' 20', '20 ', '20\n', '20\r\n',
  '+1', '-1', '-0', '1.0', '0.5', '20.', '.5', '1e1', '2E1',
  '0x10', '0X10', '0b10', '0o10', 'NaN', 'Infinity', '-Infinity',
  '20abc', '20,0', '1_0', '1/2', '１２', '٢٠',
  '9007199254740992', '9007199254740993', '9'.repeat(400),
]

const INVALID_DATES = [
  '', 'invalid-private-date', '2026-1-01', '2026-01-1', '26-01-01',
  '10000-01-01', '2026/01/01', '2026-10-24T00:00:00Z',
  ' 2026-10-24', '2026-10-24 ', '2026-10-24\n',
  '2026-00-10', '2026-13-01', '2026-01-00', '2026-01-32',
  '2026-04-31', '2026-02-29', '2024-02-30', '1900-02-29',
  '2100-02-29', '0000-01-01',
]

describe('GET /api/daily-pick/history', () => {
  beforeEach(() => {
    getDailyPickHistoryMock.mockReset()
    getDailyPickHistoryMock.mockResolvedValue(HISTORY)
    getDailyPickByDateMock.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('exports only GET with the Node.js runtime and dynamic execution', () => {
    expect(Object.keys(route).sort()).toEqual(['GET', 'dynamic', 'runtime'])
    expect(route.runtime).toBe('nodejs')
    expect(route.dynamic).toBe('force-dynamic')
  })

  it('returns the query result directly without authentication', async () => {
    const response = await route.GET(historyRequest({
      quantity: '20', offset: '40', beforeDate: BEFORE_DATE,
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(await response.json()).toEqual(HISTORY)
    expect(getDailyPickHistoryMock).toHaveBeenCalledExactlyOnceWith(20, 40, BEFORE_DATE)
    expect(getDailyPickByDateMock).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each([true, false])('preserves entries and hasMore=%s without recomputing pagination', async (hasMore) => {
    const history: DailyPickHistoryResult = { entries: [...HISTORY.entries], hasMore }
    getDailyPickHistoryMock.mockResolvedValue(history)

    const response = await route.GET(historyRequest({
      quantity: '1', offset: '0', beforeDate: BEFORE_DATE,
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual(history)
    expect(getDailyPickHistoryMock).toHaveBeenCalledExactlyOnceWith(1, 0, BEFORE_DATE)
  })

  it('returns 200 for an empty history', async () => {
    getDailyPickHistoryMock.mockResolvedValue({ entries: [], hasMore: false })

    const response = await route.GET(historyRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ entries: [], hasMore: false })
    expect(getDailyPickHistoryMock).toHaveBeenCalledExactlyOnceWith(20, 0, BEFORE_DATE)
  })

  it.each(['quantity', 'offset', 'beforeDate'])('rejects a missing %s before querying', async (missing) => {
    const parameters: Record<string, string> = {
      quantity: '20', offset: '0', beforeDate: BEFORE_DATE,
    }
    delete parameters[missing]

    const response = await route.GET(historyRequest(parameters))

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Invalid history parameters' })
    expect(getDailyPickHistoryMock).not.toHaveBeenCalled()
    expect(getDailyPickByDateMock).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('rejects a request with no parameters before querying', async () => {
    const response = await route.GET(historyRequest({}))

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Invalid history parameters' })
    expect(getDailyPickHistoryMock).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each(INVALID_NUMBERS.flatMap((value) => [
    { parameter: 'quantity', value },
    { parameter: 'offset', value },
  ]))('rejects $parameter=$value before querying', async ({ parameter, value }) => {
    const response = await route.GET(historyRequest({
      quantity: '20', offset: '0', beforeDate: BEFORE_DATE, [parameter]: value,
    }))

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Invalid history parameters' })
    expect(getDailyPickHistoryMock).not.toHaveBeenCalled()
    expect(getDailyPickByDateMock).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each(['0', '101', '9007199254740991'])('rejects out-of-range quantity %s before querying', async (quantity) => {
    const response = await route.GET(historyRequest({
      quantity, offset: '0', beforeDate: BEFORE_DATE,
    }))

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Invalid history parameters' })
    expect(getDailyPickHistoryMock).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each([
    { quantity: '1', offset: '0', expectedQuantity: 1, expectedOffset: 0 },
    { quantity: '100', offset: '1', expectedQuantity: 100, expectedOffset: 1 },
    { quantity: '20', offset: '9007199254740991', expectedQuantity: 20, expectedOffset: Number.MAX_SAFE_INTEGER },
    { quantity: '020', offset: '000', expectedQuantity: 20, expectedOffset: 0 },
  ])('accepts quantity=$quantity and offset=$offset', async ({
    quantity, offset, expectedQuantity, expectedOffset,
  }) => {
    const response = await route.GET(historyRequest({ quantity, offset, beforeDate: BEFORE_DATE }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual(HISTORY)
    expect(getDailyPickHistoryMock).toHaveBeenCalledExactlyOnceWith(
      expectedQuantity, expectedOffset, BEFORE_DATE,
    )
  })

  it.each(INVALID_DATES)('rejects invalid beforeDate %j before querying', async (beforeDate) => {
    const response = await route.GET(historyRequest({ quantity: '20', offset: '0', beforeDate }))

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Invalid history parameters' })
    expect(getDailyPickHistoryMock).not.toHaveBeenCalled()
    expect(getDailyPickByDateMock).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each(['0001-01-01', '0099-12-31', '2000-02-29', '2024-02-29', '9999-12-31'])(
    'passes the valid calendar boundary %s unchanged',
    async (beforeDate) => {
      const response = await route.GET(historyRequest({ quantity: '20', offset: '0', beforeDate }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(HISTORY)
      expect(getDailyPickHistoryMock).toHaveBeenCalledExactlyOnceWith(20, 0, beforeDate)
    },
  )

  it('uses the caller cutoff even when it is ahead of the server UTC date', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T12:30:00.000Z'))
    const history: DailyPickHistoryResult = {
      entries: [{ pickDate: '2026-10-23', albumName: 'Today on the Server' }],
      hasMore: false,
    }
    getDailyPickHistoryMock.mockResolvedValue(history)

    const response = await route.GET(historyRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(history)
    expect(getDailyPickHistoryMock).toHaveBeenCalledExactlyOnceWith(20, 0, BEFORE_DATE)
  })

  it.each([
    [new Error('private-database-details'), 'UnexpectedError'],
    [new RangeError('private-internal-range-failure'), 'RangeError'],
    [new TypeError('private-internal-type-failure'), 'TypeError'],
    [new AlbumNotFoundError('private-album-id'), 'AlbumNotFoundError'],
    [new CatalogAlbumHasNoArtistsError('private-album-id'), 'CatalogAlbumHasNoArtistsError'],
    [null, 'UnexpectedError'],
    ['private-rejection', 'UnexpectedError'],
    [{ message: 'private-rejection' }, 'UnexpectedError'],
  ])('returns a sanitized 500 for unexpected rejection %j', async (error, errorType) => {
    getDailyPickHistoryMock.mockRejectedValue(error)

    const response = await route.GET(historyRequest())

    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Unable to load daily pick history' })
    expect(getDailyPickHistoryMock).toHaveBeenCalledExactlyOnceWith(20, 0, BEFORE_DATE)
    expect(console.error).toHaveBeenCalledExactlyOnceWith('Daily pick history read failed', {
      stage: 'query', errorType,
    })
  })

  it('does not expose internal messages, names, stacks or causes in errors or logs', async () => {
    const details = 'private-database-password private-access-token'
    const error = new Error(details, { cause: new Error(details) })
    error.name = details
    error.stack = details
    getDailyPickHistoryMock.mockRejectedValue(error)

    const response = await route.GET(historyRequest())
    const responseText = await response.text()

    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(JSON.parse(responseText)).toEqual({ error: 'Unable to load daily pick history' })
    expect(responseText).not.toContain(details)
    expect(console.error).toHaveBeenCalledExactlyOnceWith('Daily pick history read failed', {
      stage: 'query', errorType: 'UnexpectedError',
    })
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('logs a trusted domain class label even when its name contains sensitive data', async () => {
    const error = new AlbumNotFoundError('private-album-id')
    error.name = 'private-error-name private-access-token'
    getDailyPickHistoryMock.mockRejectedValue(error)

    const response = await route.GET(historyRequest())

    expect(response.status).toBe(500)
    expect(console.error).toHaveBeenCalledExactlyOnceWith('Daily pick history read failed', {
      stage: 'query', errorType: 'AlbumNotFoundError',
    })
  })

  it('distinguishes response failures from query failures without logging response data', async () => {
    vi.spyOn(Response, 'json').mockImplementationOnce(() => {
      throw new TypeError('private response serialization details')
    })

    const response = await route.GET(historyRequest())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Unable to load daily pick history' })
    expect(console.error).toHaveBeenCalledExactlyOnceWith('Daily pick history read failed', {
      stage: 'response', errorType: 'TypeError',
    })
  })

  it('validates before initializing queries and sanitizes initialization failures', async () => {
    const loadQueriesMock = vi.fn(() => {
      throw new Error('private-database-configuration')
    })
    vi.doMock('@/lib/daily-pick/queries', loadQueriesMock)

    try {
      const invalidResponse = await route.GET(historyRequest({
        quantity: '1.0', offset: '0', beforeDate: BEFORE_DATE,
      }))
      expect(invalidResponse.status).toBe(400)
      const invalidDateResponse = await route.GET(historyRequest({
        quantity: '20', offset: '0', beforeDate: '2026-02-29',
      }))
      expect(invalidDateResponse.status).toBe(400)
      expect(loadQueriesMock).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()

      const response = await route.GET(historyRequest())

      expect(response.status).toBe(500)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(await response.json()).toEqual({ error: 'Unable to load daily pick history' })
      expect(loadQueriesMock).toHaveBeenCalledOnce()
      expect(getDailyPickHistoryMock).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalledExactlyOnceWith('Daily pick history read failed', {
        stage: 'initialization', errorType: 'UnexpectedError',
      })
    } finally {
      vi.doMock('@/lib/daily-pick/queries', () => ({
        getDailyPickHistory: getDailyPickHistoryMock,
        getDailyPickByDate: getDailyPickByDateMock,
      }))
    }
  })
})
