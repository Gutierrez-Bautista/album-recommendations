import 'server-only'

import db from '@/src/db'
import { tagCategories, tags } from '@/src/db/schema'

export async function getTagCategoriesWithTags() {
  const [categories, persistedTags] = await Promise.all([
    db
      .select({
        id: tagCategories.id,
        key: tagCategories.key,
        name: tagCategories.name,
        description: tagCategories.description,
      })
      .from(tagCategories)
      .orderBy(tagCategories.name),

    db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        parentId: tags.parentId,
        categoryId: tags.categoryId,
      })
      .from(tags)
      .orderBy(tags.name),
  ])

  return categories.map(category => ({
    ...category,
    tags: persistedTags
      .filter(tag => tag.categoryId === category.id)
      .map(tag => ({
        id: tag.id,
        slug: tag.slug,
        name: tag.name,
        parentId: tag.parentId,
      })),
  }))
}
