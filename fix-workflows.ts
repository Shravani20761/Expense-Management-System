import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from 'dotenv';
import * as schema from './src/drizzle/schema';
import { eq } from 'drizzle-orm';

dotenv.config();

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  const companies = await db.query.companies.findMany();
  for (const company of companies) {
    const existingStep = await db.query.approvalSteps.findFirst({
      where: eq(schema.approvalSteps.companyId, company.id),
    });

    if (!existingStep) {
      const [step1] = await db
        .insert(schema.approvalSteps)
        .values({
          companyId: company.id,
          name: 'Direct Manager Approval',
          stepOrder: 1,
          isSequential: true,
        })
        .returning();

      await db.insert(schema.approvalRules).values({
        stepId: step1.id,
        ruleType: 'MANAGER_REQUIRED',
        ruleConfig: { required: true },
      });
      console.log(`Added Manager workflow for ${company.name}`);
    } else {
      console.log(`Workflow already exists for ${company.name}`);
    }
  }

  process.exit(0);
}

main().catch(console.error);
