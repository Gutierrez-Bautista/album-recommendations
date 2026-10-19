import type { SpotifyAlbumUri, SpotifyAlbumUrl } from "./types"

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