import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { TransactionStatus } from '@prisma/client';

export class UpdateStatusDto {
  @ApiProperty({
    description: 'Nuevo estado de la transacción',
    enum: TransactionStatus,
    example: 'aproved',
  })
  @IsEnum(TransactionStatus)
  @IsNotEmpty()
  status!: TransactionStatus;
}
