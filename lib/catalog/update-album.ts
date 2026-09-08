import 'server-only'

import { releaseKindEnum, albums, albumTags, tags } from '@/src/db/schema'
import { AlbumNotFoundError, TagsNotFoundError } from './errors'
import db from '@/src/db'
import { eq, inArray } from 'drizzle-orm'

type ReleaseKind = typeof releaseKindEnum.enumValues[number]

type UpdateAlbumInput = {
  albumId: string
  releaseKind: ReleaseKind
  tagIds: string[]
}

export async function updateAlbum({
  albumId,
  releaseKind,
  tagIds,
}: UpdateAlbumInput) {
  const uniqueTagIds = [...new Set(tagIds)]

  return db.transaction(async tx => {
    const [album] = await tx
      .update(albums)
      .set({ releaseKind })
      .where(eq(albums.id, albumId))
      .returning()

    if (!album) {
      throw new AlbumNotFoundError(albumId)
    }

    if (uniqueTagIds.length > 0) {
      const persistedTags = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.id, uniqueTagIds))

      const persistedTagIds = new Set(
        persistedTags.map((tag) => tag.id),
      )

      const missingTagIds = uniqueTagIds.filter(
        (tagId) => !persistedTagIds.has(tagId),
      )

      if (missingTagIds.length > 0) {
        throw new TagsNotFoundError(missingTagIds)
      }
    }

    await tx.delete(albumTags).where(eq(albumTags.albumId, albumId))

    if (uniqueTagIds.length > 0) {
      await tx.insert(albumTags).values(
        uniqueTagIds.map((tagId) => ({
          albumId,
          tagId,
          source: 'manual',
        })),
      )
    }

    return album
  })
}