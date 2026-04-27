import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client: PrismaClient;

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

  // Delegate Prisma properties
  get merchant(): PrismaClient['merchant'] {
    return this.client.merchant;
  }

  get transaction(): PrismaClient['transaction'] {
    return this.client.transaction;
  }

  get settlement(): PrismaClient['settlement'] {
    return this.client.settlement;
  }

  get settlementTransaction(): PrismaClient['settlementTransaction'] {
    return this.client.settlementTransaction;
  }
}
