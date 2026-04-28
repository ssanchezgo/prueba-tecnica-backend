import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from './prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockNotificationData = {
    transaction_id: 'tx-uuid-123',
    merchant_id: 'merchant-uuid-123',
    event_type: 'transaction.approved',
    payload: {
      id: 'tx-uuid-123',
      status: 'approved',
      amount: 100.5,
    },
  };

  const mockNotification = {
    id: 'notification-uuid-123',
    transaction_id: 'tx-uuid-123',
    merchant_id: 'merchant-uuid-123',
    event_type: 'transaction.approved',
    payload: mockNotificationData.payload,
    status: 'sent',
    attempts: 1,
    created_at: new Date(),
  };

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(service.getHello()).toBe('Hello World!');
    });
  });

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      const result = await service.createNotification(mockNotificationData);

      expect(result).toEqual(mockNotification);
      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: {
          transaction_id: mockNotificationData.transaction_id,
          merchant_id: mockNotificationData.merchant_id,
          event_type: mockNotificationData.event_type,
          payload: mockNotificationData.payload,
          status: 'sent',
          attempts: 1,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrismaService.notification.create.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.createNotification(mockNotificationData);

      expect(result).toBeUndefined();
    });

    it('should log error when creation fails', async () => {
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      mockPrismaService.notification.create.mockRejectedValue(
        new Error('Database error'),
      );

      await service.createNotification(mockNotificationData);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Error al guardar la notificación',
        expect.any(String),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      const mockNotifications = [mockNotification];
      mockPrismaService.notification.findMany.mockResolvedValue(
        mockNotifications,
      );
      mockPrismaService.notification.count.mockResolvedValue(1);

      const result = await service.findAll('merchant-uuid-123', 1, 20);

      expect(result).toEqual({
        data: mockNotifications,
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          total_pages: 1,
        },
      });
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { merchant_id: 'merchant-uuid-123' },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should use default pagination values', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(0);

      await service.findAll('merchant-uuid-123');

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { merchant_id: 'merchant-uuid-123' },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should calculate pagination correctly', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(100);

      const result = await service.findAll('merchant-uuid-123', 3, 10);

      expect(result.meta).toEqual({
        total: 100,
        page: 3,
        limit: 10,
        total_pages: 10,
      });
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { merchant_id: 'merchant-uuid-123' },
        skip: 20,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should order notifications by created_at desc', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(0);

      await service.findAll('merchant-uuid-123');

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a notification by id', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue(
        mockNotification,
      );

      const result = await service.findOne('notification-uuid-123');

      expect(result).toEqual(mockNotification);
      expect(mockPrismaService.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notification-uuid-123' },
      });
    });

    it('should return null if notification not found', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id');

      expect(result).toBeNull();
    });
  });
});
