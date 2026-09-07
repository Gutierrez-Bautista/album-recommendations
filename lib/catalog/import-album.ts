import 'server-only'

import { albums, artists, albumArtists } from "@/src/db/schema/catalog"
import { getSpotifyAlbum } from "../spotify/albums"
import db from "@/src/db"
import { eq } from "drizzle-orm"
import { AlbumHasNoArtistsError } from './errors'

type AlbumInsert = typeof albums.$inferInsert
type ReleaseKind = NonNullable<AlbumInsert['releaseKind']>

type ArtistInsert = typeof artists.$inferInsert
type AlbumArtistInsert = typeof albumArtists.$inferInsert

type PersistedArtist = {
  id: string,
  spotifyId: string
}

type ImportSpotifyAlbumInput = {
  spotifyInput: string
  releaseKind: ReleaseKind
}

export async function importSpotifyAlbum({
  spotifyInput,
  releaseKind,
}: ImportSpotifyAlbumInput) {
  const metadata = await getSpotifyAlbum(spotifyInput)
  const fetchedAt = new Date()

  const mappedAlbumData = {
    name: metadata.name,
    spotifyAlbumType: metadata.spotifyAlbumType,
    releaseKind,
    releaseDateRaw: metadata.releaseDateRaw,
    releaseDatePrecision: metadata.releaseDatePrecision,
    releaseYear: metadata.releaseYear,
    totalTracks: metadata.totalTracks,
    durationMs: metadata.durationMs,
    hasSpotifyMarkedExplicitTracks:
      metadata.hasSpotifyMarkedExplicitTracks,
    coverUrl: metadata.coverImageUrl,
    spotifyMetadataFetchedAt: fetchedAt,
    updatedAt: fetchedAt,
  } satisfies Omit<
    AlbumInsert,
    'id' | 'spotifyId' | 'createdAt'
  >

  const mappedArtistsData = metadata.artists.map((artist) => ({
    name: artist.name,
    spotifyId: artist.spotifyId,
    spotifyMetadataFetchedAt: fetchedAt,
    updatedAt: fetchedAt
  })) satisfies Omit<ArtistInsert, 'id' | 'createdAt'>[]

  if (mappedArtistsData.length === 0) {
    throw new AlbumHasNoArtistsError(metadata.spotifyId)
  }

  return db.transaction(async (tx) => {
    const [album] = await tx
      .insert(albums)
      .values({
        spotifyId: metadata.spotifyId,
        ...mappedAlbumData
      })
      .onConflictDoUpdate({
        target: albums.spotifyId,
        set: mappedAlbumData
      })
      .returning()

    if (!album) {
      throw new Error(
        `Failed to persist Spotify album: ${metadata.spotifyId}`,
      )
    }

    const persistedArtists: PersistedArtist[] = []

    for (const { spotifyId, ...artistData } of mappedArtistsData) {
      const [artist] = await tx
        .insert(artists)
        .values({
          spotifyId,
          ...artistData
        })
        .onConflictDoUpdate({
          target: artists.spotifyId,
          set: artistData
        })
        .returning({
          id: artists.id,
          spotifyId: artists.spotifyId
        })

      if (!artist) {
        throw new Error(`Failed to persist Spotify artist: ${spotifyId}`)
      }

      persistedArtists.push(artist)
    }

    await tx
      .delete(albumArtists)
      .where(eq(albumArtists.albumId, album.id))

    const relations = persistedArtists.map<AlbumArtistInsert>(
      (artist, position) => ({
        albumId: album.id,
        artistId: artist.id,
        position,
      }),
    )

    await tx.insert(albumArtists).values(relations)

    return album
  })
}