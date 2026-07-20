import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { SalesService } from './sales.service';
import { CreateSaleDto, SaleQueryDto } from './dto/sale.dto';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: SaleQueryDto) {
    return this.sales.findAll(user.userId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sales.findOne(user.userId, id);
  }

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSaleDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.sales.create(user.userId, dto, idempotencyKey?.trim() || undefined);
  }
}
