import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

interface NotificationData {
  transaction_id: string;
  merchant_id: string;
  event_type: string;
  payload: unknown;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async createNotification(data: NotificationData) {
    try {
      this.logger.log(
        `Registrando notificación para transacción: ${data.transaction_id}`,
      );

      return await this.prisma.notification.create({
        data: {
          transaction_id: data.transaction_id,
          merchant_id: data.merchant_id,
          event_type: data.event_type,
          payload: data.payload,
          status: 'sent',
          attempts: 1,
        },
      });
    } catch (error) {
      this.logger.error(
        'Error al guardar la notificación',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async findAll(merchantId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { merchant_id: merchantId },
        skip,
        take: Number(limit),
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.notification.count({ where: { merchant_id: merchantId } }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  findOne(id: string) {
    return this.prisma.notification.findUnique({ where: { id } });
  }
}
