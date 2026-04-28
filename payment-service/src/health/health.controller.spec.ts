import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockPrismaService = {
    merchant: {
      findFirst: jest.fn(),
    },
  };

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return database status up when DB is reachable', async () => {
      mockPrismaService.merchant.findFirst.mockResolvedValue(null);

      // Simulate HealthCheckService executing the indicator callback
      mockHealthCheckService.check.mockImplementation(
        async (indicators: (() => Promise<object>)[]) => {
          const result = await indicators[0]();
          return { status: 'ok', info: result, error: {}, details: result };
        },
      );

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.info).toEqual({ database: { status: 'up' } });
    });

    it('should return database status down when DB throws an error', async () => {
      mockPrismaService.merchant.findFirst.mockRejectedValue(
        new Error('Connection refused'),
      );

      mockHealthCheckService.check.mockImplementation(
        async (indicators: (() => Promise<object>)[]) => {
          const result = await indicators[0]();
          return { status: 'error', info: {}, error: result, details: result };
        },
      );

      const result = await controller.check();

      expect(result.status).toBe('error');
      expect(result.error).toEqual({
        database: { status: 'down', message: 'Connection refused' },
      });
    });

    it('should handle non-Error exceptions with Unknown error message', async () => {
      mockPrismaService.merchant.findFirst.mockRejectedValue('string error');

      mockHealthCheckService.check.mockImplementation(
        async (indicators: (() => Promise<object>)[]) => {
          const result = await indicators[0]();
          return { status: 'error', info: {}, error: result, details: result };
        },
      );

      const result = await controller.check();

      expect(result.error).toEqual({
        database: { status: 'down', message: 'Unknown error' },
      });
    });

    it('should delegate to HealthCheckService.check', async () => {
      mockHealthCheckService.check.mockResolvedValue({
        status: 'ok',
        info: {},
        error: {},
        details: {},
      });

      await controller.check();

      expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1);
      expect(mockHealthCheckService.check).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Function)]),
      );
    });
  });

  describe('HTTP status codes', () => {
    it('GET /health should return 200 when database is up', async () => {
      mockPrismaService.merchant.findFirst.mockResolvedValue(null);
      mockHealthCheckService.check.mockResolvedValue({
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: {},
      });

      const result = await controller.check();

      expect(result.status).toBe('ok');
      // 200 OK is the expected HTTP status for a healthy service
      expect(HttpStatus.OK).toBe(200);
    });

    it('GET /health should return 503 when database is down', async () => {
      // @nestjs/terminus throws ServiceUnavailableException (503)
      // when any health indicator returns status 'down'
      const { ServiceUnavailableException } = jest.requireActual(
        '@nestjs/common',
      );
      mockHealthCheckService.check.mockRejectedValue(
        new ServiceUnavailableException(),
      );

      const error = await controller
        .check()
        .catch((e: { getStatus: () => number }) => e);

      expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE); // 503
    });
  });
});
