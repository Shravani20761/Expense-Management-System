import { IsNotEmpty, IsNumber, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateReimbursementDto {
  @IsNotEmpty()
  @IsUUID()
  expenseId!: string;

  @IsNotEmpty()
  @IsNumber()
  amountPaid!: number;

  @IsNotEmpty()
  @IsString()
  currency!: string;

  @IsNotEmpty()
  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;
}
