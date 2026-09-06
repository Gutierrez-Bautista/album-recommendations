import 'server-only'
import { spotifyFetch } from './client'
import { extractSpotifyAlbumId } from './validations'
import { SpotifyNotFoundError, SpotifyRateLimitError, SpotifyServiceError } from './errors'
import { parseSpotifyAlbumData } from './normalization'
import { SpotifyAlbumMetadata } from './types'

export async function getSpotifyAlbum(input: string): Promise<SpotifyAlbumMetadata> {
  const albumId = extractSpotifyAlbumId(input)

  const res = await spotifyFetch(`/albums/${encodeURIComponent(albumId)}?market=AR`)

  if (res.status === 404) {
    throw new SpotifyNotFoundError('album', albumId)
  }

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get('retry-after')
    const retryAfterSeconds = retryAfterHeader
      ? Number(retryAfterHeader)
      : undefined

    throw new SpotifyRateLimitError(
      Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds
        : undefined,
    )
  }

  if (!res.ok) {
    throw new SpotifyServiceError(res.status)
  }

  const albumData = (await res.json()) as SpotifyApi.SingleAlbumResponse
  return parseSpotifyAlbumData(albumData)
}