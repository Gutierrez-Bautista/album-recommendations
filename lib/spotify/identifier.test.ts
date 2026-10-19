import { describe, expect, it } from 'vitest'

import { getSpotifyAlbumUri, getSpotifyAlbumUrl } from './identifier'

const ALBUM_ID = '1xhO0GSoezdPJcSuNe1ySv'

describe('Spotify album identifiers', () => {
  it('builds an album URI', () => {
    expect(getSpotifyAlbumUri(ALBUM_ID)).toBe(
      `spotify:album:${ALBUM_ID}`,
    )
  })

  it('builds an album URL', () => {
    expect(getSpotifyAlbumUrl(ALBUM_ID)).toBe(
      `https://open.spotify.com/album/${ALBUM_ID}`,
    )
  })
})
