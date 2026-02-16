import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { Inventory, InventorySchema } from './schemas/inventory.schema';
import { ProductsModule } from '../products/products.module'; // 상품 정보 조회를 위해 필요

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Inventory.name, schema: InventorySchema }]),
    ProductsModule, // ProductService를 사용하기 위해 주입
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}