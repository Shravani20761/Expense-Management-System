import { IsEmail, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsString } from 'class-validator';

export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsUUID()
  managerId?: string;
}
