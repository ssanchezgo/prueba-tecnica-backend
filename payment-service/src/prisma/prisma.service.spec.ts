import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

// Mock pg Pool and PrismaPg adapter to avoid real DB connections
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    end: jest.fn(),
  })),
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

const mockPrismaClient = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $transaction: jest.fn(),
  merchant: { findUnique: jest.fn() },
  transaction: { findMany: jest.fn() },
  settlement: { findMany: jest.fn() },
  settlementTransaction: { create: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient),
}));

describe('PrismaService (payment-service)', () => {
  let service: PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should call $connect on init', async () => {
      await service.onModuleInit();

      expect(mockPrismaClient.$connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect on destroy', async () => {
      await service.onModuleDestroy();

      expect(mockPrismaClient.$disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('getters', () => {
    it('should expose merchant model', () => {
      expect(service.merchant).toBeDefined();
      expect(service.merchant).toBe(mockPrismaClient.merchant);
    });

    it('should expose transaction model', () => {
      expect(service.transaction).toBeDefined();
      expect(service.transaction).toBe(mockPrismaClient.transaction);
    });

    it('should expose settlement model', () => {
      expect(service.settlement).toBeDefined();
      expect(service.settlement).toBe(mockPrismaClient.settlement);
    });

    it('should expose settlementTransaction model', () => {
      expect(service.settlementTransaction).toBeDefined();
      expect(service.settlementTransaction).toBe(
        mockPrismaClient.settlementTransaction,
      );
    });

    it('should expose $transaction bound to client', () => {
      expect(service.$transaction).toBeDefined();
      expect(typeof service.$transaction).toBe('function');
    });
  });

  describe('$transaction', () => {
    it('should delegate $transaction calls to the client', async () => {
      const mockCallback = jest.fn().mockResolvedValue('result');
      mockPrismaClient.$transaction.mockImplementation(
        (cb: typeof mockCallback) => cb(mockPrismaClient),
      );

      await service.$transaction(mockCallback);

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });
  });
});
