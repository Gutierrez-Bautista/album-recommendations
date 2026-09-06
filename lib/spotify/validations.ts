import { InvalidSpotifyAlbumInputError } from './errors'

const SPOTIFY_ALBUM_ID_PATTERN = /^[a-zA-Z0-9]{22}$/

export function extractSpotifyAlbumId(input: string): string {
  const value = input.trim()

  if (SPOTIFY_ALBUM_ID_PATTERN.test(value)) {
    return value
  }

  try {
    const url = new URL(value)

    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'open.spotify.com'
    ) {
      throw new InvalidSpotifyAlbumInputError(input)
    }

    const segments = url.pathname.split('/').filter(Boolean)

    if (segments[0]?.startsWith('intl-')) {
      segments.shift()
    }

    const [resource, albumId, ...remainingSegments] = segments

    if (
      resource !== 'album' ||
      remainingSegments.length > 0 ||
      !albumId ||
      !SPOTIFY_ALBUM_ID_PATTERN.test(albumId)
    ) {
      throw new InvalidSpotifyAlbumInputError(input)
    }

    return albumId
  } catch (error) {
    if (error instanceof InvalidSpotifyAlbumInputError) {
      throw error
    }

    throw new InvalidSpotifyAlbumInputError(input)
  }
}

// https://open.spotify.com/album/1xhO0GSoezdPJcSuNe1ySv