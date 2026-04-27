import { Controller, Post, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { GetMerchant } from '../common/decorators/get-merchant.decorator';
import { type Merchant } from '@prisma/client';
import { ApiTags, ApiSecurity, ApiOperation } from '@nestjs/swagger';

@ApiTags('Settlements')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generar liquidación de transacciones aprobadas' })
  generate(@GetMerchant() merchant: Merchant) {
    return this.settlementsService.generate(merchant);
  }

  @Get()
  @ApiOperation({ summary: 'Listar mis liquidaciones' })
  findAll(@GetMerchant() merchant: Merchant) {
    return this.settlementsService.findAll(merchant.id);
  }
}
