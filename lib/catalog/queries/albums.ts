import 'server-only'

import db from '@/src/db'
import { albums, albumTags, albumArtists, tags, artists, tagCategories } from '@/src/db/schema'
import { eq } from 'drizzle-orm'
import { AlbumNotFoundError, CatalogAlbumHasNoArtistsError } from '../errors'

export type AlbumArtist = { id: string, name: string }
export type AlbumTag = { id: string, name: string, categoryId: string, category: string }
export type Album = typeof albums.$inferSelect

export type AlbumDetails = Album & {
  artists: AlbumArtist[]
  tags: AlbumTag[]
}

export async function getAlbumById(albumId: string): Promise<AlbumDetails> {
  const [albumData] = await db
    .select()
    .from(albums)
    .where(eq(albums.id, albumId))

  if (!albumData) {
    throw new AlbumNotFoundError(albumId)
  }

  const artistsData = await db
    .select({
      id: artists.id,
      name: artists.name,
    })
    .from(artists)
    .innerJoin(albumArtists, eq(artists.id, albumArtists.artistId))
    .where(eq(albumArtists.albumId, albumId))
    .orderBy(albumArtists.position)

  if (artistsData.length === 0) {
    throw new CatalogAlbumHasNoArtistsError(albumId)
  }

  const tagsData = await db
    .select({
      id: tags.id,
      name: tags.name,
      category: tagCategories.name,
      categoryId: tags.categoryId,
    })
    .from(tags)
    .innerJoin(albumTags, eq(albumTags.tagId, tags.id))
    .innerJoin(tagCategories, eq(tags.categoryId, tagCategories.id))
    .where(eq(albumTags.albumId, albumId))
    .orderBy(tagCategories.name, tags.name)

  return {
    ...albumData,
    artists: artistsData,
    tags: tagsData
  }
}