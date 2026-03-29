import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set.');
    return;
  }
  const sql = neon(process.env.DATABASE_URL);
  
  console.log('--- Truncating Database ---');
  await sql`TRUNCATE TABLE companies CASCADE;`;
  console.log('--- Database Cleared ---');
  
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
