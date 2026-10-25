import { AlbumNotFoundError, CatalogAlbumHasNoArtistsError } from '@/lib/catalog/errors'
import { validatePickDate } from '@/lib/daily-pick/dates'
import { InvalidPickDateError } from '@/lib/daily-pick/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' }
const READ_ERROR_TYPES = [
  [AlbumNotFoundError, 'AlbumNotFoundError'],
  [CatalogAlbumHasNoArtistsError, 'CatalogAlbumHasNoArtistsError'],
  [RangeError, 'RangeError'],
  [TypeError, 'TypeError'],
] as const

export async function GET(request: Request) {
  let stage = 'validation'
  try {
    const pickDate = new URL(request.url).searchParams.get('date') ?? ''
    validatePickDate(pickDate)

    // Validate before initializing the database, and catch initialization failures too.
    stage = 'initialization'
    const { getDailyPickByDate } = await import('@/lib/daily-pick/queries')
    stage = 'query'
    const pick = await getDailyPickByDate(pickDate)

    stage = 'response'
    if (pick === null) {
      return Response.json(
        { error: 'Daily pick not found' },
        { status: 404, headers: RESPONSE_HEADERS },
      )
    }

    return Response.json(pick, { headers: RESPONSE_HEADERS })
  } catch (error) {
    if (error instanceof InvalidPickDateError) {
      return Response.json(
        { error: 'Invalid date' },
        { status: 400, headers: RESPONSE_HEADERS },
      )
    }

    // Only fixed stages and trusted class labels are logged; error data may contain secrets.
    const errorType = READ_ERROR_TYPES.find(([ErrorType]) => error instanceof ErrorType)?.[1]
      ?? 'UnexpectedError'
    console.error('Daily pick read failed', { stage, errorType })

    return Response.json(
      { error: 'Unable to load daily pick' },
      { status: 500, headers: RESPONSE_HEADERS },
    )
  }
}
