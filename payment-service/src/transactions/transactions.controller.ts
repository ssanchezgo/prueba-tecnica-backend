import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { Transaction } from '@prisma/client';
import { QueryTransactionDto } from './dto/query-transaction.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    return await this.transactionsService.create(createTransactionDto);
  }

  @Get()
  async findAll(@Query() query: QueryTransactionDto): Promise<Transaction[]> {
    return await this.transactionsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Transaction> {
    return await this.transactionsService.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateStatusDto,
  ): Promise<Transaction> {
    return await this.transactionsService.updateStatus(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Transaction> {
    return await this.transactionsService.remove(id);
  }
}
