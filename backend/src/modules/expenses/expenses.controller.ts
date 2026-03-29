import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../users/dto/create-user.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  @Post()
  async createExpense(@CurrentUser() user: any, @Body() createExpenseDto: CreateExpenseDto) {
    return this.expensesService.createExpense(user.userId, user.companyId, createExpenseDto);
  }

  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  @Get()
  async getMyExpenses(@CurrentUser() user: any) {
    return this.expensesService.getExpensesByUser(user.userId);
  }

  @Roles(Role.MANAGER, Role.ADMIN)
  @Get('all')
  async getAllExpenses(@CurrentUser() user: any) {
    return this.expensesService.getExpensesByCompany(user.companyId);
  }

  @Roles(Role.MANAGER, Role.ADMIN)
  @Post(':id/approve')
  async approveExpense(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { comment?: string },
  ) {
    return this.expensesService.approveExpense(id, user.companyId, user.userId, body.comment);
  }

  @Roles(Role.MANAGER, Role.ADMIN)
  @Post(':id/reject')
  async rejectExpense(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { comment?: string },
  ) {
    return this.expensesService.rejectExpense(id, user.companyId, user.userId, body.comment);
  }
}

