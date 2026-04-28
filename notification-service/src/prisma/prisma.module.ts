import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AppController],
  providers: [NotificationsService],
})
export class AppModule {}
