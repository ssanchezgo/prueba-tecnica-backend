import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key faltante en los headers');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { api_key: apiKey },
    });

    if (!merchant || merchant.status !== 'active') {
      throw new UnauthorizedException('API Key inválida o merchant inactivo');
    }

    request['merchant'] = merchant;
    return true;
  }
}
