import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // MongoDB 연결(로컬 DB 주소)
    MongooseModule.forRoot('mongodb://localhost:27017/punta'),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}