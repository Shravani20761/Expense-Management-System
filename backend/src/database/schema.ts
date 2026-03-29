import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['ADMIN', 'MANAGER', 'EMPLOYEE']);
export const expenseStatusEnum = pgEnum('expense_status', ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']);
export const approvalActionEnum = pgEnum('approval_action', ['APPROVED', 'REJECTED']);
export const approvalRuleTypeEnum = pgEnum('approval_rule_type', ['PERCENTAGE', 'SPECIFIC_APPROVER', 'HYBRID']);

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  country: varchar('country', { length: 100 }).notNull(),
  defaultCurrency: varchar('default_currency', { length: 10 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  managerId: uuid('manager_id'), // Self-reference, will setup relationship later
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  role: roleEnum('role').default('EMPLOYEE').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  refreshToken: text('refresh_token'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  amountOriginal: integer('amount_original').notNull(), // Assuming storing in cents/smallest unit
  currencyOriginal: varchar('currency_original', { length: 10 }).notNull(),
  amountConverted: integer('amount_converted').notNull(),
  currencyConverted: varchar('currency_converted', { length: 10 }).notNull(),
  category: varchar('category', { length: 255 }).notNull(),
  description: text('description').notNull(),
  expenseDate: timestamp('expense_date').notNull(),
  receiptUrl: text('receipt_url'),
  status: expenseStatusEnum('status').default('DRAFT').notNull(),
  currentStep: integer('current_step').default(1).notNull(),
  expenseLines: jsonb('expense_lines').$type<{ item: string; amount: number }[]>().default([]).notNull(),
  ocrData: jsonb('ocr_data').$type<any>(),
  metadata: jsonb('metadata').$type<any>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const approvalSteps = pgTable('approval_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  stepOrder: integer('step_order').notNull(),
  approverRole: roleEnum('approver_role'),
  isManagerApprover: boolean('is_manager_approver').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const approvalActions = pgTable('approval_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  expenseId: uuid('expense_id').references(() => expenses.id).notNull(),
  approverId: uuid('approver_id').references(() => users.id).notNull(),
  stepOrder: integer('step_order').notNull(),
  action: approvalActionEnum('action').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const approvalRules = pgTable('approval_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  type: approvalRuleTypeEnum('type').notNull(),
  ruleConfig: jsonb('rule_config').$type<{ percentage?: number; specific_approver_id?: string }>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const currencyConversionLogs = pgTable('currency_conversion_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseCurrency: varchar('base_currency', { length: 10 }).notNull(),
  targetCurrency: varchar('target_currency', { length: 10 }).notNull(),
  rate: varchar('rate', { length: 50 }).notNull(),
  apiResponse: jsonb('api_response').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  action: varchar('action', { length: 255 }).notNull(),
  entity: varchar('entity', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  details: jsonb('details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations definitions
export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  manager: one(users, {
    fields: [users.managerId],
    references: [users.id],
  }),
  expenses: many(expenses),
  notifications: many(notifications),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [expenses.companyId],
    references: [companies.id],
  }),
  approvalActions: many(approvalActions),
}));
