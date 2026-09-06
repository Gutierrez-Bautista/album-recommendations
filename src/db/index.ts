import 'server-only'

import { drizzle } from 'drizzle-orm/neon-serverless';
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

import { authRelations } from './schema/auth'

neonConfig.webSocketConstructor = ws

const db = drizzle(process.env.DATABASE_URL!, {
  relations: authRelations
});

export default db