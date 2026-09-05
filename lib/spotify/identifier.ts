export type SpotifyAlbumUri = `spotify:album:${string}`

export type SpotifyAlbumUrl =
  `https://open.spotify.com/album/${string}`

export function getSpotifyAlbumUri(
  spotifyId: string,
): SpotifyAlbumUri {
  return `spotify:album:${spotifyId}`
}

export function getSpotifyAlbumUrl(
  spotifyId: string,
): SpotifyAlbumUrl {
  return `https://open.spotify.com/album/${spotifyId}`
}