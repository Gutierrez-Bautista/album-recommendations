// user_settings table
import {
  pgTable,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core'

export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .notNull()
    .primaryKey(),
  // .references(() => user.id, { onDelete: 'cascade' }),
  timeZone: text('timezone').notNull().default('America/Argentina/Buenos_Aires'),
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