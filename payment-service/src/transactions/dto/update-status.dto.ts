import { IsEnum, IsNotEmpty } from 'class-validator';
import { TransactionStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(TransactionStatus)
  @IsNotEmpty()
  status!: TransactionStatus;
}
