import {
  pgTable,
  varchar,
  text, uuid,
  smallint,
  integer,
  boolean,
  timestamp,
  pgEnum,

  primaryKey,
  uniqueIndex,
  index,
  check
} from 'drizzle-orm/pg-core'

import { sql } from 'drizzle-orm'

export const spotifyAlbumTypeEnum = pgEnum('spotify_album_type', [
  'album',
  'single',
  'compilation',
])

export const releaseKindEnum = pgEnum('release_kind', [
  'album',
  'single',
  'ep',
  'compilation',
])

export const releaseDatePrecisionEnum = pgEnum(
  'release_date_precision',
  ['year', 'month', 'day'],
)

export const albums = pgTable('albums', {
  id: uuid('id').primaryKey().defaultRandom(),

  spotifyId: varchar('spotify_id', { length: 255 })
    .notNull()
    .unique(),

  spotifyUri: varchar('spotify_uri', { length: 255 })
    .notNull()
    .unique(),

  spotifyUrl: text('spotify_url').notNull(),

  name: text('name').notNull(),

  albumType: spotifyAlbumTypeEnum('spotify_album_type').notNull(),

  releaseKind: releaseKindEnum('release_kind'),

  releaseDateRaw: varchar('release_date_raw', { length: 10 }).notNull(),

  releaseDatePrecision: releaseDatePrecisionEnum('release_date_precision').notNull(),

  releaseYear: smallint('release_year').notNull(),

  totalTracks: integer('total_tracks').notNull(),

  durationMs: integer('duration_ms'),

  hasExplicitTracks: boolean('has_explicit_tracks')
    .notNull()
    .default(false),

  coverUrl: text('cover_url'),

  upc: varchar('upc', { length: 50 }),

  ean: varchar('ean', { length: 50 }),

  metadataFetchedAt: timestamp('metadata_fetched_at', {
    mode: 'date',
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

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

export const artists = pgTable('artists', {
  id: uuid('id').primaryKey().defaultRandom(),
  spotifyId: varchar('spotify_id', { length: 255 }).notNull().unique(),
  spotifyUri: varchar('spotify_uri', { length: 255 }).notNull().unique(),
  spotifyUrl: text('spotify_url').notNull(),
  name: text('name').notNull(),
  metadataFetchedAt: timestamp('metadata_fetched_at', {
    mode: 'date',
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
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

export const albumArtists = pgTable(
  'album_artists',
  {
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.albumId, table.artistId]
    }),

    uniqueIndex('album_artists_album_position_unique').on(
      table.albumId,
      table.position,
    ),

    index('album_artists_artist_id_idx').on(table.artistId),

    check(
      'album_artists_position_non_negative',
      sql`${table.position} >= 0`,
    ),
  ]
)