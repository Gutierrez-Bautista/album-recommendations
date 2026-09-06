export const SPOTIFY_ALBUM_ID = '1xhO0GSoezdPJcSuNe1ySv'

export const spotifyAlbumFixture: SpotifyApi.SingleAlbumResponse = {
  album_type: 'album',
  artists: [
    {
      external_urls: {
        spotify: 'https://open.spotify.com/artist/artist-one',
      },
      href: 'https://api.spotify.com/v1/artists/artist-one',
      id: 'artist-one',
      name: 'Artist One',
      type: 'artist',
      uri: 'spotify:artist:artist-one',
    },
    {
      external_urls: {
        spotify: 'https://open.spotify.com/artist/artist-two',
      },
      href: 'https://api.spotify.com/v1/artists/artist-two',
      id: 'artist-two',
      name: 'Artist Two',
      type: 'artist',
      uri: 'spotify:artist:artist-two',
    },
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
  total_tracks: 10,
  tracks: {
    href: `https://api.spotify.com/v1/albums/${SPOTIFY_ALBUM_ID}/tracks`,
    items: [],
    limit: 50,
    next: null,
    offset: 0,
    previous: null,
    total: 10,
  },
  type: 'album',
  uri: `spotify:album:${SPOTIFY_ALBUM_ID}`,
}
