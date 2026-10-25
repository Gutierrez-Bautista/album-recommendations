import 'server-only'

import { desc, eq, lt } from 'drizzle-orm'

import { AlbumNotFoundError } from '@/lib/catalog/errors'
import { getAlbumById } from '@/lib/catalog/queries/albums'
import db from '@/src/db'
import { albums } from '@/src/db/schema/catalog'
import { dailyPicks } from '@/src/db/schema/recommendations'
import { validatePickDate } from './dates'

export interface DailyPickDetails {
  pickDate: string

  album: {
    id: string
    spotifyId: string

    name: string
    coverUrl: string | null

    spotifyAlbumType: 'album' | 'single' | 'compilation'
    releaseKind: 'album' | 'single' | 'ep' | 'compilation' | null

    releaseDateRaw: string
    totalTracks: number
    durationMs: number | null
    hasSpotifyMarkedExplicitTracks: boolean

    artists: {
      id: string
      name: string
    }[]

    tagCategories: {
      id: string
      name: string
      description: string | null

      tags: {
        id: string
        name: string
      }[]
    }[]
  }
}

export interface DailyPickHistoryEntry {
  pickDate: string
  albumName: string
}

export interface DailyPickHistoryResult {
  entries: DailyPickHistoryEntry[]
  hasMore: boolean
}

export async function getDailyPickByDate(pickDate: string): Promise<DailyPickDetails | null> {
  validatePickDate(pickDate)

  const [pick] = await db
    .select({ pickDate: dailyPicks.pickDate, albumId: dailyPicks.albumId })
    .from(dailyPicks)
    .where(eq(dailyPicks.pickDate, pickDate))
    .limit(1)

  if (!pick) {
    return null
  }

  // Catalog reads include archived albums and reject missing albums or artists.
  const album = await getAlbumById(pick.albumId)
  const categories = new Map<string, DailyPickDetails['album']['tagCategories'][number]>()

  // The catalog query orders categories and tags by name, then ID for ties.
  for (const tag of album.tags) {
    let category = categories.get(tag.categoryId)
    if (!category) {
      category = {
        id: tag.categoryId,
        name: tag.category,
        description: tag.categoryDescription,
        tags: [],
      }
      categories.set(tag.categoryId, category)
    }
    category.tags.push({ id: tag.id, name: tag.name })
  }

  return {
    pickDate: pick.pickDate,
    album: {
      id: album.id,
      spotifyId: album.spotifyId,
      name: album.name,
      coverUrl: album.coverUrl,
      spotifyAlbumType: album.spotifyAlbumType,
      releaseKind: album.releaseKind,
      releaseDateRaw: album.releaseDateRaw,
      totalTracks: album.totalTracks,
      durationMs: album.durationMs,
      hasSpotifyMarkedExplicitTracks: album.hasSpotifyMarkedExplicitTracks,
      artists: album.artists,
      tagCategories: [...categories.values()],
    },
  }
}

export async function getDailyPickHistory(
  quantity: number,
  offset: number,
  beforeDate: string,
): Promise<DailyPickHistoryResult> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    throw new RangeError('quantity must be an integer between 1 and 100')
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new RangeError('offset must be a non-negative safe integer')
  }
  validatePickDate(beforeDate)

  const rows = await db
    .select({
      pickDate: dailyPicks.pickDate,
      albumId: dailyPicks.albumId,
      albumName: albums.name,
    })
    .from(dailyPicks)
    .leftJoin(albums, eq(dailyPicks.albumId, albums.id))
    .where(lt(dailyPicks.pickDate, beforeDate))
    .orderBy(desc(dailyPicks.pickDate))
    .limit(quantity + 1)
    .offset(offset)

  const entries = rows.map((row): DailyPickHistoryEntry => {
    // Do not silently hide a pick whose referenced album is missing.
    if (row.albumName === null) {
      throw new AlbumNotFoundError(row.albumId)
    }
    return { pickDate: row.pickDate, albumName: row.albumName }
  })

  return {
    entries: entries.slice(0, quantity),
    hasMore: entries.length > quantity,
  }
}
