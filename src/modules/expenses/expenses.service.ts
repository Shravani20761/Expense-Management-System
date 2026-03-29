import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CurrencyService } from '../currency/currency.service';
import { OcrService } from '../ocr/ocr.service';
import { WorkflowService } from '../workflow/workflow.service';

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(DRIZZLE) private db: NeonHttpDatabase<typeof schema>,
    private currencyService: CurrencyService,
    private ocrService: OcrService,
    private workflowService: WorkflowService,
  ) {}

  async createExpense(userId: string, companyId: string, dto: CreateExpenseDto) {
    let ocrData = null;
    let expenseLines = null;
    
    if (dto.receiptUrl) {
      const ocrResult = await this.ocrService.processReceipt(dto.receiptUrl);
      ocrData = ocrResult;
      expenseLines = ocrResult.lines;
    }

    let amountCompanyCurrency = null;
    const company = await this.db.query.companies.findFirst({
        where: eq(schema.companies.id, companyId)
    });
    
    if (company && company.baseCurrency !== dto.currency) {
      const rates = await this.currencyService.getConversionRates(company.baseCurrency);
      if (rates && rates[dto.currency]) {
        amountCompanyCurrency = (dto.amount / rates[dto.currency]).toFixed(2);
      }
    } else {
      amountCompanyCurrency = dto.amount.toString();
    }

    const initialStatus = dto.isDraft ? 'DRAFT' : 'PENDING';

    const [expense] = await this.db.insert(schema.expenses).values({
      userId,
      companyId,
      amount: dto.amount.toString(),
      currency: dto.currency,
      amountCompanyCurrency: amountCompanyCurrency?.toString(),
      category: dto.category,
      description: dto.description,
      paidBy: dto.paidBy,
      remarks: dto.remarks,
      receiptUrl: dto.receiptUrl,
      expenseDate: new Date(),
      status: initialStatus,
      ocrData,
      expenseLines,
    }).returning();

    if (initialStatus === 'PENDING') {
      await this.workflowService.initiateWorkflow(expense.id, companyId);
    }

    return expense;
  }

  async getExpensesByUser(userId: string) {
    return this.db.query.expenses.findMany({
      where: eq(schema.expenses.userId, userId),
      orderBy: (expenses: any, { desc }: any) => [desc(expenses.createdAt)]
    });
  }
}
