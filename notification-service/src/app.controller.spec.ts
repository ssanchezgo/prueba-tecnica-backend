import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { NotificationsService } from './notifications.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let controller: AppController;
  let service: NotificationsService;

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
      controllers: [AppController],
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    service = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(controller.getHello()).toBe('Hello World!');
    });

    it('should delegate to NotificationsService.getHello', () => {
      const spy = jest.spyOn(service, 'getHello').mockReturnValue('Hello World!');

      controller.getHello();

      expect(spy).toHaveBeenCalled();
    });

    it('should return a string', () => {
      expect(typeof controller.getHello()).toBe('string');
    });
  });
});
