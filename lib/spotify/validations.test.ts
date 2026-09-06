import { describe, expect, it } from 'vitest'

import { InvalidSpotifyAlbumInputError } from './errors'
import { extractSpotifyAlbumId } from './validations'

const ALBUM_ID = '1xhO0GSoezdPJcSuNe1ySv'

describe('extractSpotifyAlbumId', () => {
  it.each([
    ALBUM_ID,
    `  ${ALBUM_ID}  `,
    `https://open.spotify.com/album/${ALBUM_ID}`,
    `https://open.spotify.com/album/${ALBUM_ID}/`,
    `https://open.spotify.com/album/${ALBUM_ID}?si=share-code`,
    `https://open.spotify.com/intl-es/album/${ALBUM_ID}`,
  ])('extracts the album ID from %s', (input) => {
    expect(extractSpotifyAlbumId(input)).toBe(ALBUM_ID)
  })

  it.each([
    '',
    'not-a-spotify-id',
    '1xhO0GSoezdPJcSuNe1yS',
    `http://open.spotify.com/album/${ALBUM_ID}`,
    `https://example.com/album/${ALBUM_ID}`,
    `https://open.spotify.com/track/${ALBUM_ID}`,
    `https://open.spotify.com/album/invalid-id`,
    `https://open.spotify.com/album/${ALBUM_ID}/extra`,
  ])('rejects invalid input: %s', (input) => {
    expect(() => extractSpotifyAlbumId(input)).toThrowError(
      InvalidSpotifyAlbumInputError,
    )
  })
})
