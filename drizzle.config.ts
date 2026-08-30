import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: [
    './src/db/schema/catalog.ts',
    './src/db/schema/library.ts',
    './src/db/schema/recommendations.ts',
    './src/db/schema/settings.ts',
    './src/db/schema/tags.ts',
    // './src/db/schema/auth.ts',
  ],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
