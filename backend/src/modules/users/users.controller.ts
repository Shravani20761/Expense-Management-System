import { Controller, Get, Post, Body, Param, Put, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, Role } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get()
  async getAllUsers(@CurrentUser() user: any) {
    return this.usersService.findAllByCompany(user.companyId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post()
  async createUser(@CurrentUser() user: any, @Body() createUserDto: CreateUserDto) {
    return this.usersService.create(user.companyId, createUserDto);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  async updateUser(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, user.companyId, updateUserDto);
  }

  @Get('me')
  async getMe(@CurrentUser() user: any) {
    const dbUser = await this.usersService.findById(user.userId);
    if (!dbUser) return null;
    const { passwordHash, ...safeUser } = dbUser;
    return safeUser;
  }

  /** GET /users/:id/profile — returns user + their role-specific profile */
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get(':id/profile')
  async getUserProfile(@CurrentUser() user: any, @Param('id') id: string) {
    return this.usersService.findProfile(id, user.companyId);
  }

  /** PATCH /users/:id/profile — update role-specific profile data */
  @Roles(Role.ADMIN)
  @Patch(':id/profile')
  async updateUserProfile(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.usersService.updateProfile(id, user.companyId, body);
  }
}
