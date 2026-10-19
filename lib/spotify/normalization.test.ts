import { describe, expect, it } from 'vitest'

import {
  SPOTIFY_ALBUM_ID,
  spotifyAlbumFixture,
  spotifyAlbumTracksFixture,
} from '@/tests/fixtures/spotify-album'
import { parseSpotifyAlbumData } from './normalization'

describe('parseSpotifyAlbumData', () => {
  it('normalizes the Spotify album response', () => {
    expect(
      parseSpotifyAlbumData(
        spotifyAlbumFixture,
        spotifyAlbumTracksFixture,
      ),
    ).toEqual({
      spotifyId: SPOTIFY_ALBUM_ID,
      name: 'Example Album',
      spotifyAlbumType: 'album',
      releaseDateRaw: '2026-09-05',
      releaseDatePrecision: 'day',
      releaseYear: 2026,
      totalTracks: 2,
      durationMs: 420_000,
      hasSpotifyMarkedExplicitTracks: true,
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

    expect(
      parseSpotifyAlbumData(
        albumWithoutImages,
        spotifyAlbumTracksFixture,
      ).coverImageUrl,
    ).toBeNull()
  })

  it('returns false when Spotify marks no tracks as explicit', () => {
    const tracks = spotifyAlbumTracksFixture.map((track) => ({
      ...track,
      explicit: false,
    }))

    expect(
      parseSpotifyAlbumData(
        spotifyAlbumFixture,
        tracks,
      ).hasSpotifyMarkedExplicitTracks,
    ).toBe(false)
  })
})