import { pgTable, text, timestamp, unique, index, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './auth'

export const userLegalAcceptances = pgTable(
  'user_legal_acceptances',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    termsVersion: varchar('terms_version', {
      length: 32,
    }).notNull(),

    privacyPolicyVersion: varchar('privacy_policy_version', {
      length: 32,
    }).notNull(),

    acceptedAt: timestamp('accepted_at', {
      mode: 'date',
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('user_legal_acceptances_user_versions_unique').on(
      table.userId,
      table.termsVersion,
      table.privacyPolicyVersion,
    ),

    index('user_legal_acceptances_user_id_idx').on(table.userId),
  ],
)