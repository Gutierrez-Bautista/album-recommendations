import {
  pgTable,
  text, uuid,
  smallint,
  timestamp,

  primaryKey,
  check,
  index
} from 'drizzle-orm/pg-core'

import { albums } from './catalog'
import { sql } from 'drizzle-orm'

// import user from BetterAuth pending...

export const userAlbums = pgTable(
  'user_albums',
  {
    userId: text('user_id')
      .notNull(),
    // .references(() => user.id, { onDelete: 'cascade' }),

    albumId: uuid('album_id').notNull().references(() => albums.id, { onDelete: 'cascade' }),

    priority: smallint('priority').notNull().default(0),

    notes: text('notes'),

    rating: smallint('rating'),

    addedAt: timestamp('added_at', {
      mode: 'date',
      withTimezone: true
    })
      .notNull()
      .defaultNow(),

    listenedAt: timestamp('listened_at', {
      mode: 'date',
      withTimezone: true
    }),

    updatedAt: timestamp('updated_at', {
      mode: 'date',
      withTimezone: true
    })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.albumId]
    }),

    index('user_albums_album_id_idx').on(table.albumId),

    check(
      'user_albums_priority_non_negative',
      sql`${table.priority} >= 0`,
    ),

    check(
      'user_albums_rating_range',
      sql`${table.rating} IS NULL OR (${table.rating} >= 1 AND ${table.rating} <= 5)`,
    ),
  ]
)