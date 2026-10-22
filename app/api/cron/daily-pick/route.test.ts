import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DailyPickTargetBeforeStartDateError,
  EmptyActiveCatalogError,
  IncompatibleDailyPickHistoryError,
  InvalidDailyPickStartDateError,
  InvalidPickDateError,
  MissingDailyPickStartDateError,
  OutOfOrderDailyPickError,
} from '@/lib/daily-pick/errors'
import type { generateDailyPicksThrough } from '@/lib/daily-pick/recovery'

const { generateDailyPicksThroughMock } = vi.hoisted(() => ({
  generateDailyPicksThroughMock: vi.fn<typeof generateDailyPicksThrough>(),
}))

vi.mock('@/lib/daily-pick/recovery', () => ({
  generateDailyPicksThrough: generateDailyPicksThroughMock,
}))

import { dynamic, GET, runtime } from './route'

const CRON_SECRET = 'test-cron-secret'
const TARGET_DATE = '2026-10-22'
const consoleErrorMock = vi.fn()
const consoleWarnMock = vi.fn()

function cronRequest(
  authorization: string | undefined = `Bearer ${CRON_SECRET}`,
  search = '',
): Request {
  return new Request(`https://daily-album.test/api/cron/daily-pick${search}`, {
    headers: authorization === undefined ? {} : { Authorization: authorization },
  })
}

