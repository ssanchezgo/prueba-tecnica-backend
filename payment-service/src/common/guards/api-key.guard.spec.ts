import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let prismaService: PrismaService;

  const mockMerchant = {
    id: 'merchant-uuid-123',
    name: 'Test Merchant',
    email: 'test@merchant.com',
    api_key: 'valid-api-key',
    status: 'active' as const,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPrismaService = {
    merchant: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true for valid API key', async () => {
      const mockRequest = {
        headers: {
          'x-api-key': 'valid-api-key',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      mockPrismaService.merchant.findUnique.mockResolvedValue(mockMerchant);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest['merchant']).toEqual(mockMerchant);
      expect(mockPrismaService.merchant.findUnique).toHaveBeenCalledWith({
        where: { api_key: 'valid-api-key' },
      });
    });

    it('should throw UnauthorizedException if API key is missing', async () => {
      const mockRequest = {
        headers: {},
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'API Key faltante en los headers',
      );
    });

    it('should throw UnauthorizedException if API key is invalid', async () => {
      const mockRequest = {
        headers: {
          'x-api-key': 'invalid-api-key',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      mockPrismaService.merchant.findUnique.mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'API Key inválida o merchant inactivo',
      );
    });

    it('should throw UnauthorizedException if merchant is inactive', async () => {
      const inactiveMerchant = {
        ...mockMerchant,
        status: 'inactiv' as const,
      };

      const mockRequest = {
        headers: {
          'x-api-key': 'valid-api-key',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      mockPrismaService.merchant.findUnique.mockResolvedValue(inactiveMerchant);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'API Key inválida o merchant inactivo',
      );
    });

    it('should attach merchant to request object', async () => {
      const mockRequest = {
        headers: {
          'x-api-key': 'valid-api-key',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      mockPrismaService.merchant.findUnique.mockResolvedValue(mockMerchant);

      await guard.canActivate(mockContext);

      expect(mockRequest['merchant']).toBeDefined();
      expect(mockRequest['merchant'].id).toBe(mockMerchant.id);
      expect(mockRequest['merchant'].api_key).toBe(mockMerchant.api_key);
    });
  });

  describe('HTTP status codes', () => {
    const makeContext = (apiKey?: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ headers: apiKey ? { 'x-api-key': apiKey } : {} }),
        }),
      }) as ExecutionContext;

    it('should return 401 when API key is missing', async () => {
      const error = await guard
        .canActivate(makeContext())
        .catch((e: UnauthorizedException) => e);

      expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 when API key is invalid', async () => {
      mockPrismaService.merchant.findUnique.mockResolvedValue(null);

      const error = await guard
        .canActivate(makeContext('bad-key'))
        .catch((e: UnauthorizedException) => e);

      expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 when merchant is inactive', async () => {
      mockPrismaService.merchant.findUnique.mockResolvedValue({
        ...mockMerchant,
        status: 'inactiv' as const,
      });

      const error = await guard
        .canActivate(makeContext('valid-api-key'))
        .catch((e: UnauthorizedException) => e);

      expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });
  });
});
