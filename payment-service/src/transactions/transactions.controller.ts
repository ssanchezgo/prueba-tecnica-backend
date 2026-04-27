import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ApiSecurity } from '@nestjs/swagger';
import { GetMerchant } from 'src/common/decorators/get-merchant.decorator';
import { type Merchant } from '@prisma/client';

@ApiTags('Transactions')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva transacción' })
  @ApiResponse({ status: 201, description: 'Transacción creada exitosamente.' })
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
    @GetMerchant() merchant: Merchant,
  ) {
    return this.transactionsService.create(createTransactionDto, merchant);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de transacciones con filtros y paginación',
  })
  findAll(@Query() query: QueryTransactionDto) {
    return this.transactionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una transacción por ID' })
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Actualizar el estado de una transacción (Máquina de estados)',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.transactionsService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una transacción' })
  remove(@Param('id') id: string) {
    return this.transactionsService.remove(id);
  }
}
