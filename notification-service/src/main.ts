import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('NotificationService');

  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: {
      host: process.env.REDIS_HOST || 'redis',
      port: 6379,
    },
  });

  await app.startAllMicroservices();
  const port = process.env.PORT || 3002;
  await app.listen(port);

  logger.log(
    `Notification Service is listening for events via Redis on host: ${process.env.REDIS_HOST || 'redis'}`,
  );
  logger.log(`Notification API is running on: http://localhost:${port}`);
}
void bootstrap();
