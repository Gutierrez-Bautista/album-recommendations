import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DailyPickTargetBeforeStartDateError,
  EmptyActiveCatalogError,
  IncompatibleDailyPickHistoryError,
  InvalidDailyPickStartDateError,
  InvalidPickDateError,
  MissingDailyPickStartDateError,
  OutOfOrderDailyPickError,
} from './errors'
import type { DailyPickCreationResult } from './selector'

const { selectMock, createDailyPickMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  createDailyPickMock: vi.fn<(pickDate: string) => Promise<DailyPickCreationResult>>(),
}))

// No transaction or write methods: recovery must delegate creation to the selector.
vi.mock('@/src/db', () => ({ default: { select: selectMock } }))
vi.mock('./selector', () => ({ createDailyPick: createDailyPickMock }))

import { generateDailyPicksThrough } from './recovery'

const START_DATE = '2026-10-20'
let persistedDates: Set<string>

function historyQuery() {
  // Each query sees one persisted snapshot, as a single PostgreSQL SELECT would.
  const result = Promise.resolve([...persistedDates].sort().map((pickDate) => ({ pickDate })))
  return {
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    then: result.then.bind(result),
  }
}

async function persistPick(pickDate: string): Promise<DailyPickCreationResult> {
  if (persistedDates.has(pickDate)) {
    return 'existing'
  }
  persistedDates.add(pickDate)
  return 'created'
}

function attemptedDates(): string[] {
  return createDailyPickMock.mock.calls.map(([pickDate]) => pickDate)
}

const INVALID_DATES = [
  ' ', '2026-1-01', '2026-01-1', '26-01-01', '10000-01-01',
  '2026/01/01', '2026-10-20T00:00:00Z', ' 2026-10-20', '2026-10-20 ',
  '2026-10-20\n', '2026-00-10', '2026-13-01', '2026-01-00',
  '2026-01-32', '2026-04-31', '2026-02-29', '2024-02-30',
  '1900-02-29', '2100-02-29', '0000-01-01',
]

