import {
  pgTable,
  text, uuid,
  timestamp,
  date,

  unique,
} from 'drizzle-orm/pg-core'

import { albums } from './catalog'

// import user from BetterAuth pending...

export const dailyPicks = pgTable(
  'daily_picks',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: text('user_id')
      .notNull(),
    // .references(() => user.id, { onDelete: 'cascade' }),

    albumId: uuid('album_id').notNull().references(() => albums.id, { onDelete: 'restrict' }),

    localDate: date('local_date', {
      mode: 'string',
    })
      .notNull(),

    selectedAt: timestamp('selected_at', {
      mode: 'date',
      withTimezone: true
    })
      .notNull()
      .defaultNow(),

    savedToSpotifyAt: timestamp('saved_to_spotify_at', {
      mode: 'date',
      withTimezone: true
    }),

    saveError: text('save_error'),
  },
  (table) => [
    unique('daily_picks_user_id_local_date_unique').on(table.userId, table.localDate),

    unique('daily_picks_user_id_album_unique').on(table.userId, table.albumId),
  ]
)