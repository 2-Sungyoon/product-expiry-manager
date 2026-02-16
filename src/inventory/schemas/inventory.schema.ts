import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Product } from '../../products/schemas/product.schema';

// 가상 배치: 물리적으로 구분되지 않는 상품을 유통기한별로 논리적으로 그룹화한 객체
@Schema()
export class Batch {
  @Prop({ required: true })
  expiryDate: Date; // 소비기한

  @Prop({ required: true, min: 0 })
  quantity: number; // 해당 소비기한을 가진 수량
}
export const BatchSchema = SchemaFactory.createForClass(Batch);

export type InventoryDocument = Inventory & Document;

@Schema({ timestamps: true })
export class Inventory {
  // 어떤 상품의 재고인지 참조 (FK)
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, unique: true })
  product: Product;

  // 가상 배치 배열 (유통기한별 재고 목록)
  // RDBMS의 조인 비용을 없애고, 한 번의 조회로 재고 분포를 파악하기 위해 내장
  @Prop({ type: [BatchSchema], default: [] })
  batches: Batch[];

  // 전체 재고 수량 (검색 및 조회 성능 최적화를 위한 역정규화 필드)
  @Prop({ required: true, default: 0 })
  totalQuantity: number;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);

// 유통기한 임박 상품 검색 성능을 위해 인덱스 설정
InventorySchema.index({ 'batches.expiryDate': 1 });