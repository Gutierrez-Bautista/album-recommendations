import { describe, expect, it } from 'vitest'

import {
  SPOTIFY_ALBUM_ID,
  spotifyAlbumFixture,
} from '@/tests/fixtures/spotify-album'
import { parseSpotifyAlbumData } from './normalization'

describe('parseSpotifyAlbumData', () => {
  it('normalizes the Spotify album response', () => {
    expect(parseSpotifyAlbumData(spotifyAlbumFixture)).toEqual({
      spotifyId: SPOTIFY_ALBUM_ID,
      name: 'Example Album',
      spotifyAlbumType: 'album',
      releaseDateRaw: '2026-09-05',
      releaseDatePrecision: 'day',
      totalTracks: 10,
      spotifyUrl: `https://open.spotify.com/album/${SPOTIFY_ALBUM_ID}`,
      coverImageUrl: 'https://i.scdn.co/image/large-cover',
      artists: [
        {
          spotifyId: 'artist-one',
          name: 'Artist One',
          spotifyUrl: 'https://open.spotify.com/artist/artist-one',
        },
        {
          spotifyId: 'artist-two',
          name: 'Artist Two',
          spotifyUrl: 'https://open.spotify.com/artist/artist-two',
        },
      ],
    })
  })

  it('returns null when Spotify does not provide a cover image', () => {
    const albumWithoutImages: SpotifyApi.SingleAlbumResponse = {
      ...spotifyAlbumFixture,
      images: [],
    }

    expect(parseSpotifyAlbumData(albumWithoutImages).coverImageUrl).toBeNull()
  })
})