describe('GET /api/cron/daily-pick', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'))
    vi.stubEnv('CRON_SECRET', CRON_SECRET)
    generateDailyPicksThroughMock.mockReset()
    generateDailyPicksThroughMock.mockResolvedValue({ generatedCount: 1, completed: true })
    consoleErrorMock.mockReset()
    vi.spyOn(console, 'error').mockImplementation(consoleErrorMock)
    consoleWarnMock.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(consoleWarnMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('uses the Node.js runtime and dynamic execution', () => {
    expect(runtime).toBe('nodejs')
    expect(dynamic).toBe('force-dynamic')
  })

  it.each([undefined, ''])('rejects missing or empty CRON_SECRET %j', async (secret) => {
    vi.stubEnv('CRON_SECRET', secret)

    const response = await GET(cronRequest(`Bearer ${secret}`))

    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      success: false,
      error: 'Daily pick service is unavailable',
    })
    expect(generateDailyPicksThroughMock).not.toHaveBeenCalled()
    expect(consoleErrorMock).not.toHaveBeenCalled()
  })

  it.each([
    undefined,
    '',
    'Bearer incorrect-secret',
    'Bearer test-cron-secreu',
    `Basic ${CRON_SECRET}`,
    `bearer ${CRON_SECRET}`,
    `Bearer ${CRON_SECRET} extra`,
  ])('rejects missing or invalid Authorization %j', async (authorization) => {
    // Passing undefined explicitly must represent a missing header.
    const request = authorization === undefined
      ? new Request('https://daily-album.test/api/cron/daily-pick')
      : cronRequest(authorization)
    const response = await GET(request)

    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ success: false, error: 'Unauthorized' })
    expect(generateDailyPicksThroughMock).not.toHaveBeenCalled()
    expect(consoleErrorMock).not.toHaveBeenCalled()
  })

  it('does not authenticate with query parameters or the Vercel User-Agent', async () => {
    const request = new Request(
      `https://daily-album.test/api/cron/daily-pick?secret=${CRON_SECRET}&CRON_SECRET=${CRON_SECRET}`,
      { headers: { 'User-Agent': 'vercel-cron/1.0' } },
    )

    const response = await GET(request)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ success: false, error: 'Unauthorized' })
    expect(generateDailyPicksThroughMock).not.toHaveBeenCalled()
  })

  it.each([
    ['missing configuration', undefined, `Bearer ${CRON_SECRET}`, 500],
    ['empty configuration', '', `Bearer ${CRON_SECRET}`, 500],
    ['invalid credentials', CRON_SECRET, 'Bearer incorrect-secret', 401],
  ] as const)('does not obtain a date for %s', async (_label, secret, authorization, status) => {
    vi.stubEnv('CRON_SECRET', secret)
    const request = cronRequest(authorization)
    const isoDateSpy = vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
      throw new Error('Date accessed before authentication')
    })

    const response = await GET(request)

    expect(response.status).toBe(status)
    expect(isoDateSpy).not.toHaveBeenCalled()
    expect(generateDailyPicksThroughMock).not.toHaveBeenCalled()
  })

  it('accepts correct Bearer authentication and returns successful recovery', async () => {
    const response = await GET(cronRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      success: true,
      targetDate: TARGET_DATE,
      generatedCount: 1,
      completed: true,
    })
    expect(generateDailyPicksThroughMock).toHaveBeenCalledExactlyOnceWith(TARGET_DATE)
    expect(consoleErrorMock).not.toHaveBeenCalled()
    expect(consoleWarnMock).not.toHaveBeenCalled()
  })

  it.each([
    ['2026-10-21T23:59:59.999Z', '2026-10-22'],
    ['2026-10-21T00:30:00+14:00', '2026-10-21'],
    ['2026-10-21T23:30:00-03:00', '2026-10-23'],
    ['2026-04-30T23:59:59.999Z', '2026-05-01'],
    ['2026-12-31T23:59:59.999Z', '2027-01-01'],
    ['2024-02-28T12:00:00.000Z', '2024-02-29'],
    ['2024-02-29T12:00:00.000Z', '2024-03-01'],
    ['2026-02-28T12:00:00.000Z', '2026-03-01'],
  ])('targets tomorrow in UTC at %s', async (now, targetDate) => {
    vi.setSystemTime(new Date(now))
    for (const method of ['getFullYear', 'getMonth', 'getDate', 'setDate'] as const) {
      vi.spyOn(Date.prototype, method).mockImplementation(() => {
        throw new Error('Local calendar date accessed')
      })
    }

    const response = await GET(cronRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ targetDate })
    expect(generateDailyPicksThroughMock).toHaveBeenCalledExactlyOnceWith(targetDate)
  })

  it('returns success when history is already complete with zero generated picks', async () => {
    generateDailyPicksThroughMock.mockResolvedValue({ generatedCount: 0, completed: true })

    const response = await GET(cronRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      targetDate: TARGET_DATE,
      generatedCount: 0,
      completed: true,
    })
    expect(consoleWarnMock).not.toHaveBeenCalled()
  })

  it('returns 503 with committed progress when recovery is incomplete without retrying', async () => {
    generateDailyPicksThroughMock.mockResolvedValue({ generatedCount: 10, completed: false })

    const response = await GET(cronRequest())

    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      success: false,
      targetDate: TARGET_DATE,
      generatedCount: 10,
      completed: false,
    })
    expect(generateDailyPicksThroughMock).toHaveBeenCalledExactlyOnceWith(TARGET_DATE)
    expect(consoleWarnMock).toHaveBeenCalledExactlyOnceWith('Daily pick cron incomplete', {
      targetDate: TARGET_DATE,
      generatedCount: 10,
    })
  })

  it.each([
    [new EmptyActiveCatalogError(), 'EmptyActiveCatalogError'],
    [new InvalidPickDateError('private-invalid-date'), 'InvalidPickDateError'],
    [new OutOfOrderDailyPickError('private-date', 'private-latest-date'), 'OutOfOrderDailyPickError'],
    [new MissingDailyPickStartDateError(), 'MissingDailyPickStartDateError'],
    [new InvalidDailyPickStartDateError('private-start-date'), 'InvalidDailyPickStartDateError'],
    [new DailyPickTargetBeforeStartDateError('private-target', 'private-start'), 'DailyPickTargetBeforeStartDateError'],
    [new IncompatibleDailyPickHistoryError('private-start', 'private-earliest'), 'IncompatibleDailyPickHistoryError'],
  ])('returns a safe 500 for domain error %s', async (error, errorType) => {
    generateDailyPicksThroughMock.mockRejectedValue(error)

    const response = await GET(cronRequest())

    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      success: false,
      error: 'Daily pick generation failed',
    })
    expect(consoleErrorMock).toHaveBeenCalledExactlyOnceWith('Daily pick cron failed', {
      targetDate: TARGET_DATE,
      errorType,
    })
    expect(generateDailyPicksThroughMock).toHaveBeenCalledExactlyOnceWith(TARGET_DATE)
  })

  it('sanitizes unexpected errors, including malicious names, stacks and causes', async () => {
    const sensitiveDetails = `postgresql://private-user:private-password@database.test/app ${CRON_SECRET}`
    const error = new Error(sensitiveDetails, { cause: new Error(sensitiveDetails) })
    error.name = sensitiveDetails
    error.stack = sensitiveDetails
    generateDailyPicksThroughMock.mockRejectedValue(error)

    const response = await GET(cronRequest())
    const responseText = await response.text()

    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(JSON.parse(responseText)).toEqual({
      success: false,
      error: 'Daily pick generation failed',
    })
    expect(responseText).not.toContain(CRON_SECRET)
    expect(responseText).not.toContain('private-password')
    expect(consoleErrorMock).toHaveBeenCalledExactlyOnceWith('Daily pick cron failed', {
      targetDate: TARGET_DATE,
      errorType: 'UnexpectedError',
    })
    expect(generateDailyPicksThroughMock).toHaveBeenCalledExactlyOnceWith(TARGET_DATE)
  })

  it('uses a trusted domain class rather than its mutable error name for logging', async () => {
    const error = new EmptyActiveCatalogError()
    error.name = `private-error-name ${CRON_SECRET}`
    generateDailyPicksThroughMock.mockRejectedValue(error)

    const response = await GET(cronRequest())

    expect(response.status).toBe(500)
    expect(consoleErrorMock).toHaveBeenCalledExactlyOnceWith('Daily pick cron failed', {
      targetDate: TARGET_DATE,
      errorType: 'EmptyActiveCatalogError',
    })
  })

  it.each([null, 'private-rejection', { message: 'private-rejection' }])(
    'handles non-Error rejections safely: %j',
    async (error) => {
      generateDailyPicksThroughMock.mockRejectedValue(error)

      const response = await GET(cronRequest())

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        success: false,
        error: 'Daily pick generation failed',
      })
      expect(consoleErrorMock).toHaveBeenCalledExactlyOnceWith('Daily pick cron failed', {
        targetDate: TARGET_DATE,
        errorType: 'UnexpectedError',
      })
    },
  )

  it('ignores caller target dates in query parameters and never reads a body', async () => {
    const request = cronRequest(
      `Bearer ${CRON_SECRET}`,
      '?targetDate=1900-01-01&date=9999-12-31',
    )
    const jsonSpy = vi.spyOn(request, 'json').mockResolvedValue({ targetDate: '1900-01-01' })
    const textSpy = vi.spyOn(request, 'text').mockResolvedValue('{"targetDate":"1900-01-01"}')

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ targetDate: TARGET_DATE })
    expect(generateDailyPicksThroughMock).toHaveBeenCalledExactlyOnceWith(TARGET_DATE)
    expect(jsonSpy).not.toHaveBeenCalled()
    expect(textSpy).not.toHaveBeenCalled()
  })

  it('defers recovery initialization until authenticated and sanitizes initialization failures', async () => {
    const loadRecoveryMock = vi.fn(() => {
      throw new Error(`private-database-configuration ${CRON_SECRET}`)
    })
    vi.doMock('@/lib/daily-pick/recovery', loadRecoveryMock)

    try {
      const unauthorizedResponse = await GET(cronRequest('Bearer incorrect-secret'))
      expect(unauthorizedResponse.status).toBe(401)
      expect(loadRecoveryMock).not.toHaveBeenCalled()

      const response = await GET(cronRequest())

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        success: false,
        error: 'Daily pick generation failed',
      })
      expect(loadRecoveryMock).toHaveBeenCalledOnce()
      expect(generateDailyPicksThroughMock).not.toHaveBeenCalled()
      expect(consoleErrorMock).toHaveBeenCalledExactlyOnceWith('Daily pick cron failed', {
        targetDate: TARGET_DATE,
        errorType: 'UnexpectedError',
      })
    } finally {
      vi.doMock('@/lib/daily-pick/recovery', () => ({
        generateDailyPicksThrough: generateDailyPicksThroughMock,
      }))
    }
  })
})
