import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class ActionDto {
  @IsString()
  @IsNotEmpty()
  expenseId!: string;

  @IsEnum(['APPROVE', 'REJECT'])
  @IsNotEmpty()
  action!: 'APPROVE' | 'REJECT';

  @IsString()
  @IsOptional()
  comments?: string;
}
