import { Injectable, Inject, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../../drizzle/schema';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(DRIZZLE) private db: NeonHttpDatabase<typeof schema>,
  ) {}

  async signup(signupDto: SignupDto) {
    const existingUser = await this.usersService.findByEmail(signupDto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(signupDto.password, 10);

    const [newCompany] = await this.db
      .insert(schema.companies)
      .values({
        name: signupDto.companyName,
        baseCurrency: signupDto.baseCurrency,
      })
      .returning();

    const [newUser] = await this.db
      .insert(schema.users)
      .values({
        companyId: newCompany.id,
        email: signupDto.email,
        passwordHash,
        role: 'ADMIN',
      })
      .returning();

    // Auto-create profile for the signed-up ADMIN
    await this.usersService.createProfileForRole(newUser.id, newCompany.id, 'ADMIN', signupDto.companyName + ' Admin');

    // Auto-create default approval workflow
    const [step1] = await this.db
      .insert(schema.approvalSteps)
      .values({
        companyId: newCompany.id,
        name: 'Direct Manager Approval',
        stepOrder: 1,
        isSequential: true,
      })
      .returning();

    await this.db.insert(schema.approvalRules).values({
      stepId: step1.id,
      ruleType: 'MANAGER_REQUIRED',
      ruleConfig: { required: true },
    });

    const result = { company: newCompany, user: newUser };

    const payload = {
      sub: result.user.id,
      email: result.user.email,
      role: result.user.role,
      companyId: result.company.id,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      mustChangePassword: user.mustChangePassword,
    };
  }
}
