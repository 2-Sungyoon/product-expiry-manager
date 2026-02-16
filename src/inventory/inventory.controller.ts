import { Body, Controller, Patch, Post } from '@nestjs/common';
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
}