import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import { albums } from '@/src/db/schema/catalog'
import { dailyPicks } from '@/src/db/schema/recommendations'
import {
  EmptyActiveCatalogError,
  InvalidPickDateError,
  OutOfOrderDailyPickError,
} from './errors'
import * as selection from './selection'

const {
  transactionMock,
  executeMock,
  selectMock,
  insertMock,
  valuesMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  executeMock: vi.fn(),
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  valuesMock: vi.fn(),
}))

// No root-level query methods: every operation must use the transaction object.
vi.mock('@/src/db', () => ({
  default: { transaction: transactionMock },
}))

import { createDailyPick } from './selector'

function query(rows: object[] = []) {
  const result = Promise.resolve(rows)

  return {
    rows,
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: result.then.bind(result),
  }
}

function compile(expression: SQL) {
  return new PgDialect().sqlToQuery(expression)
}

const PICK_DATE = '2026-10-20'
let existing: ReturnType<typeof query>
let latest: ReturnType<typeof query>
let active: ReturnType<typeof query>
let selected: ReturnType<typeof query>
let recent: ReturnType<typeof query>

function arrangeQueries(hasHistory = true) {
  const queries = [existing, latest, active, ...(hasHistory ? [selected] : []), recent]
  let index = 0
  selectMock.mockImplementation(() => {
    const next = queries[index++]
    if (!next) {
      throw new Error('Unexpected selection query')
    }
    return next
  })
}

