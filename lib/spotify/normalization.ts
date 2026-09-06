import type { SpotifyAlbumMetadata } from "./types";

export function parseSpotifyAlbumData(
  album: SpotifyApi.SingleAlbumResponse,
  tracks: SpotifyApi.TrackObjectSimplified[],
): SpotifyAlbumMetadata {
  let explicit = false
  let duration = 0

  tracks.forEach((track) => {
    duration += track.duration_ms
    explicit = explicit || track.explicit
  })

  return {
    spotifyId: album.id,
    name: album.name,
    spotifyAlbumType: album.album_type,
    releaseDateRaw: album.release_date,
    releaseDatePrecision: album.release_date_precision,
    releaseYear: Number(album.release_date.slice(0, 4)),
    durationMs: duration,
    hasSpotifyMarkedExplicitTracks: explicit,
    totalTracks: album.total_tracks,
    spotifyUrl: album.external_urls.spotify,
    coverImageUrl: album.images[0]?.url ?? null,
    artists: album.artists.map((artist) => ({
      spotifyId: artist.id,
      name: artist.name,
      spotifyUrl: artist.external_urls.spotify,
    })),
  }
}