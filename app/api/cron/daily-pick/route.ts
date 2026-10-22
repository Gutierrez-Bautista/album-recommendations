import { timingSafeEqual } from 'node:crypto'

import { nextPickDate } from '@/lib/daily-pick/dates'
import {
  DailyPickTargetBeforeStartDateError,
  EmptyActiveCatalogError,
  IncompatibleDailyPickHistoryError,
  InvalidDailyPickStartDateError,
  InvalidPickDateError,
  MissingDailyPickStartDateError,
  OutOfOrderDailyPickError,
} from '@/lib/daily-pick/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' }
const DAILY_PICK_ERROR_TYPES = [
  DailyPickTargetBeforeStartDateError,
  EmptyActiveCatalogError,
  IncompatibleDailyPickHistoryError,
  InvalidDailyPickStartDateError,
  InvalidPickDateError,
  MissingDailyPickStartDateError,
  OutOfOrderDailyPickError,
]

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return Response.json(
      { success: false, error: 'Daily pick service is unavailable' },
      { status: 500, headers: RESPONSE_HEADERS },
    )
  }

  const authorization = Buffer.from(request.headers.get('authorization') ?? '')
  const expectedAuthorization = Buffer.from(`Bearer ${cronSecret}`)
  if (
    authorization.length !== expectedAuthorization.length ||
    !timingSafeEqual(authorization, expectedAuthorization)
  ) {
    return Response.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: RESPONSE_HEADERS },
    )
  }

  const targetDate = nextPickDate(new Date().toISOString().slice(0, 10))

  try {
    // Defer database initialization until authenticated, and catch initialization failures too.
    const { generateDailyPicksThrough } = await import('@/lib/daily-pick/recovery')
    const { generatedCount, completed } = await generateDailyPicksThrough(targetDate)
    if (!completed) {
      console.warn('Daily pick cron incomplete', { targetDate, generatedCount })
    }

    return Response.json(
      { success: completed, targetDate, generatedCount, completed },
      { status: completed ? 200 : 503, headers: RESPONSE_HEADERS },
    )
  } catch (error) {
    // Only trusted class labels are logged; error messages and properties may contain secrets.
    const errorType = DAILY_PICK_ERROR_TYPES.find((ErrorType) => error instanceof ErrorType)?.name
      ?? 'UnexpectedError'
    console.error('Daily pick cron failed', { targetDate, errorType })

    return Response.json(
      { success: false, error: 'Daily pick generation failed' },
      { status: 500, headers: RESPONSE_HEADERS },
    )
  }
}
