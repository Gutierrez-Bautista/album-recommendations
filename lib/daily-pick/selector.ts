import 'server-only'

import { and, asc, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'

import db from '@/src/db'
import { albums } from '@/src/db/schema/catalog'
import { dailyPicks } from '@/src/db/schema/recommendations'
import { InvalidPickDateError, OutOfOrderDailyPickError } from './errors'
import { selectDailyPick } from './selection'

// Stable application-wide key shared by generators for every date ("DAILY").
const DAILY_PICK_LOCK_KEY = 0x4441494c59

function validatePickDate(pickDate: string): void {
  if (pickDate.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(pickDate)) {
    throw new InvalidPickDateError(pickDate)
  }

  const date = new Date(`${pickDate}T00:00:00.000Z`)

  // PostgreSQL has no year zero; the UTC round trip rejects normalized dates.
  if (
    pickDate.startsWith('0000') ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== pickDate
  ) {
    throw new InvalidPickDateError(pickDate)
  }
}

export async function createDailyPick(pickDate: string): Promise<void> {
  validatePickDate(pickDate)

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${DAILY_PICK_LOCK_KEY}::bigint)`)

    const [existingPick] = await tx
      .select({ pickDate: dailyPicks.pickDate })
      .from(dailyPicks)
      .where(eq(dailyPicks.pickDate, pickDate))
      .limit(1)

    if (existingPick) {
      return
    }

    const [latestPick] = await tx
      .select({ pickDate: dailyPicks.pickDate, cycle: dailyPicks.cycle })
      .from(dailyPicks)
      .orderBy(desc(dailyPicks.pickDate))
      .limit(1)

    if (latestPick && latestPick.pickDate > pickDate) {
      throw new OutOfOrderDailyPickError(pickDate, latestPick.pickDate)
    }

    const activeAlbums = await tx
      .select({ id: albums.id })
      .from(albums)
      .where(isNull(albums.archivedAt))

    const selectedInCycle = latestPick
      ? await tx
        .select({ albumId: dailyPicks.albumId })
        .from(dailyPicks)
        .where(eq(dailyPicks.cycle, latestPick.cycle))
      : []

    const recentPicks = await tx
      .select({ albumId: dailyPicks.albumId })
      .from(dailyPicks)
      .where(and(
        gte(dailyPicks.pickDate, sql`${pickDate}::date - 5`),
        lt(dailyPicks.pickDate, pickDate),
      ))
      .orderBy(asc(dailyPicks.pickDate))

    const selection = selectDailyPick({
      activeAlbumIds: activeAlbums.map((album) => album.id),
      latestCycle: latestPick?.cycle ?? null,
      selectedAlbumIdsInLatestCycle: selectedInCycle.map((pick) => pick.albumId),
      recentAlbumIdsOldestFirst: recentPicks.map((pick) => pick.albumId),
    })

    await tx.insert(dailyPicks).values({ ...selection, pickDate })
  }, {
    // Reads after waiting for the lock must see the preceding generator's commit.
    isolationLevel: 'read committed',
  })
}
