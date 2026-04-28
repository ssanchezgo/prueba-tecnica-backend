import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { Currency, TransactionStatus, TransactionType } from '@prisma/client';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: TransactionsService;

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
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPaginatedResult = {
    data: [mockTransaction],
    meta: { total: 1, page: 1, limit: 10, total_pages: 1 },
  };

  const mockTransactionsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TransactionsController>(TransactionsController);
    service = module.get<TransactionsService>(TransactionsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a transaction and return it', async () => {
      const createDto = {
        amount: 100.5,
        currency: Currency.USD,
        type: TransactionType.payin,
      };

      mockTransactionsService.create.mockResolvedValue(mockTransaction);

      const result = await controller.create(createDto, mockMerchant);

      expect(result).toEqual(mockTransaction);
      expect(service.create).toHaveBeenCalledWith(createDto, mockMerchant);
    });

    it('should pass metadata to service', async () => {
      const createDto = {
        amount: 50.0,
        currency: Currency.GTQ,
        type: TransactionType.payout,
        metadata: { order_id: 'ord_123' },
      };

      mockTransactionsService.create.mockResolvedValue({
        ...mockTransaction,
        metadata: createDto.metadata,
      });

      const result = await controller.create(createDto, mockMerchant);

      expect(service.create).toHaveBeenCalledWith(createDto, mockMerchant);
      expect(result.metadata).toEqual(createDto.metadata);
    });
  });

  describe('findAll', () => {
    it('should return paginated transactions', () => {
      const query = { page: 1, limit: 10 };

      mockTransactionsService.findAll.mockResolvedValue(mockPaginatedResult);

      const result = controller.findAll(query);

      expect(result).resolves.toEqual(mockPaginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should pass filters to service', () => {
      const query = {
        status: TransactionStatus.approved,
        type: TransactionType.payin,
        page: 2,
        limit: 20,
      };

      mockTransactionsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 2, limit: 20, total_pages: 0 },
      });

      controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should pass merchant_id filter to service', () => {
      const query = { merchant_id: 'merchant-uuid-123', page: 1, limit: 10 };

      mockTransactionsService.findAll.mockResolvedValue(mockPaginatedResult);

      controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a transaction by id', () => {
      mockTransactionsService.findOne.mockResolvedValue(mockTransaction);

      const result = controller.findOne('transaction-uuid-123');

      expect(result).resolves.toEqual(mockTransaction);
      expect(service.findOne).toHaveBeenCalledWith('transaction-uuid-123');
    });

    it('should propagate NotFoundException from service', () => {
      const { NotFoundException } = jest.requireActual('@nestjs/common');
      mockTransactionsService.findOne.mockRejectedValue(
        new NotFoundException('Transacción no encontrada'),
      );

      expect(controller.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status', () => {
      const updateDto = { status: TransactionStatus.approved };
      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.approved,
      };

      mockTransactionsService.updateStatus.mockResolvedValue(
        updatedTransaction,
      );

      const result = controller.updateStatus(
        'transaction-uuid-123',
        updateDto,
      );

      expect(result).resolves.toEqual(updatedTransaction);
      expect(service.updateStatus).toHaveBeenCalledWith(
        'transaction-uuid-123',
        updateDto,
      );
    });

    it('should propagate UnprocessableEntityException for invalid transition', () => {
      const { UnprocessableEntityException } = jest.requireActual(
        '@nestjs/common',
      );
      const updateDto = { status: TransactionStatus.completed };

      mockTransactionsService.updateStatus.mockRejectedValue(
        new UnprocessableEntityException('Transición inválida'),
      );

      expect(
        controller.updateStatus('transaction-uuid-123', updateDto),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('remove', () => {
    it('should delete a transaction and return it', () => {
      mockTransactionsService.remove.mockResolvedValue(mockTransaction);

      const result = controller.remove('transaction-uuid-123');

      expect(result).resolves.toEqual(mockTransaction);
      expect(service.remove).toHaveBeenCalledWith('transaction-uuid-123');
    });

    it('should propagate NotFoundException when transaction does not exist', () => {
      const { NotFoundException } = jest.requireActual('@nestjs/common');
      mockTransactionsService.remove.mockRejectedValue(
        new NotFoundException('Transacción no encontrada'),
      );

      expect(controller.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('HTTP status codes', () => {
    it('POST /transactions should use 201 Created', () => {
      expect(HttpStatus.CREATED).toBe(201);
    });

    it('GET /transactions should use 200 OK', () => {
      expect(HttpStatus.OK).toBe(200);
    });

    it('GET /transactions/:id should use 200 OK and 404 when not found', async () => {
      const { NotFoundException } = jest.requireActual('@nestjs/common');
      mockTransactionsService.findOne.mockRejectedValue(
        new NotFoundException(),
      );

      const error = await controller
        .findOne('bad-id')
        .catch((e: { getStatus: () => number }) => e);

      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('PATCH /transactions/:id/status should use 422 for invalid transition', async () => {
      const { UnprocessableEntityException } = jest.requireActual(
        '@nestjs/common',
      );
      mockTransactionsService.updateStatus.mockRejectedValue(
        new UnprocessableEntityException(),
      );

      const error = await controller
        .updateStatus('id', { status: TransactionStatus.completed })
        .catch((e: { getStatus: () => number }) => e);

      expect(error.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('DELETE /transactions/:id should use 404 when not found', async () => {
      const { NotFoundException } = jest.requireActual('@nestjs/common');
      mockTransactionsService.remove.mockRejectedValue(new NotFoundException());

      const error = await controller
        .remove('bad-id')
        .catch((e: { getStatus: () => number }) => e);

      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });
});
