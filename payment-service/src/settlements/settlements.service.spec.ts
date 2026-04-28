import { Test, TestingModule } from '@nestjs/testing';
import { SettlementsService } from './settlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnprocessableEntityException } from '@nestjs/common';
import { TransactionStatus, SettlementStatus } from '@prisma/client';

describe('SettlementsService', () => {
  let service: SettlementsService;
  let prismaService: PrismaService;

  const mockMerchant = {
    id: 'merchant-uuid-123',
    name: 'Test Merchant',
    email: 'test@merchant.com',
    api_key: 'test-api-key',
    status: 'active' as const,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockApprovedTransactions = [
    {
      id: 'tx-1',
      merchant_id: 'merchant-uuid-123',
      amount: 100.5,
      currency: 'USD',
      type: 'payin',
      status: TransactionStatus.approved,
      reference: 'TXN-20260128-ABC123',
      metadata: {},
      created_at: new Date('2026-01-20'),
      updated_at: new Date('2026-01-20'),
    },
    {
      id: 'tx-2',
      merchant_id: 'merchant-uuid-123',
      amount: 200.75,
      currency: 'USD',
      type: 'payin',
      status: TransactionStatus.approved,
      reference: 'TXN-20260128-DEF456',
      metadata: {},
      created_at: new Date('2026-01-21'),
      updated_at: new Date('2026-01-21'),
    },
  ];

  const mockSettlement = {
    id: 'settlement-uuid-123',
    merchant_id: 'merchant-uuid-123',
    total_amount: 301.25,
    transaction_count: 2,
    status: SettlementStatus.pending,
    period_start: new Date('2026-01-20'),
    period_end: new Date(),
    created_at: new Date(),
  };

  const mockPrismaService = {
    transaction: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    settlement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    settlementTransaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SettlementsService>(SettlementsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should generate a settlement with approved transactions', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue(
        mockApprovedTransactions,
      );

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          settlement: {
            create: jest.fn().mockResolvedValue(mockSettlement),
          },
          settlementTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
          transaction: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      const result = await service.generate(mockMerchant);

      expect(result).toEqual(mockSettlement);
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: {
          merchant_id: mockMerchant.id,
          status: TransactionStatus.approved,
          settlement_transaction: null,
        },
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw error if no approved transactions exist', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      await expect(service.generate(mockMerchant)).rejects.toThrow(
        UnprocessableEntityException,
      );
      await expect(service.generate(mockMerchant)).rejects.toThrow(
        'No hay transacciones aprobadas para liquidar.',
      );
    });

    it('should calculate total amount correctly', async () => {
      const transactions = [
        { ...mockApprovedTransactions[0], amount: 100 },
        { ...mockApprovedTransactions[1], amount: 200 },
        { ...mockApprovedTransactions[0], id: 'tx-3', amount: 50.5 },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          settlement: {
            create: jest.fn().mockImplementation(({ data }) => {
              expect(data.total_amount).toBe(350.5);
              expect(data.transaction_count).toBe(3);
              return Promise.resolve(mockSettlement);
            }),
          },
          settlementTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
          transaction: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      await service.generate(mockMerchant);
    });

    it('should create settlement transactions for each approved transaction', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue(
        mockApprovedTransactions,
      );

      const mockCreateSettlementTx = jest.fn().mockResolvedValue({});

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          settlement: {
            create: jest.fn().mockResolvedValue(mockSettlement),
          },
          settlementTransaction: {
            create: mockCreateSettlementTx,
          },
          transaction: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      await service.generate(mockMerchant);

      expect(mockCreateSettlementTx).toHaveBeenCalledTimes(2);
    });

    it('should update transaction status to completed', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue(
        mockApprovedTransactions,
      );

      const mockUpdateTransaction = jest.fn().mockResolvedValue({});

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          settlement: {
            create: jest.fn().mockResolvedValue(mockSettlement),
          },
          settlementTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
          transaction: {
            update: mockUpdateTransaction,
          },
        };
        return callback(mockTx);
      });

      await service.generate(mockMerchant);

      expect(mockUpdateTransaction).toHaveBeenCalledTimes(2);
      expect(mockUpdateTransaction).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: TransactionStatus.completed },
      });
      expect(mockUpdateTransaction).toHaveBeenCalledWith({
        where: { id: 'tx-2' },
        data: { status: TransactionStatus.completed },
      });
    });

    it('should set period_start to earliest transaction date', async () => {
      const transactions = [
        { ...mockApprovedTransactions[0], created_at: new Date('2026-01-15') },
        { ...mockApprovedTransactions[1], created_at: new Date('2026-01-20') },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          settlement: {
            create: jest.fn().mockImplementation(({ data }) => {
              expect(data.period_start).toEqual(new Date('2026-01-15'));
              return Promise.resolve(mockSettlement);
            }),
          },
          settlementTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
          transaction: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      await service.generate(mockMerchant);
    });
  });

  describe('findAll', () => {
    it('should return all settlements for a merchant', async () => {
      const mockSettlements = [
        mockSettlement,
        {
          ...mockSettlement,
          id: 'settlement-uuid-456',
          total_amount: 500.0,
        },
      ];

      mockPrismaService.settlement.findMany.mockResolvedValue(mockSettlements);

      const result = await service.findAll(mockMerchant.id);

      expect(result).toEqual(mockSettlements);
      expect(mockPrismaService.settlement.findMany).toHaveBeenCalledWith({
        where: { merchant_id: mockMerchant.id },
        include: { _count: { select: { transactions: true } } },
        orderBy: { created_at: 'desc' },
      });
    });

    it('should return empty array if no settlements exist', async () => {
      mockPrismaService.settlement.findMany.mockResolvedValue([]);

      const result = await service.findAll(mockMerchant.id);

      expect(result).toEqual([]);
    });

    it('should order settlements by created_at desc', async () => {
      mockPrismaService.settlement.findMany.mockResolvedValue([]);

      await service.findAll(mockMerchant.id);

      expect(mockPrismaService.settlement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
        }),
      );
    });
  });
});