describe('generateDailyPicksThrough', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('DAILY_PICK_START_DATE', START_DATE)
    persistedDates = new Set()
    selectMock.mockImplementation(historyQuery)
    createDailyPickMock.mockImplementation(persistPick)
  })

  describe('configuration and input', () => {
    it.each([undefined, ''])('rejects missing or empty configuration %j before querying', async (startDate) => {
      vi.stubEnv('DAILY_PICK_START_DATE', startDate)

      await expect(generateDailyPicksThrough(START_DATE))
        .rejects.toBeInstanceOf(MissingDailyPickStartDateError)

      expect(selectMock).not.toHaveBeenCalled()
      expect(createDailyPickMock).not.toHaveBeenCalled()
    })

    it.each(INVALID_DATES)('rejects invalid configured date %j before querying', async (startDate) => {
      vi.stubEnv('DAILY_PICK_START_DATE', startDate)
      const request = generateDailyPicksThrough(START_DATE)

      await expect(request).rejects.toBeInstanceOf(InvalidDailyPickStartDateError)
      await expect(request).rejects.toMatchObject({ startDate })
      expect(selectMock).not.toHaveBeenCalled()
      expect(createDailyPickMock).not.toHaveBeenCalled()
    })

    it.each(['', ...INVALID_DATES])('rejects invalid target %j before querying', async (targetDate) => {
      const request = generateDailyPicksThrough(targetDate)

      await expect(request).rejects.toBeInstanceOf(InvalidPickDateError)
      await expect(request).rejects.toMatchObject({ pickDate: targetDate })
      expect(selectMock).not.toHaveBeenCalled()
      expect(createDailyPickMock).not.toHaveBeenCalled()
    })

    it('rejects a target before the configured start date before querying', async () => {
      const request = generateDailyPicksThrough('2026-10-19')

      await expect(request).rejects.toBeInstanceOf(DailyPickTargetBeforeStartDateError)
      await expect(request).rejects.toMatchObject({ targetDate: '2026-10-19', startDate: START_DATE })
      expect(selectMock).not.toHaveBeenCalled()
      expect(createDailyPickMock).not.toHaveBeenCalled()
    })
  })

  describe('history and calendar order', () => {
    it('starts at the configured date when there are no picks', async () => {
      await expect(generateDailyPicksThrough(START_DATE))
        .resolves.toEqual({ generatedCount: 1, completed: true })

      expect(attemptedDates()).toEqual([START_DATE])
      expect([...persistedDates]).toEqual([START_DATE])
    })

    it.each(['2026-10-20', '2026-10-21', '2026-10-22'])(
      'returns without creation when continuous history already covers %s',
      async (targetDate) => {
        persistedDates = new Set(['2026-10-20', '2026-10-21', '2026-10-22'])

        await expect(generateDailyPicksThrough(targetDate))
          .resolves.toEqual({ generatedCount: 0, completed: true })

        expect(createDailyPickMock).not.toHaveBeenCalled()
      },
    )

    it.each([
      { targetDate: '2026-10-22', expected: ['2026-10-22'] },
      { targetDate: '2026-10-24', expected: ['2026-10-22', '2026-10-23', '2026-10-24'] },
    ])('recovers trailing dates through $targetDate in order', async ({ targetDate, expected }) => {
      persistedDates = new Set(['2026-10-20', '2026-10-21'])

      await expect(generateDailyPicksThrough(targetDate))
        .resolves.toEqual({ generatedCount: expected.length, completed: true })

      expect(attemptedDates()).toEqual(expected)
    })

    it('waits for each pick to finish before attempting the next date', async () => {
      let finishFirstPick!: () => void
      const firstPick = new Promise<void>((resolve) => { finishFirstPick = resolve })
      let startFirstPick!: () => void
      const firstPickStarted = new Promise<void>((resolve) => { startFirstPick = resolve })
      createDailyPickMock.mockImplementationOnce(async (pickDate) => {
        startFirstPick()
        await firstPick
        return persistPick(pickDate)
      })

      const recovery = generateDailyPicksThrough('2026-10-22')
      await firstPickStarted
      expect(attemptedDates()).toEqual([START_DATE])
      expect(persistedDates.size).toBe(0)

      finishFirstPick()
      await expect(recovery).resolves.toEqual({ generatedCount: 3, completed: true })
      expect(attemptedDates()).toEqual(['2026-10-20', '2026-10-21', '2026-10-22'])
    })

    it.each([
      { dates: ['0001-01-01', '0001-01-02', '0001-01-03'] },
      { dates: ['0099-12-31', '0100-01-01', '0100-01-02'] },
      { dates: ['1900-02-28', '1900-03-01'] },
      { dates: ['2000-02-28', '2000-02-29', '2000-03-01'] },
      { dates: ['2024-02-28', '2024-02-29', '2024-03-01'] },
      { dates: ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'] },
      { dates: ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'] },
      { dates: ['9999-12-30', '9999-12-31'] },
    ])('recovers calendar boundaries for $dates without local date conversion', async ({ dates }) => {
      vi.stubEnv('DAILY_PICK_START_DATE', dates[0])
      vi.spyOn(Date.prototype, 'getFullYear').mockImplementation(() => { throw new Error('Local date read') })
      vi.spyOn(Date.prototype, 'getMonth').mockImplementation(() => { throw new Error('Local date read') })
      vi.spyOn(Date.prototype, 'getDate').mockImplementation(() => { throw new Error('Local date read') })
      vi.spyOn(Date.prototype, 'setDate').mockImplementation(() => { throw new Error('Local date write') })

      await expect(generateDailyPicksThrough(dates[dates.length - 1]))
        .resolves.toEqual({ generatedCount: dates.length, completed: true })

      expect(attemptedDates()).toEqual(dates)
    })

    it('resumes after existing history across a year boundary', async () => {
      vi.stubEnv('DAILY_PICK_START_DATE', '2026-12-30')
      persistedDates = new Set(['2026-12-30', '2026-12-31'])

      await expect(generateDailyPicksThrough('2027-01-02'))
        .resolves.toEqual({ generatedCount: 2, completed: true })

      expect(attemptedDates()).toEqual(['2027-01-01', '2027-01-02'])
    })

    it('recognizes completed history ending at the maximum calendar date', async () => {
      vi.stubEnv('DAILY_PICK_START_DATE', '9999-12-30')
      persistedDates = new Set(['9999-12-30', '9999-12-31'])

      await expect(generateDailyPicksThrough('9999-12-31'))
        .resolves.toEqual({ generatedCount: 0, completed: true })

      expect(createDailyPickMock).not.toHaveBeenCalled()
    })

    it.each(['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'])(
      'rejects internal gaps before any creation even when the target is %s',
      async (targetDate) => {
        persistedDates = new Set(['2026-10-20', '2026-10-21', '2026-10-23'])
        const request = generateDailyPicksThrough(targetDate)

        await expect(request).rejects.toBeInstanceOf(OutOfOrderDailyPickError)
        await expect(request).rejects.toMatchObject({
          pickDate: '2026-10-22', latestPickDate: '2026-10-23',
        })
        expect(createDailyPickMock).not.toHaveBeenCalled()
        expect([...persistedDates]).toEqual(['2026-10-20', '2026-10-21', '2026-10-23'])
      },
    )

    it.each(['2026-10-20', '2026-10-22', '2026-10-24'])(
      'rejects missing dates before the earliest pick even when the target is %s',
      async (targetDate) => {
        persistedDates = new Set(['2026-10-22', '2026-10-23'])
        const request = generateDailyPicksThrough(targetDate)

        await expect(request).rejects.toBeInstanceOf(OutOfOrderDailyPickError)
        await expect(request).rejects.toMatchObject({
          pickDate: START_DATE, latestPickDate: '2026-10-23',
        })
        expect(createDailyPickMock).not.toHaveBeenCalled()
      },
    )

    it.each([
      { dates: ['2026-10-19'] },
      { dates: ['2026-10-19', '2026-10-20', '2026-10-21'] },
    ])('rejects history preceding the configured start: $dates', async ({ dates }) => {
      persistedDates = new Set(dates)
      const request = generateDailyPicksThrough('2026-10-24')

      await expect(request).rejects.toBeInstanceOf(IncompatibleDailyPickHistoryError)
      await expect(request).rejects.toMatchObject({ startDate: START_DATE, earliestPickDate: '2026-10-19' })
      expect(createDailyPickMock).not.toHaveBeenCalled()
    })
  })

  describe('creation limit and concurrency', () => {
    it('completes exactly ten missing dates', async () => {
      await expect(generateDailyPicksThrough('2026-10-29'))
        .resolves.toEqual({ generatedCount: 10, completed: true })

      expect(attemptedDates()).toEqual([
        '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24',
        '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
      ])
      expect(persistedDates.size).toBe(10)
    })

    it('stops after ten creations with trailing dates left and resumes on the next call', async () => {
      await expect(generateDailyPicksThrough('2026-11-02'))
        .resolves.toEqual({ generatedCount: 10, completed: false })

      expect(persistedDates.size).toBe(10)
      expect(attemptedDates().at(-1)).toBe('2026-10-29')
      createDailyPickMock.mockClear()

      await expect(generateDailyPicksThrough('2026-11-02'))
        .resolves.toEqual({ generatedCount: 4, completed: true })

      expect(attemptedDates()).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
      expect(persistedDates.size).toBe(14)
    })

    it('does not count dates another process creates before the selector call', async () => {
      createDailyPickMock.mockImplementation(async (pickDate) => {
        if (pickDate === START_DATE) {
          persistedDates.add(START_DATE)
          persistedDates.add('2026-10-21')
        }
        return persistPick(pickDate)
      })

      await expect(generateDailyPicksThrough('2026-10-31'))
        .resolves.toEqual({ generatedCount: 10, completed: true })

      expect(attemptedDates()).toEqual([
        '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
        '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31',
      ])
      expect(persistedDates.size).toBe(12)
    })

    it('returns zero generated when another process creates the entire pending range', async () => {
      createDailyPickMock.mockImplementation(async () => {
        persistedDates = new Set(['2026-10-20', '2026-10-21', '2026-10-22'])
        return 'existing'
      })

      await expect(generateDailyPicksThrough('2026-10-22'))
        .resolves.toEqual({ generatedCount: 0, completed: true })

      expect(attemptedDates()).toEqual(['2026-10-20', '2026-10-21', '2026-10-22'])
    })

    it('counts ten creations after existing results and still leaves an incomplete range', async () => {
      createDailyPickMock.mockImplementation(async (pickDate) => {
        if (pickDate === START_DATE) {
          persistedDates.add(START_DATE)
          persistedDates.add('2026-10-21')
        }
        return persistPick(pickDate)
      })

      await expect(generateDailyPicksThrough('2026-11-02'))
        .resolves.toEqual({ generatedCount: 10, completed: false })

      expect(attemptedDates()).toHaveLength(12)
      expect(attemptedDates().at(-1)).toBe('2026-10-31')
      expect(persistedDates.has('2026-11-01')).toBe(false)
    })

    it('uses persisted state when another recovery finishes the range at the limit', async () => {
      createDailyPickMock.mockImplementation(async (pickDate) => {
        const result = await persistPick(pickDate)
        if (pickDate === '2026-10-29') {
          for (const date of ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']) {
            persistedDates.add(date)
          }
        }
        return result
      })

      await expect(generateDailyPicksThrough('2026-11-02'))
        .resolves.toEqual({ generatedCount: 10, completed: true })

      expect(attemptedDates()).toHaveLength(10)
      expect(persistedDates.size).toBe(14)
    })

    it('allows simultaneous recoveries of the same range without double-counting', async () => {
      const results = await Promise.all([
        generateDailyPicksThrough('2026-10-24'),
        generateDailyPicksThrough('2026-10-24'),
      ])

      expect(results.every(({ completed }) => completed)).toBe(true)
      expect(results.reduce((total, { generatedCount }) => total + generatedCount, 0)).toBe(5)
      expect(results.every(({ generatedCount }) => generatedCount <= 10)).toBe(true)
      expect(persistedDates.size).toBe(5)
    })

    it('limits each simultaneous invocation to ten new picks', async () => {
      const results = await Promise.all([
        generateDailyPicksThrough('2026-11-12'),
        generateDailyPicksThrough('2026-11-12'),
      ])

      expect(results).toEqual([
        { generatedCount: 10, completed: false },
        { generatedCount: 10, completed: false },
      ])
      expect(persistedDates.size).toBe(20)
      expect([...persistedDates].sort().at(-1)).toBe('2026-11-08')
    })
  })

  describe('failure propagation and interrupted recovery', () => {
    it.each([
      new EmptyActiveCatalogError(),
      new OutOfOrderDailyPickError('2026-10-22', '2026-10-23'),
      new Error('Insert failed'),
    ])('keeps prior commits and propagates a generation error: $name', async (failure) => {
      createDailyPickMock.mockImplementation(async (pickDate) => {
        if (pickDate === '2026-10-22') {
          throw failure
        }
        return persistPick(pickDate)
      })

      await expect(generateDailyPicksThrough('2026-10-24')).rejects.toBe(failure)

      expect([...persistedDates]).toEqual(['2026-10-20', '2026-10-21'])
      expect(attemptedDates()).toEqual(['2026-10-20', '2026-10-21', '2026-10-22'])
      createDailyPickMock.mockImplementation(persistPick)
      createDailyPickMock.mockClear()

      await expect(generateDailyPicksThrough('2026-10-24'))
        .resolves.toEqual({ generatedCount: 3, completed: true })

      expect(attemptedDates()).toEqual(['2026-10-22', '2026-10-23', '2026-10-24'])
    })

    it('propagates a database history-read error before generating anything', async () => {
      const failure = new Error('History read failed')
      selectMock.mockImplementationOnce(() => { throw failure })

      await expect(generateDailyPicksThrough(START_DATE)).rejects.toBe(failure)

      expect(createDailyPickMock).not.toHaveBeenCalled()
    })

    it('propagates a final persisted-state read error after committed creations', async () => {
      const failure = new Error('Completion read failed')
      createDailyPickMock.mockImplementation(async (pickDate) => {
        const result = await persistPick(pickDate)
        selectMock.mockImplementation(() => { throw failure })
        return result
      })

      await expect(generateDailyPicksThrough(START_DATE)).rejects.toBe(failure)

      expect([...persistedDates]).toEqual([START_DATE])
    })
  })
})
