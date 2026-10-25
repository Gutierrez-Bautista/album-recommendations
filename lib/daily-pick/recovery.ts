import 'server-only'

import { asc } from 'drizzle-orm'

import db from '@/src/db'
import { dailyPicks } from '@/src/db/schema/recommendations'
import { nextPickDate, validatePickDate } from './dates'
import {
  DailyPickTargetBeforeStartDateError,
  IncompatibleDailyPickHistoryError,
  InvalidDailyPickStartDateError,
  InvalidPickDateError,
  MissingDailyPickStartDateError,
  OutOfOrderDailyPickError,
} from './errors'
import { createDailyPick } from './selector'

const MAX_CREATED_PICKS = 10

export interface DailyPickRecoveryResult {
  generatedCount: number
  completed: boolean
}

async function validateAndGetLatestPickDate(startDate: string): Promise<string | null> {
  // One ordered snapshot includes history beyond the requested target as well.
  const history = await db
    .select({ pickDate: dailyPicks.pickDate })
    .from(dailyPicks)
    .orderBy(asc(dailyPicks.pickDate))

  if (history.length === 0) {
    return null
  }

  const earliestPickDate = history[0].pickDate
  const latestPickDate = history[history.length - 1].pickDate

  if (earliestPickDate < startDate) {
    throw new IncompatibleDailyPickHistoryError(startDate, earliestPickDate)
  }

  let expectedDate = startDate
  for (const { pickDate } of history) {
    if (pickDate !== expectedDate) {
      throw new OutOfOrderDailyPickError(expectedDate, latestPickDate)
    }

    if (pickDate !== latestPickDate) {
      expectedDate = nextPickDate(pickDate)
    }
  }

  return latestPickDate
}

export async function generateDailyPicksThrough(
  targetDate: string,
): Promise<DailyPickRecoveryResult> {
  const startDate = process.env.DAILY_PICK_START_DATE
  if (!startDate) {
    throw new MissingDailyPickStartDateError()
  }

  try {
    validatePickDate(startDate)
  } catch (error) {
    if (error instanceof InvalidPickDateError) {
      throw new InvalidDailyPickStartDateError(startDate)
    }
    throw error
  }

  validatePickDate(targetDate)
  if (targetDate < startDate) {
    throw new DailyPickTargetBeforeStartDateError(targetDate, startDate)
  }

  const latestPickDate = await validateAndGetLatestPickDate(startDate)
  if (latestPickDate !== null && latestPickDate >= targetDate) {
    return { generatedCount: 0, completed: true }
  }

  let pendingDate = latestPickDate === null ? startDate : nextPickDate(latestPickDate)
  let generatedCount = 0

  while (generatedCount < MAX_CREATED_PICKS) {
    const result = await createDailyPick(pendingDate)
    if (result === 'created') {
      generatedCount++
    }

    // Avoid advancing past the target, including the maximum date 9999-12-31.
    if (pendingDate === targetDate) {
      break
    }
    pendingDate = nextPickDate(pendingDate)
  }

  // Other recoveries may have committed more dates while this invocation ran.
  const persistedLatestPickDate = await validateAndGetLatestPickDate(startDate)
  return {
    generatedCount,
    completed: persistedLatestPickDate !== null && persistedLatestPickDate >= targetDate,
  }
}
