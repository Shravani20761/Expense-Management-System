import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from 'dotenv';
import * as schema from './src/drizzle/schema';
import { sql } from 'drizzle-orm';

dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set.');
    return;
  }
  const sqlClient = neon(process.env.DATABASE_URL);
  const db = drizzle(sqlClient, { schema });

  console.log('--- Clearing Database ---');
  
  try {
    const rawSql = `
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP
              EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
    `;
    await db.execute(sql.raw(rawSql));
    console.log('--- Database Cleared ---');
  } catch (error) {
     console.error("Error truncating", error);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
