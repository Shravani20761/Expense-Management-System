import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ReimbursementsService } from './reimbursements.service';
import { CreateReimbursementDto } from './dto/create-reimbursement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../users/dto/create-user.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reimbursements')
export class ReimbursementsController {
  constructor(private readonly reimbursementsService: ReimbursementsService) {}

  @Roles(Role.ADMIN) // Assuming Admins/Finance handle payouts
  @Post()
  async createReimbursement(@CurrentUser() user: any, @Body() createDto: CreateReimbursementDto) {
    return this.reimbursementsService.create(user.companyId, user.userId, createDto);
  }

  @Get('expense/:expenseId')
  async getReimbursementByExpense(@CurrentUser() user: any, @Param('expenseId') expenseId: string) {
    // Both employees and managers should be able to see payment details of an expense
    return this.reimbursementsService.findByExpense(expenseId, user.companyId);
  }
}
