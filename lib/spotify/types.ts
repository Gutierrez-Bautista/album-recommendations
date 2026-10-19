export type SpotifyAlbumUri = `spotify:album:${string}`
export type SpotifyAlbumUrl = `https://open.spotify.com/album/${string}`

export type SpotifyArtistUrl = `https://open.spotify.com/artist/${string}`
export type SpotifyArtistUri = `spotify:artist:${string}`

export interface SpotifyAlbumMetadata {
  spotifyId: string,
  name: string,
  spotifyAlbumType: 'album' | 'single' | 'compilation',
  releaseDateRaw: string,
  releaseDatePrecision: 'year' | 'month' | 'day',
  releaseYear: number,
  totalTracks: number,
  spotifyUrl: string,
  durationMs: number,
  hasSpotifyMarkedExplicitTracks: boolean,
  coverImageUrl: string | null,
  artists: {
    spotifyId: string,
    name: string,
    spotifyUrl: string,
  }[]
}