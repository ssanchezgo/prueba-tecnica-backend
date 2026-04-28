import { Test, TestingModule } from '@nestjs/testing';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { SettlementStatus } from '@prisma/client';

describe('SettlementsController', () => {
  let controller: SettlementsController;
  let service: SettlementsService;

  const mockMerchant = {
    id: 'merchant-uuid-123',
    name: 'Test Merchant',
    email: 'test@merchant.com',
    api_key: 'test-api-key',
    status: 'active' as const,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSettlement = {
    id: 'settlement-uuid-123',
    merchant_id: 'merchant-uuid-123',
    total_amount: 1250.75,
    transaction_count: 15,
    status: SettlementStatus.pending,
    period_start: new Date('2026-01-20'),
    period_end: new Date('2026-01-28'),
    created_at: new Date(),
  };

  const mockSettlementsService = {
    generate: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettlementsController],
      providers: [
        {
          provide: SettlementsService,
          useValue: mockSettlementsService,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SettlementsController>(SettlementsController);
    service = module.get<SettlementsService>(SettlementsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generate', () => {
    it('should generate a settlement and return it', async () => {
      mockSettlementsService.generate.mockResolvedValue(mockSettlement);

      const result = await controller.generate(mockMerchant);

      expect(result).toEqual(mockSettlement);
      expect(service.generate).toHaveBeenCalledWith(mockMerchant);
    });

    it('should propagate UnprocessableEntityException when no approved transactions', async () => {
      const { UnprocessableEntityException } = jest.requireActual(
        '@nestjs/common',
      );
      mockSettlementsService.generate.mockRejectedValue(
        new UnprocessableEntityException(
          'No hay transacciones aprobadas para liquidar.',
        ),
      );

      await expect(controller.generate(mockMerchant)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should return settlement with correct merchant_id', async () => {
      mockSettlementsService.generate.mockResolvedValue(mockSettlement);

      const result = await controller.generate(mockMerchant);

      expect(result.merchant_id).toBe(mockMerchant.id);
    });

    it('should return settlement with pending status', async () => {
      mockSettlementsService.generate.mockResolvedValue(mockSettlement);

      const result = await controller.generate(mockMerchant);

      expect(result.status).toBe(SettlementStatus.pending);
    });
  });

  describe('findAll', () => {
    it('should return all settlements for the authenticated merchant', async () => {
      const mockSettlements = [
        mockSettlement,
        { ...mockSettlement, id: 'settlement-uuid-456', total_amount: 500.0 },
      ];

      mockSettlementsService.findAll.mockResolvedValue(mockSettlements);

      const result = await controller.findAll(mockMerchant);

      expect(result).toEqual(mockSettlements);
      expect(service.findAll).toHaveBeenCalledWith(mockMerchant.id);
    });

    it('should return empty array when no settlements exist', async () => {
      mockSettlementsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockMerchant);

      expect(result).toEqual([]);
      expect(service.findAll).toHaveBeenCalledWith(mockMerchant.id);
    });

    it('should use merchant.id from the authenticated merchant', async () => {
      mockSettlementsService.findAll.mockResolvedValue([]);

      await controller.findAll(mockMerchant);

      expect(service.findAll).toHaveBeenCalledWith('merchant-uuid-123');
    });
  });
});
