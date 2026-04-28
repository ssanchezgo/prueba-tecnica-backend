import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientProxy } from '@nestjs/microservices';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TransactionStatus, Currency, TransactionType } from '@prisma/client';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prismaService: PrismaService;
  let clientProxy: ClientProxy;

  const mockMerchant = {
    id: 'merchant-uuid-123',
    name: 'Test Merchant',
    email: 'test@merchant.com',
    api_key: 'test-api-key',
    status: 'active' as const,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTransaction = {
    id: 'transaction-uuid-123',
    merchant_id: 'merchant-uuid-123',
    amount: 100.5,
    currency: Currency.USD,
    type: TransactionType.payin,
    status: TransactionStatus.pending,
    reference: 'TXN-20260128-ABC123',
    metadata: { customer_id: 'cust_123' },
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPrismaService = {
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockClientProxy = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'NOTIFICATIONS_SERVICE',
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prismaService = module.get<PrismaService>(PrismaService);
    clientProxy = module.get<ClientProxy>('NOTIFICATIONS_SERVICE');

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a transaction successfully', async () => {
      const createDto = {
        amount: 100.5,
        currency: Currency.USD,
        type: TransactionType.payin,
        metadata: { customer_id: 'cust_123' },
      };

      mockPrismaService.transaction.create.mockResolvedValue(mockTransaction);

      const result = await service.create(createDto, mockMerchant);

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          merchant_id: mockMerchant.id,
          amount: createDto.amount,
          currency: createDto.currency,
          type: createDto.type,
          status: TransactionStatus.pending,
          reference: expect.stringMatching(/^TXN-\d{8}-[A-Z0-9]{6}$/),
        }),
      });
    });

    it('should create transaction without metadata', async () => {
      const createDto = {
        amount: 50.0,
        currency: Currency.GTQ,
        type: TransactionType.payout,
      };

      mockPrismaService.transaction.create.mockResolvedValue({
        ...mockTransaction,
        metadata: null,
      });

      const result = await service.create(createDto, mockMerchant);

      expect(result).toBeDefined();
      expect(mockPrismaService.transaction.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated transactions', async () => {
      const query = {
        page: 1,
        limit: 10,
      };

      const mockTransactions = [mockTransaction];
      mockPrismaService.transaction.findMany.mockResolvedValue(
        mockTransactions,
      );
      mockPrismaService.transaction.count.mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(result).toEqual({
        data: mockTransactions,
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          total_pages: 1,
        },
      });
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should filter by merchant_id', async () => {
      const query = {
        merchant_id: 'merchant-uuid-123',
        page: 1,
        limit: 10,
      };

      mockPrismaService.transaction.findMany.mockResolvedValue([
        mockTransaction,
      ]);
      mockPrismaService.transaction.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: { merchant_id: 'merchant-uuid-123' },
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should filter by status', async () => {
      const query = {
        status: TransactionStatus.approved,
        page: 1,
        limit: 10,
      };

      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: { status: TransactionStatus.approved },
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should calculate pagination correctly', async () => {
      const query = {
        page: 3,
        limit: 20,
      };

      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(100);

      const result = await service.findAll(query);

      expect(result.meta).toEqual({
        total: 100,
        page: 3,
        limit: 20,
        total_pages: 5,
      });
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 40,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a transaction by id', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(
        mockTransaction,
      );

      const result = await service.findOne('transaction-uuid-123');

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaService.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'transaction-uuid-123' },
      });
    });

    it('should throw NotFoundException if transaction not found', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status from pending to approved', async () => {
      const updateDto = { status: TransactionStatus.approved };

      mockPrismaService.transaction.findUnique.mockResolvedValue(
        mockTransaction,
      );
      mockPrismaService.transaction.update.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.approved,
      });

      const result = await service.updateStatus('transaction-uuid-123', updateDto);

      expect(result.status).toBe(TransactionStatus.approved);
      expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'transaction-uuid-123' },
        data: { status: TransactionStatus.approved },
      });
      expect(mockClientProxy.emit).toHaveBeenCalledWith(
        'transaction_status_updated',
        expect.objectContaining({
          transaction_id: 'transaction-uuid-123',
          merchant_id: 'merchant-uuid-123',
          event_type: 'transaction.approved',
        }),
      );
    });

    it('should update status from approved to completed', async () => {
      const approvedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.approved,
      };
      const updateDto = { status: TransactionStatus.completed };

      mockPrismaService.transaction.findUnique.mockResolvedValue(
        approvedTransaction,
      );
      mockPrismaService.transaction.update.mockResolvedValue({
        ...approvedTransaction,
        status: TransactionStatus.completed,
      });

      const result = await service.updateStatus('transaction-uuid-123', updateDto);

      expect(result.status).toBe(TransactionStatus.completed);
    });

    it('should throw error for invalid transition from pending to completed', async () => {
      const updateDto = { status: TransactionStatus.completed };

      mockPrismaService.transaction.findUnique.mockResolvedValue(
        mockTransaction,
      );

      await expect(
        service.updateStatus('transaction-uuid-123', updateDto),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw error for invalid transition from completed to approved', async () => {
      const completedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.completed,
      };
      const updateDto = { status: TransactionStatus.approved };

      mockPrismaService.transaction.findUnique.mockResolvedValue(
        completedTransaction,
      );

      await expect(
        service.updateStatus('transaction-uuid-123', updateDto),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw error for invalid transition from rejected', async () => {
      const rejectedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.rejected,
      };
      const updateDto = { status: TransactionStatus.approved };

      mockPrismaService.transaction.findUnique.mockResolvedValue(
        rejectedTransaction,
      );

      await expect(
        service.updateStatus('transaction-uuid-123', updateDto),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('remove', () => {
    it('should delete a transaction', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(
        mockTransaction,
      );
      mockPrismaService.transaction.delete.mockResolvedValue(mockTransaction);

      const result = await service.remove('transaction-uuid-123');

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaService.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'transaction-uuid-123' },
      });
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
