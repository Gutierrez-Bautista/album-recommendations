export const SPOTIFY_ALBUM_ID = '1xhO0GSoezdPJcSuNe1ySv'

const spotifyArtistOneFixture: SpotifyApi.ArtistObjectSimplified = {
  external_urls: {
    spotify: 'https://open.spotify.com/artist/artist-one',
  },
  href: 'https://api.spotify.com/v1/artists/artist-one',
  id: 'artist-one',
  name: 'Artist One',
  type: 'artist',
  uri: 'spotify:artist:artist-one',
}

const spotifyArtistTwoFixture: SpotifyApi.ArtistObjectSimplified = {
  external_urls: {
    spotify: 'https://open.spotify.com/artist/artist-two',
  },
  href: 'https://api.spotify.com/v1/artists/artist-two',
  id: 'artist-two',
  name: 'Artist Two',
  type: 'artist',
  uri: 'spotify:artist:artist-two',
}

type SpotifyTrackFixtureOptions = {
  id: string
  name?: string
  durationMs: number
  explicit?: boolean
  trackNumber: number
}

export function createSpotifyTrackFixture({
  id,
  name = id,
  durationMs,
  explicit = false,
  trackNumber,
}: SpotifyTrackFixtureOptions): SpotifyApi.TrackObjectSimplified {
  return {
    artists: [spotifyArtistOneFixture],
    available_markets: ['AR'],
    disc_number: 1,
    duration_ms: durationMs,
    explicit,
    external_urls: {
      spotify: `https://open.spotify.com/track/${id}`,
    },
    href: `https://api.spotify.com/v1/tracks/${id}`,
    id,
    is_playable: true,
    name,
    preview_url: null,
    track_number: trackNumber,
    type: 'track',
    uri: `spotify:track:${id}`,
  }
}

export const spotifyAlbumTracksFixture = [
  createSpotifyTrackFixture({
    id: 'track-one',
    name: 'Track One',
    durationMs: 180_000,
    trackNumber: 1,
  }),
  createSpotifyTrackFixture({
    id: 'track-two',
    name: 'Track Two',
    durationMs: 240_000,
    explicit: true,
    trackNumber: 2,
  }),
]

export const spotifyAlbumFixture: SpotifyApi.SingleAlbumResponse = {
  album_type: 'album',
  artists: [
    spotifyArtistOneFixture,
    spotifyArtistTwoFixture,
  ],
  available_markets: ['AR'],
  copyrights: [],
  external_ids: {
    upc: '123456789012',
  },
  external_urls: {
    spotify: `https://open.spotify.com/album/${SPOTIFY_ALBUM_ID}`,
  },
  genres: [],
  href: `https://api.spotify.com/v1/albums/${SPOTIFY_ALBUM_ID}`,
  id: SPOTIFY_ALBUM_ID,
  images: [
    {
      url: 'https://i.scdn.co/image/large-cover',
      height: 640,
      width: 640,
    },
    {
      url: 'https://i.scdn.co/image/medium-cover',
      height: 300,
      width: 300,
    },
    {
      url: 'https://i.scdn.co/image/small-cover',
      height: 64,
      width: 64,
    },
  ],
  label: 'Example Records',
  name: 'Example Album',
  popularity: 80,
  release_date: '2026-09-05',
  release_date_precision: 'day',
  total_tracks: spotifyAlbumTracksFixture.length,
  tracks: {
    href: `https://api.spotify.com/v1/albums/${SPOTIFY_ALBUM_ID}/tracks`,
    items: spotifyAlbumTracksFixture,
    limit: 50,
    next: null,
    offset: 0,
    previous: null,
    total: spotifyAlbumTracksFixture.length,
  },
  type: 'album',
  uri: `spotify:album:${SPOTIFY_ALBUM_ID}`,
}