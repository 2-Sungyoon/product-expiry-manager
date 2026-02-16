import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true }) // 생성일(createdAt), 수정일(updatedAt) 자동 관리
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  category: string; // 예: 'Dairy', 'Beverage'

  @Prop({ required: true })
  price: number;

  // 바코드는 상품의 고유 식별자이므로 유니크 인덱스를 걸어 중복 등록을 차단함
  @Prop({ required: true, unique: true })
  barcode: string;

  @Prop()
  description: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);