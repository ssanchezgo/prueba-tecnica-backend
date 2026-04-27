import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    this.client = new PrismaClient({
      adapter,
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  /**
   * Exponemos el método $transaction nativo.
   * Esto permite usar: await this.prisma.$transaction(async (tx) => { ... })
   */
  get $transaction() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.client.$transaction.bind(this.client);
  }

  get merchant() {
    return this.client.merchant;
  }

  get transaction() {
    return this.client.transaction;
  }

  get settlement() {
    return this.client.settlement;
  }

  get settlementTransaction() {
    return this.client.settlementTransaction;
  }
}
