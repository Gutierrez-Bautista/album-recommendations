import 'server-only'
import { spotifyFetch } from './client'
import { extractSpotifyAlbumId } from './validations'
import { SpotifyNotFoundError, SpotifyRateLimitError, SpotifyServiceError } from './errors'
import { parseSpotifyAlbumData } from './normalization'
import type { SpotifyAlbumMetadata } from './types'

const validateResponseStatus = (
  res: Response,
  resource: string,
  resourceId: string
): void => {
  if (res.status === 404) {
    throw new SpotifyNotFoundError(resource, resourceId)
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
}

export async function getSpotifyAlbum(input: string): Promise<SpotifyAlbumMetadata> {
  const albumId = extractSpotifyAlbumId(input)

  const resAlbums = await spotifyFetch(`/albums/${encodeURIComponent(albumId)}?market=AR`)

  validateResponseStatus(resAlbums, 'album', albumId)

  const albumData = (await resAlbums.json()) as SpotifyApi.SingleAlbumResponse

  const tracks: SpotifyApi.TrackObjectSimplified[] = [...albumData.tracks.items]

  const {
    limit,
    offset,
    total,
  } = albumData.tracks

  for (
    let nextOffset = offset + limit;
    nextOffset < total;
    nextOffset += limit
  ) {
    const resTracks = await spotifyFetch(
      `/albums/${encodeURIComponent(albumId)}/tracks`
      + `?market=AR&limit=${limit}&offset=${nextOffset}`,
    )

    validateResponseStatus(
      resTracks,
      'album tracks',
      albumId,
    )

    const tracksData =
      (await resTracks.json()) as SpotifyApi.AlbumTracksResponse

    tracks.push(...tracksData.items)
  }

  return parseSpotifyAlbumData(albumData, tracks)
}