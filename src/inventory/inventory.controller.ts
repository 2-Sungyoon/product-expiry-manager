import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInboundDto } from './dto/create-inbound.dto';
import { CreateSalesDto } from './dto/create-sales.dto';
import { SyncInventoryDto } from './dto/sync-inventory.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // 입고 등록 API
  @Post('inbound')
  async inbound(@Body() dto: CreateInboundDto) {
    return this.inventoryService.inbound(dto);
  }

  // 판매 처리 API (POS 연동)
  @Post('sales')
  async sales(@Body() dto: CreateSalesDto) {
    return this.inventoryService.sales(dto);
  }

  // 재고 실사 동기화 API
  @Patch('sync')
  async sync(@Body() dto: SyncInventoryDto) {
    return this.inventoryService.sync(dto);
  }

  // 유통기한 임박 상품 조회 API
  // 예: GET /inventory/expiring?days=3 (기본값 3일)
  @Get('expiring')
  async findExpiring(@Query('days') days: number = 3) {
    return this.inventoryService.findExpiring(Number(days));
  }
}