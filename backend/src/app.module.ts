import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './drizzle/drizzle.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ReimbursementsModule } from './modules/reimbursements/reimbursements.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DrizzleModule.forRoot(process.env.DATABASE_URL as string),
    AuthModule,
    UsersModule,
    CurrencyModule,
    OcrModule,
    WorkflowModule,
    ExpensesModule,
    ReimbursementsModule,
  ],
})
export class AppModule {}
