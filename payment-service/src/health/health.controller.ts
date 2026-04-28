import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    const result = await this.health.check([
      () => this.db.pingCheck('database', this.prisma),
    ]);

    // Formato exacto requerido por la prueba
    return {
      status: result.status === 'error' ? 'error' : 'ok',
      service: 'payment-service',
      uptime: process.uptime(),
      database: result.status === 'ok' ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}