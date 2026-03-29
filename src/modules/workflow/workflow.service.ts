import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { ActionDto } from './dto/action.dto';

@Injectable()
export class WorkflowService {
  constructor(
    @Inject(DRIZZLE) private db: NeonHttpDatabase<typeof schema>,
  ) {}

  async initiateWorkflow(expenseId: string, companyId: string) {
    const firstStep = await this.db.query.approvalSteps.findFirst({
        where: eq(schema.approvalSteps.companyId, companyId),
        orderBy: [schema.approvalSteps.stepOrder]
    });

    if (firstStep) {
        await this.db.update(schema.expenses)
            .set({ currentStepId: firstStep.id, status: 'PENDING' })
            .where(eq(schema.expenses.id, expenseId));
    } else {
        await this.db.update(schema.expenses)
            .set({ status: 'APPROVED' })
            .where(eq(schema.expenses.id, expenseId));
    }
  }

  async getApprovalsToReview(approverId: string, companyId: string) {
      const expenses = await this.db.query.expenses.findMany({
          where: and(eq(schema.expenses.companyId, companyId), eq(schema.expenses.status, 'PENDING')),
      });
      return expenses;
  }

  async performAction(approverId: string, actionDto: ActionDto) {
      const expense = await this.db.query.expenses.findFirst({
          where: eq(schema.expenses.id, actionDto.expenseId)
      });

      if (!expense || expense.status !== 'PENDING' || !expense.currentStepId) {
          throw new BadRequestException('Expense cannot be actioned.');
      }

      await this.db.insert(schema.approvalActions).values({
          expenseId: expense.id,
          stepId: expense.currentStepId,
          approverId,
          action: actionDto.action,
          comments: actionDto.comments,
      });

      if (actionDto.action === 'REJECT') {
          await this.db.update(schema.expenses)
            .set({ status: 'REJECTED' })
            .where(eq(schema.expenses.id, expense.id));
          return { message: 'Expense rejected.' };
      }

      await this.evaluateStep(expense.id, expense.currentStepId, expense.companyId);

      return { message: 'Action recorded successfully.' };
  }

  async evaluateStep(expenseId: string, stepId: string, companyId: string) {
      const actions = await this.db.query.approvalActions.findMany({
          where: and(eq(schema.approvalActions.expenseId, expenseId), eq(schema.approvalActions.stepId, stepId))
      });

      const approvedCount = actions.filter((a: any) => a.action === 'APPROVE').length;
      
      if (approvedCount > 0) {
        const allSteps = await this.db.query.approvalSteps.findMany({
            where: eq(schema.approvalSteps.companyId, companyId),
            orderBy: [schema.approvalSteps.stepOrder]
        });

        const currIdx = allSteps.findIndex((s: any) => s.id === stepId);
        if (currIdx >= 0 && currIdx < allSteps.length - 1) {
            const next = allSteps[currIdx + 1];
            await this.db.update(schema.expenses)
                .set({ currentStepId: next.id })
                .where(eq(schema.expenses.id, expenseId));
        } else {
            await this.db.update(schema.expenses)
                .set({ status: 'APPROVED', currentStepId: null })
                .where(eq(schema.expenses.id, expenseId));
        }
      }
  }
}
