import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { TransactionStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class QueryTransactionDto {
  @IsOptional()
  @IsString()
  merchant_id?: string;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
