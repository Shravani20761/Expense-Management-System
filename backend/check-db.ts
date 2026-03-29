import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from 'dotenv';
import * as schema from './src/drizzle/schema';
import { count } from 'drizzle-orm';

dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set.');
    return;
  }
  const sqlClient = neon(process.env.DATABASE_URL);
  const db = drizzle(sqlClient, { schema });

  const cCount = await db.select({ value: count() }).from(schema.companies);
  const uCount = await db.select({ value: count() }).from(schema.users);
  
  console.log('Current DB state:');
  console.log('Companies:', cCount[0].value);
  console.log('Users:', uCount[0].value);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
