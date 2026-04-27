import {
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  IsObject,
  IsUUID,
} from 'class-validator';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Currency, TransactionType, Prisma } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'ID único del comercio',
    example: '62f014cc-5f23-401e-adae-dbcc3b1744d8',
  })
  @IsUUID()
  @IsNotEmpty()
  merchant_id!: string; // Usamos ! para indicar que Nest lo llenará

  @ApiProperty({ description: 'Monto de la transacción', example: 15000 })
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({ enum: Currency, example: 'COP' })
  @IsEnum(Currency)
  @IsNotEmpty()
  currency!: Currency;

  @ApiProperty({ enum: TransactionType, example: 'payin' })
  @IsEnum(TransactionType)
  @IsNotEmpty()
  type!: TransactionType;

  @ApiProperty({
    description: 'Metadatos adicionales de la transacción',
    required: false,
    example: { order_id: 'ABC-123' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