describe('createDailyPick', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.spyOn(selection, 'selectDailyPick')

    existing = query()
    latest = query([{ pickDate: '2026-10-19', cycle: 2 }])
    active = query([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    selected = query([{ albumId: 'a' }])
    recent = query([{ albumId: 'a' }])
    arrangeQueries()

    executeMock.mockResolvedValue(undefined)
    valuesMock.mockResolvedValue(undefined)
    insertMock.mockReturnValue({ values: valuesMock })

    const tx = { execute: executeMock, select: selectMock, insert: insertMock }
    transactionMock.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx),
    )
  })

  it('inserts the pure selector result using only the transaction and database defaults', async () => {
    vi.mocked(selection.selectDailyPick).mockReturnValueOnce({ albumId: 'c', cycle: 2 })

    await expect(createDailyPick(PICK_DATE)).resolves.toBeUndefined()

    expect(transactionMock).toHaveBeenCalledExactlyOnceWith(
      expect.any(Function), { isolationLevel: 'read committed' },
    )
    expect(selection.selectDailyPick).toHaveBeenCalledExactlyOnceWith({
      activeAlbumIds: ['a', 'b', 'c'],
      latestCycle: 2,
      selectedAlbumIdsInLatestCycle: ['a'],
      recentAlbumIdsOldestFirst: ['a'],
    })
    expect(insertMock).toHaveBeenCalledExactlyOnceWith(dailyPicks)
    expect(valuesMock).toHaveBeenCalledExactlyOnceWith({
      albumId: 'c', cycle: 2, pickDate: PICK_DATE,
    })
    expect(selectMock.mock.invocationCallOrder[0])
      .toBeGreaterThan(executeMock.mock.invocationCallOrder[0])
  })

  it('starts the first cycle when no recommendations exist', async () => {
    latest.rows.length = 0
    recent.rows.length = 0
    arrangeQueries(false)

    await createDailyPick(PICK_DATE)

    expect(selection.selectDailyPick).toHaveBeenCalledWith({
      activeAlbumIds: ['a', 'b', 'c'],
      latestCycle: null,
      selectedAlbumIdsInLatestCycle: [],
      recentAlbumIdsOldestFirst: [],
    })
    expect(valuesMock).toHaveBeenCalledWith({ albumId: 'a', cycle: 1, pickDate: PICK_DATE })
    expect(selected.from).not.toHaveBeenCalled()
  })

  it('continues an incomplete cycle', async () => {
    await createDailyPick(PICK_DATE)

    expect(valuesMock).toHaveBeenCalledWith({ albumId: 'b', cycle: 2, pickDate: PICK_DATE })
    expect(compile(selected.where.mock.calls[0][0])).toMatchObject({
      sql: '"daily_picks"."cycle" = $1', params: [2],
    })
  })

  it('starts the next cycle when every active album was selected', async () => {
    selected.rows.push({ albumId: 'b' }, { albumId: 'c' })

    await createDailyPick(PICK_DATE)

    expect(valuesMock).toHaveBeenCalledWith({ albumId: 'b', cycle: 3, pickDate: PICK_DATE })
  })

  it('queries only non-archived IDs and permits a new cycle without archived albums', async () => {
    active.rows.splice(1)

    await createDailyPick(PICK_DATE)

    expect(active.from).toHaveBeenCalledWith(albums)
    expect(compile(active.where.mock.calls[0][0])).toMatchObject({
      sql: '("albums"."archived_at" is null)', params: [],
    })
    expect(selection.selectDailyPick).toHaveBeenCalledWith(expect.objectContaining({
      activeAlbumIds: ['a'],
    }))
    expect(valuesMock).toHaveBeenCalledWith({ albumId: 'a', cycle: 3, pickDate: PICK_DATE })
  })

  it('selects only necessary columns and obtains the latest cycle by pick date', async () => {
    await createDailyPick(PICK_DATE)

    expect(selectMock.mock.calls).toEqual([
      [{ pickDate: dailyPicks.pickDate }],
      [{ pickDate: dailyPicks.pickDate, cycle: dailyPicks.cycle }],
      [{ id: albums.id }],
      [{ albumId: dailyPicks.albumId }],
      [{ albumId: dailyPicks.albumId }],
    ])
    expect(existing.from).toHaveBeenCalledWith(dailyPicks)
    expect(compile(existing.where.mock.calls[0][0])).toMatchObject({
      sql: '"daily_picks"."pick_date" = $1', params: [PICK_DATE],
    })
    expect(existing.limit).toHaveBeenCalledWith(1)
    expect(latest.from).toHaveBeenCalledWith(dailyPicks)
    expect(compile(latest.orderBy.mock.calls[0][0]).sql).toBe('"daily_picks"."pick_date" desc')
    expect(latest.limit).toHaveBeenCalledWith(1)
  })

  it.each(['2026-10-20', '2026-01-02', '2024-03-01', '2026-03-10', '0001-01-01'])(
    'queries the preceding five calendar days oldest first for %s, including gaps',
    async (pickDate: string) => {
      latest.rows.splice(0, 1, { pickDate: '0001-01-01', cycle: 2 })
      recent.rows.splice(0, 1, { albumId: 'b' }, { albumId: 'a' })

      await createDailyPick(pickDate)

      expect(recent.from).toHaveBeenCalledWith(dailyPicks)
      expect(compile(recent.where.mock.calls[0][0])).toMatchObject({
        sql: '(("daily_picks"."pick_date" >= $1::date - 5) and ("daily_picks"."pick_date" < $2))',
        params: [pickDate, pickDate],
      })
      expect(compile(recent.orderBy.mock.calls[0][0]).sql).toBe('"daily_picks"."pick_date" asc')
      expect(recent.limit).not.toHaveBeenCalled()
      expect(selection.selectDailyPick).toHaveBeenCalledWith(expect.objectContaining({
        recentAlbumIdsOldestFirst: ['b', 'a'],
      }))
    },
  )

  it('returns successfully for an existing date before checking later dates or the catalog', async () => {
    existing.rows.push({ pickDate: PICK_DATE })
    latest.rows.splice(0, 1, { pickDate: '2026-10-21', cycle: 3 })
    active.rows.length = 0

    await expect(createDailyPick(PICK_DATE)).resolves.toBeUndefined()

    expect(executeMock).toHaveBeenCalledOnce()
    expect(selectMock).toHaveBeenCalledOnce()
    expect(selection.selectDailyPick).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejects a missing date older than the latest pick with a typed error', async () => {
    latest.rows.splice(0, 1, { pickDate: '2026-10-21', cycle: 3 })

    const request = createDailyPick(PICK_DATE)

    await expect(request).rejects.toBeInstanceOf(OutOfOrderDailyPickError)
    await expect(request).rejects.toMatchObject({
      name: 'OutOfOrderDailyPickError',
      pickDate: PICK_DATE,
      latestPickDate: '2026-10-21',
      message: expect.stringContaining('a later pick exists'),
    })
    expect(selectMock).toHaveBeenCalledTimes(2)
    expect(selection.selectDailyPick).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('propagates EmptyActiveCatalogError from the pure selector without inserting', async () => {
    active.rows.length = 0

    await expect(createDailyPick(PICK_DATE)).rejects.toBeInstanceOf(EmptyActiveCatalogError)

    expect(selection.selectDailyPick).toHaveBeenCalledOnce()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it.each([
    '', '2026-1-01', '2026-01-1', '26-01-01', '10000-01-01',
    '2026/01/01', '2026-10-20T00:00:00Z', ' 2026-10-20', '2026-10-20 ',
    '2026-10-20\n', '2026-00-10', '2026-13-01', '2026-01-00',
    '2026-01-32', '2026-04-31', '2026-02-29', '2024-02-30',
    '1900-02-29', '2100-02-29', '0000-01-01',
  ])('rejects invalid calendar date %j before opening a transaction', async (pickDate: string) => {
    const request = createDailyPick(pickDate)

    await expect(request).rejects.toBeInstanceOf(InvalidPickDateError)
    await expect(request).rejects.toMatchObject({ name: 'InvalidPickDateError', pickDate })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it.each(['0001-01-01', '0099-12-31', '1900-02-28', '2000-02-29', '2024-02-29', '9999-12-31'])(
    'accepts valid calendar date %s without a local-time conversion',
    async (pickDate: string) => {
      latest.rows.length = 0
      recent.rows.length = 0
      arrangeQueries(false)
      vi.spyOn(Date.prototype, 'getFullYear').mockImplementation(() => { throw new Error('Local date read') })
      vi.spyOn(Date.prototype, 'getMonth').mockImplementation(() => { throw new Error('Local date read') })
      vi.spyOn(Date.prototype, 'getDate').mockImplementation(() => { throw new Error('Local date read') })

      await createDailyPick(pickDate)

      expect(valuesMock).toHaveBeenCalledWith({ albumId: 'a', cycle: 1, pickDate })
    },
  )

  it('awaits the advisory lock before any selection-dependent read', async () => {
    let releaseLock!: () => void
    executeMock.mockReturnValueOnce(new Promise<void>((resolve) => { releaseLock = resolve }))

    const request = createDailyPick(PICK_DATE)

    expect(executeMock).toHaveBeenCalledOnce()
    expect(selectMock).not.toHaveBeenCalled()
    expect(selection.selectDailyPick).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()

    releaseLock()
    await expect(request).resolves.toBeUndefined()
    expect(selectMock).toHaveBeenCalledTimes(5)
  })

  it('uses the same transaction-scoped advisory lock key for different dates', async () => {
    await createDailyPick(PICK_DATE)
    arrangeQueries()
    await createDailyPick('2026-10-21')

    const firstLock = compile(executeMock.mock.calls[0][0])
    const secondLock = compile(executeMock.mock.calls[1][0])
    expect(firstLock.sql).toBe('select pg_advisory_xact_lock($1::bigint)')
    expect(firstLock.params).toEqual([expect.any(Number)])
    expect(secondLock).toEqual(firstLock)
  })

  it('waits for the insert and transaction completion before resolving', async () => {
    let finishInsert!: () => void
    valuesMock.mockReturnValueOnce(new Promise<void>((resolve) => { finishInsert = resolve }))
    let settled = false
    const request = createDailyPick(PICK_DATE).then(() => { settled = true })

    await vi.waitFor(() => expect(valuesMock).toHaveBeenCalledOnce())
    expect(settled).toBe(false)
    finishInsert()
    await request
    expect(settled).toBe(true)
  })

  it.each(['transaction start', 'lock', 'read', 'insert', 'commit'])(
    'propagates a database failure during %s',
    async (stage: string) => {
      const failure = new Error(`Database failure: ${stage}`)
      if (stage === 'transaction start') {
        transactionMock.mockRejectedValueOnce(failure)
      } else if (stage === 'lock') {
        executeMock.mockRejectedValueOnce(failure)
      } else if (stage === 'read') {
        existing.limit.mockRejectedValueOnce(failure)
      } else if (stage === 'insert') {
        valuesMock.mockRejectedValueOnce(failure)
      } else {
        const tx = { execute: executeMock, select: selectMock, insert: insertMock }
        transactionMock.mockImplementationOnce(async (callback: (transaction: typeof tx) => Promise<void>) => {
          await callback(tx)
          throw failure
        })
      }

      await expect(createDailyPick(PICK_DATE)).rejects.toBe(failure)

      if (stage === 'transaction start' || stage === 'lock' || stage === 'read') {
        expect(insertMock).not.toHaveBeenCalled()
      }
      if (stage === 'transaction start' || stage === 'lock') {
        expect(selectMock).not.toHaveBeenCalled()
      }
    },
  )
})
