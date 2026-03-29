import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from 'dotenv';
import * as schema from './src/drizzle/schema';

dotenv.config();

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  // Reset all currently auto-approved expenses to PENDING
  await db.update(schema.expenses).set({ status: 'PENDING' });
  console.log('Reset all expenses to PENDING');

  process.exit(0);
}

main().catch(console.error);
