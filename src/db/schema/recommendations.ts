import {
  pgTable,
  integer, uuid,
  timestamp,
  date,

  unique,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { albums } from './catalog'

export const dailyPicks = pgTable(
  'daily_picks',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'restrict' }),

    pickDate: date('pick_date', {
      mode: 'string',
    })
      .notNull(),

    cycle: integer('cycle')
      .notNull()
      .default(1),

    selectedAt: timestamp('selected_at', {
      mode: 'date',
      withTimezone: true
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('daily_picks_pick_date_unique').on(table.pickDate),

    unique('daily_picks_cycle_album_unique').on(
      table.cycle,
      table.albumId,
    ),

    check(
      'daily_picks_cycle_positive',
      sql`${table.cycle} >= 1`,
    ),
  ]
)