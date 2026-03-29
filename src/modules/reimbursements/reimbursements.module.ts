import { Module } from '@nestjs/common';
import { ReimbursementsService } from './reimbursements.service';
import { ReimbursementsController } from './reimbursements.controller';

@Module({
  controllers: [ReimbursementsController],
  providers: [ReimbursementsService],
})
export class ReimbursementsModule {}
