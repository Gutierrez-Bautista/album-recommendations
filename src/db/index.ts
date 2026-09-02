import { drizzle } from 'drizzle-orm/neon-http';
import { authRelations } from './schema/auth'

const db = drizzle(process.env.DATABASE_URL!, {
  relations: authRelations
});

export default db