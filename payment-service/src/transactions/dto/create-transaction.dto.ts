import {
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  IsObject,
  IsUUID,
  Min,
} from 'class-validator';
import { Currency, TransactionType, Prisma } from '@prisma/client';

export class CreateTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  merchant_id!: string; // Requerido

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsNotEmpty()
  amount!: number; // Mayor a 0

  @IsEnum(Currency)
  @IsNotEmpty()
  currency!: Currency; // GTQ, COP, USD

  @IsEnum(TransactionType)
  @IsNotEmpty()
  type!: TransactionType; // payin, payout

  @IsOptional()
  @IsObject()
  metadata?: Prisma.JsonValue; // Opcional pero debe ser objeto
}
