import {
  pgTable,
  text, uuid,
  timestamp,

  primaryKey,
  foreignKey,
  index,
  unique,
} from 'drizzle-orm/pg-core'

import { albums } from './catalog'

export const tagCategories = pgTable('tag_categories', {
  id: uuid().primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
})

export const tags = pgTable(
  'tags',
  {
    id: uuid().primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => tagCategories.id, { onDelete: 'cascade' }),

    slug: text('slug').notNull(),
    name: text('name').notNull(),
    parentId: uuid('parent_id'),

    createdAt: timestamp('created_at', {
      mode: 'date',
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'tags_parent_id_fkey',
    }).onDelete('set null'),

    unique('tags_category_slug_unique').on(
      table.categoryId,
      table.slug,
    ),

    index('tags_parent_id_idx').on(table.parentId),
  ]
)

export const albumTags = pgTable(
  'album_tags',
  {
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('manual'),

    createdAt: timestamp('created_at', {
      mode: 'date',
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.albumId, table.tagId]
    }),

    index('album_tags_tag_id_idx').on(table.tagId),
  ]
)