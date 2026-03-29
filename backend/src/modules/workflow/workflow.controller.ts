import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { ActionDto } from './dto/action.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../users/dto/create-user.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('approvals')
  async getApprovals(@CurrentUser() user: any) {
    return this.workflowService.getApprovalsToReview(user.userId, user.companyId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post('action')
  async performAction(@CurrentUser() user: any, @Body() actionDto: ActionDto) {
    return this.workflowService.performAction(user.userId, actionDto);
  }
}
