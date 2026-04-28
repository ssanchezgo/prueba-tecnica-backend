import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  TransactionStatus,
  Transaction,
  Prisma,
  TransactionType,
  Merchant,
} from '@prisma/client';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('NOTIFICATIONS_SERVICE') private readonly client: ClientProxy,
  ) {}

  async create(
    createTransactionDto: CreateTransactionDto,
    merchant: Merchant,
  ): Promise<Transaction> {
    const reference = await this.generateUniqueReference();

    const data: Prisma.TransactionUncheckedCreateInput = {
      reference,
      status: TransactionStatus.pending,
      merchant_id: merchant.id,
      amount: createTransactionDto.amount,
      currency: createTransactionDto.currency,
      type: createTransactionDto.type,
      metadata: createTransactionDto.metadata ?? Prisma.JsonNull,
    };

    return this.prisma.transaction.create({ data });
  }

  async findAll(query: QueryTransactionDto): Promise<any> {
    const { merchant_id, status, type, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};
    if (merchant_id) where.merchant_id = merchant_id;
    if (status) where.status = status;
    if (type) where.type = type as TransactionType;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });
    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }
    return transaction;
  }

  async updateStatus(
    id: string,
    updateDto: UpdateStatusDto,
  ): Promise<Transaction> {
    const currentTx = await this.findOne(id);
    const newStatus = updateDto.status;

    // Máquina de estados
    const allowed: Record<TransactionStatus, TransactionStatus[]> = {
      [TransactionStatus.pending]: [
        TransactionStatus.approved,
        TransactionStatus.rejected,
        TransactionStatus.failed,
      ],
      [TransactionStatus.approved]: [
        TransactionStatus.completed,
        TransactionStatus.failed,
      ],
      [TransactionStatus.completed]: [],
      [TransactionStatus.rejected]: [],
      [TransactionStatus.failed]: [],
    };

    if (!allowed[currentTx.status].includes(newStatus)) {
      throw new UnprocessableEntityException(
        `Transición inválida: No se puede pasar de '${currentTx.status}' a '${newStatus}'`, // Requisito 2.1a
      );
    }

    const updatedTx = await this.prisma.transaction.update({
      where: { id },
      data: { status: newStatus },
    });

    // EMISIÓN DEL EVENTO ASÍNCRONO
    this.client.emit('transaction_status_updated', {
      transaction_id: updatedTx.id,
      merchant_id: updatedTx.merchant_id,
      event_type: `transaction.${newStatus}`,
      payload: updatedTx,
    });

    return updatedTx;
  }

  async remove(id: string): Promise<Transaction> {
    await this.findOne(id);
    return this.prisma.transaction.delete({ where: { id } });
  }

  private async generateUniqueReference(): Promise<string> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let reference = '';
    let isUnique = false;

    while (!isUnique) {
      const randomChars = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
      reference = `TXN-${date}-${randomChars}`; // Formato Requisito 2.1b

      const exists = await this.prisma.transaction.findUnique({
        where: { reference },
        select: { id: true },
      });

      if (!exists) isUnique = true;
    }

    return reference;
  }
}
