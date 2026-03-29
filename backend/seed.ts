import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import * as schema from './src/drizzle/schema';

dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Skipping seed.');
    return;
  }
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  console.log('--- Initializing Global Seed ---');

  const passwordHash = await bcrypt.hash('admin123', 10);

  // ── Company (upsert) ──────────────────────────────────────────────────────
  let company = await db.query.companies.findFirst({
    where: eq(schema.companies.name, 'Acme Corp'),
  });

  if (!company) {
    [company] = await db
      .insert(schema.companies)
      .values({ name: 'Acme Corp', baseCurrency: 'USD' })
      .returning();
    console.log(`Company Created: ${company.name} (${company.baseCurrency})`);
  } else {
    console.log(`Company Already Exists: ${company.name} (${company.baseCurrency})`);
  }

  // ── Admin User ────────────────────────────────────────────────────────────
  let adminUser = await db.query.users.findFirst({
    where: eq(schema.users.email, 'admin@acme.com'),
  });

  if (!adminUser) {
    [adminUser] = await db
      .insert(schema.users)
      .values({
        companyId: company.id,
        email: 'admin@acme.com',
        passwordHash,
        role: 'ADMIN',
        mustChangePassword: true,
      })
      .returning();
    console.log(`Admin User Created: ${adminUser.email}`);
  } else {
    console.log(`Admin User Already Exists: ${adminUser.email}`);
  }

  await db
    .insert(schema.adminProfiles)
    .values({ userId: adminUser.id, companyId: company.id, name: 'Alice Admin' })
    .onConflictDoNothing();
  console.log(`Admin Profile ensured.`);

  // ── Manager User ──────────────────────────────────────────────────────────
  let managerUser = await db.query.users.findFirst({
    where: eq(schema.users.email, 'manager@acme.com'),
  });

  if (!managerUser) {
    [managerUser] = await db
      .insert(schema.users)
      .values({
        companyId: company.id,
        email: 'manager@acme.com',
        passwordHash,
        role: 'MANAGER',
        mustChangePassword: true,
      })
      .returning();
    console.log(`Manager User Created: ${managerUser.email}`);
  } else {
    console.log(`Manager User Already Exists: ${managerUser.email}`);
  }

  await db
    .insert(schema.managerProfiles)
    .values({
      userId: managerUser.id,
      companyId: company.id,
      name: 'Mark Manager',
      department: 'Engineering',
      approvalLimit: '25000',
    })
    .onConflictDoNothing();
  console.log(`Manager Profile ensured.`);

  // ── Employee User ─────────────────────────────────────────────────────────
  let employeeUser = await db.query.users.findFirst({
    where: eq(schema.users.email, 'employee@acme.com'),
  });

  if (!employeeUser) {
    [employeeUser] = await db
      .insert(schema.users)
      .values({
        companyId: company.id,
        email: 'employee@acme.com',
        passwordHash,
        role: 'EMPLOYEE',
        managerId: managerUser.id,
        mustChangePassword: true,
      })
      .returning();
    console.log(`Employee User Created: ${employeeUser.email}`);
  } else {
    console.log(`Employee User Already Exists: ${employeeUser.email}`);
  }

  await db
    .insert(schema.employeeProfiles)
    .values({
      userId: employeeUser.id,
      companyId: company.id,
      name: 'Emma Employee',
      department: 'Engineering',
      designation: 'Software Engineer',
      monthlyBudget: '3000',
    })
    .onConflictDoNothing();
  console.log(`Employee Profile ensured.`);

  // ── Approval Workflow ─────────────────────────────────────────────────────
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
    console.log('Approval Workflow configuration created.');
  } else {
    console.log('Approval Workflow Already Exists.');
  }

  console.log('--- Seed Finished ---');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
