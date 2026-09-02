// user_settings table
import {
  pgTable,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core'

import { users } from './auth'

export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .notNull()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  timeZone: text('timezone').notNull().default('America/Argentina/Buenos_Aires'),
  includeSpotifyMarkedExplicitContent: boolean('include_spotify_marked_explicit_content').notNull().default(false),
  autoSaveToSpotify: boolean('auto_save_to_spotify').notNull().default(false),
  createdAt: timestamp('created_at', {
    mode: 'date',
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', {
    mode: 'date',
    withTimezone: true,
  })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})