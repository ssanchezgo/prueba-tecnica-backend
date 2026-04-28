import { Controller, Get } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller()
export class AppController {
  constructor(private readonly appService: NotificationsService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
