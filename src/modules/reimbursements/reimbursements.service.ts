import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { CreateReimbursementDto } from './dto/create-reimbursement.dto';

@Injectable()
export class ReimbursementsService {
  constructor(@Inject(DRIZZLE) private db: NeonHttpDatabase<typeof schema>) {}

  async create(companyId: string, processedById: string, createDto: CreateReimbursementDto) {
    // 1. Verify expense exists and is approved
    const expense = await this.db.query.expenses.findFirst({
      where: and(
        eq(schema.expenses.id, createDto.expenseId),
        eq(schema.expenses.companyId, companyId)
      )
    });

    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }

    if (expense.status !== 'APPROVED') {
      throw new BadRequestException('Only approved expenses can be reimbursed.');
    }

    // 2. Check if already reimbursed
    const existing = await this.db.query.reimbursements.findFirst({
      where: eq(schema.reimbursements.expenseId, createDto.expenseId)
    });

    if (existing) {
      throw new BadRequestException('Expense has already been reimbursed.');
    }

    // 3. Create the reimbursement record
    const [reimbursement] = await this.db.insert(schema.reimbursements).values({
      expenseId: createDto.expenseId,
      companyId,
      amountPaid: createDto.amountPaid.toString(),
      currency: createDto.currency,
      paymentMethod: createDto.paymentMethod,
      referenceNumber: createDto.referenceNumber,
      paymentDate: new Date(),
      processedById,
    }).returning();

    // 4. Update the expense status to 'PAID'
    await this.db.update(schema.expenses)
      .set({ status: 'PAID' })
      .where(eq(schema.expenses.id, createDto.expenseId));

    return reimbursement;
  }

  async findByExpense(expenseId: string, companyId: string) {
    const reimbursement = await this.db.query.reimbursements.findFirst({
      where: and(
        eq(schema.reimbursements.expenseId, expenseId),
        eq(schema.reimbursements.companyId, companyId)
      )
    });

    if (!reimbursement) {
      throw new NotFoundException('Reimbursement record not found for this expense.');
    }

    return reimbursement;
  }
}
