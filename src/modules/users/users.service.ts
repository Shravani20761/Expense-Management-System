import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: NeonHttpDatabase<typeof schema>) {}

  async findByEmail(email: string) {
    return this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });
  }

  async findById(id: string) {
    return this.db.query.users.findFirst({
      where: eq(schema.users.id, id),
    });
  }

  async findAllByCompany(companyId: string) {
    return this.db.query.users.findMany({
      where: eq(schema.users.companyId, companyId),
      columns: {
        id: true,
        email: true,
        role: true,
        managerId: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async create(companyId: string, createUserDto: CreateUserDto) {
    const existing = await this.findByEmail(createUserDto.email);
    if (existing) {
      throw new ConflictException('User with that email already exists.');
    }

    const rawPassword = crypto.randomBytes(5).toString('hex');
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const [newUser] = await this.db
      .insert(schema.users)
      .values({
        companyId,
        email: createUserDto.email,
        role: createUserDto.role,
        passwordHash,
        managerId: createUserDto.managerId || null,
        mustChangePassword: true,
      })
      .returning();

    // Auto-create role-specific profile
    await this.createProfileForRole(newUser.id, companyId, newUser.role, createUserDto.name ?? 'Unknown');

    return {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      rawPassword_temporary: rawPassword,
    };
  }

  /** Creates the matching profile table row for a given role */
  async createProfileForRole(userId: string, companyId: string, role: string, name = 'Unknown') {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        await this.db
          .insert(schema.adminProfiles)
          .values({ userId, companyId, name })
          .onConflictDoNothing();
        break;
      case 'MANAGER':
        await this.db
          .insert(schema.managerProfiles)
          .values({ userId, companyId, name })
          .onConflictDoNothing();
        break;
      case 'EMPLOYEE':
        await this.db
          .insert(schema.employeeProfiles)
          .values({ userId, companyId, name })
          .onConflictDoNothing();
        break;
      default:
        throw new BadRequestException(`Unknown role: ${role}`);
    }
  }

  /** Returns user + their role-specific profile */
  async findProfile(userId: string, companyId: string) {
    const user = await this.db.query.users.findFirst({
      where: and(eq(schema.users.id, userId), eq(schema.users.companyId, companyId)),
      columns: {
        id: true,
        email: true,
        role: true,
        managerId: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this company.');
    }

    let profile: Record<string, any> | null = null;

    switch (user.role.toUpperCase()) {
      case 'ADMIN':
        profile = await this.db.query.adminProfiles.findFirst({
          where: eq(schema.adminProfiles.userId, userId),
        }) ?? null;
        break;
      case 'MANAGER':
        profile = await this.db.query.managerProfiles.findFirst({
          where: eq(schema.managerProfiles.userId, userId),
        }) ?? null;
        break;
      case 'EMPLOYEE':
        profile = await this.db.query.employeeProfiles.findFirst({
          where: eq(schema.employeeProfiles.userId, userId),
        }) ?? null;
        break;
    }

    return { ...user, profile };
  }

  /** Updates the role-specific profile for a user */
  async updateProfile(userId: string, companyId: string, data: Record<string, any>) {
    const user = await this.db.query.users.findFirst({
      where: and(eq(schema.users.id, userId), eq(schema.users.companyId, companyId)),
    });

    if (!user) {
      throw new NotFoundException('User not found in this company.');
    }

    switch (user.role.toUpperCase()) {
      case 'ADMIN': {
        const [updated] = await this.db
          .update(schema.adminProfiles)
          .set({
            name: data.name,
            canManageUsers: data.canManageUsers,
            canManageWorkflows: data.canManageWorkflows,
          })
          .where(eq(schema.adminProfiles.userId, userId))
          .returning();
        return updated;
      }
      case 'MANAGER': {
        const [updated] = await this.db
          .update(schema.managerProfiles)
          .set({
            name: data.name,
            department: data.department,
            approvalLimit: data.approvalLimit,
          })
          .where(eq(schema.managerProfiles.userId, userId))
          .returning();
        return updated;
      }
      case 'EMPLOYEE': {
        const [updated] = await this.db
          .update(schema.employeeProfiles)
          .set({
            name: data.name,
            department: data.department,
            designation: data.designation,
            monthlyBudget: data.monthlyBudget,
          })
          .where(eq(schema.employeeProfiles.userId, userId))
          .returning();
        return updated;
      }
      default:
        throw new BadRequestException(`Unknown role: ${user.role}`);
    }
  }

  async update(id: string, companyId: string, updateUserDto: UpdateUserDto) {
    const user = await this.db.query.users.findFirst({
      where: and(eq(schema.users.id, id), eq(schema.users.companyId, companyId)),
    });

    if (!user) {
      throw new NotFoundException('User not found in this company.');
    }

    const [updated] = await this.db
      .update(schema.users)
      .set({
        role: updateUserDto.role,
        managerId: updateUserDto.managerId === undefined ? user.managerId : updateUserDto.managerId,
        isActive: updateUserDto.isActive === undefined ? user.isActive : updateUserDto.isActive,
      })
      .where(eq(schema.users.id, id))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        managerId: schema.users.managerId,
        isActive: schema.users.isActive,
      });

    return updated;
  }
}
