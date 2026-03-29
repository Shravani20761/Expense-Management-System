import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { CurrencyModule } from '../currency/currency.module';
import { OcrModule } from '../ocr/ocr.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [CurrencyModule, OcrModule, WorkflowModule],
  providers: [ExpensesService],
  controllers: [ExpensesController],
})
export class ExpensesModule {}
