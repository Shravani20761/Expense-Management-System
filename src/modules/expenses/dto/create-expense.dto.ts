import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateExpenseDto {
  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsString()
  category!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  paidBy?: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;
}
