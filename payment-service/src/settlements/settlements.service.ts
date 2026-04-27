import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Merchant, TransactionStatus, SettlementStatus } from '@prisma/client';

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(merchant: Merchant) {
    // 1. Buscar transacciones aprobadas que NO tengan liquidación aún
    const transactions = await this.prisma.transaction.findMany({
      where: {
        merchant_id: merchant.id,
        status: TransactionStatus.approved,
        settlement_transaction: null,
      },
    });

    if (transactions.length === 0) {
      throw new UnprocessableEntityException(
        'No hay transacciones aprobadas para liquidar.',
      );
    }

    const totalAmount = transactions.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0,
    );
    return this.prisma.$transaction(
      async (tx: {
        settlement: {
          create: (arg0: {
            data: {
              merchant_id: string;
              total_amount: number;
              transaction_count: number;
              status: 'pending';
              period_start: Date; // O la fecha más antigua
              period_end: Date;
            };
          }) => any;
        };
        settlementTransaction: {
          create: (arg0: {
            data: {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              settlement_id: any;
              transaction_id: string;
            };
          }) => any;
        };
        transaction: {
          update: (arg0: {
            where: { id: string };
            data: { status: 'completed' };
          }) => any;
        };
      }) => {
        // a. Crear el registro de Settlement
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const settlement = await tx.settlement.create({
          data: {
            merchant_id: merchant.id,
            total_amount: totalAmount,
            transaction_count: transactions.length,
            status: SettlementStatus.pending,
            period_start: transactions[0].created_at, // O la fecha más antigua
            period_end: new Date(),
          },
        });

        // b. Crear las relaciones en la tabla intermedia y actualizar transacciones
        for (const t of transactions) {
          // Crear vínculo

          await tx.settlementTransaction.create({
            data: {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              settlement_id: settlement.id,
              transaction_id: t.id,
            },
          });

          // Actualizar estado de la transacción a 'completed'

          await tx.transaction.update({
            where: { id: t.id },
            data: { status: TransactionStatus.completed },
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return settlement;
      },
    );
  }

  async findAll(merchantId: string) {
    return this.prisma.settlement.findMany({
      where: { merchant_id: merchantId },
      include: { _count: { select: { transactions: true } } },
      orderBy: { created_at: 'desc' },
    });
  }
}
