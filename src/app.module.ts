import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [
    // MongoDB 연결(로컬 DB 주소)
    MongooseModule.forRoot('mongodb://localhost:27017/punta'),
    ProductsModule,
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}