import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  numeric,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  baseCurrency: varchar('base_currency', { length: 3 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // ADMIN, MANAGER, EMPLOYEE
  managerId: uuid('manager_id'), // Self-referencing UUID for hierarchy
  isActive: boolean('is_active').default(true).notNull(),
  mustChangePassword: boolean('must_change_password').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Role-Specific Profile Tables ────────────────────────────────────────────

export const adminProfiles = pgTable('admin_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  name: varchar('name', { length: 255 }),
  canManageUsers: boolean('can_manage_users').default(true).notNull(),
  canManageWorkflows: boolean('can_manage_workflows').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const managerProfiles = pgTable('manager_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  name: varchar('name', { length: 255 }),
  department: varchar('department', { length: 255 }),
  approvalLimit: numeric('approval_limit').default('10000').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employeeProfiles = pgTable('employee_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  name: varchar('name', { length: 255 }),
  department: varchar('department', { length: 255 }),
  designation: varchar('designation', { length: 255 }),
  monthlyBudget: numeric('monthly_budget').default('5000').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  amount: numeric('amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  amountCompanyCurrency: numeric('amount_company_currency'),
  category: varchar('category', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),
  paidBy: varchar('paid_by', { length: 255 }),
  remarks: varchar('remarks', { length: 1000 }),
  receiptUrl: varchar('receipt_url', { length: 1000 }),
  expenseDate: timestamp('expense_date').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('DRAFT'), // DRAFT, PENDING, APPROVED, REJECTED
  currentStepId: uuid('current_step_id'), // Track workflow step
  ocrData: jsonb('ocr_data'),
  expenseLines: jsonb('expense_lines'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const approvalSteps = pgTable('approval_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  stepOrder: integer('step_order').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  isSequential: boolean('is_sequential').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const approvalRules = pgTable('approval_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  stepId: uuid('step_id').references(() => approvalSteps.id).notNull(),
  ruleType: varchar('rule_type', { length: 50 }).notNull(), // PERCENTAGE, MANAGER_REQUIRED, SPECIFIC_APPROVER
  ruleConfig: jsonb('rule_config'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const approvalActions = pgTable('approval_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  expenseId: uuid('expense_id').references(() => expenses.id).notNull(),
  stepId: uuid('step_id').references(() => approvalSteps.id).notNull(),
  approverId: uuid('approver_id').references(() => users.id).notNull(),
  action: varchar('action', { length: 50 }).notNull(), // APPROVE, REJECT
  comments: varchar('comments', { length: 1000 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const currencyConversionLogs = pgTable('currency_conversion_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseCurrency: varchar('base_currency', { length: 3 }).notNull(),
  rates: jsonb('rates').notNull(),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  message: varchar('message', { length: 1000 }).notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Financial Tracking ──────────────────────────────────────────────────────

export const reimbursements = pgTable('reimbursements', {
  id: uuid('id').defaultRandom().primaryKey(),
  expenseId: uuid('expense_id').references(() => expenses.id).notNull().unique(), // 1 reimbursement per expense (keeping it simple for now)
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  amountPaid: numeric('amount_paid').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  paymentDate: timestamp('payment_date').notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // BANK_TRANSFER, CASH, CHEQUE
  referenceNumber: varchar('reference_number', { length: 255 }), // Bank transaction ID, etc.
  processedById: uuid('processed_by_id').references(() => users.id).notNull(), // The Admin/Finance user who marked it paid
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
