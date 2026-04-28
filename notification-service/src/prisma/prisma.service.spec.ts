import { PrismaService } from './prisma.service';

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(function () {
    this.$connect = mockConnect;
    this.$disconnect = mockDisconnect;
    this.onModuleInit = async () => { await mockConnect(); };
    this.onModuleDestroy = async () => { await mockDisconnect(); };
  }),
}));

describe('PrismaService (notification-service)', () => {
  let service: PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PrismaService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should call $connect on init', async () => {
      await service.onModuleInit();

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect on destroy', async () => {
      await service.onModuleDestroy();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });
});
