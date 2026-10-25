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

function parseIntegerParameter(value: string | null): number | null {
  if (value === null || value.length === 0 || /[^0-9]/.test(value)) {
    return null
  }

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export async function GET(request: Request) {
  let stage = 'validation'
  try {
    const searchParams = new URL(request.url).searchParams
    const quantity = parseIntegerParameter(searchParams.get('quantity'))
    const offset = parseIntegerParameter(searchParams.get('offset'))
    const beforeDate = searchParams.get('beforeDate')

    if (
      quantity === null || quantity < 1 || quantity > 100 ||
      offset === null || offset < 0 || beforeDate === null
    ) {
      return Response.json(
        { error: 'Invalid history parameters' },
        { status: 400, headers: RESPONSE_HEADERS },
      )
    }

    validatePickDate(beforeDate)

    // Validate input before initializing the database, and catch initialization failures too.
    stage = 'initialization'
    const { getDailyPickHistory } = await import('@/lib/daily-pick/queries')
    stage = 'query'
    const history = await getDailyPickHistory(quantity, offset, beforeDate)

    stage = 'response'
    return Response.json(history, { headers: RESPONSE_HEADERS })
  } catch (error) {
    if (error instanceof InvalidPickDateError) {
      return Response.json(
        { error: 'Invalid history parameters' },
        { status: 400, headers: RESPONSE_HEADERS },
      )
    }

    // Only fixed stages and trusted class labels are logged; error data may contain secrets.
    const errorType = READ_ERROR_TYPES.find(([ErrorType]) => error instanceof ErrorType)?.[1]
      ?? 'UnexpectedError'
    console.error('Daily pick history read failed', { stage, errorType })

    return Response.json(
      { error: 'Unable to load daily pick history' },
      { status: 500, headers: RESPONSE_HEADERS },
    )
  }
}
