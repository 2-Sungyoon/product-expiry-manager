import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory, InventoryDocument } from './schemas/inventory.schema';
import { ProductsService } from '../products/products.service';
import { CreateInboundDto } from './dto/create-inbound.dto';
import { CreateSalesDto } from './dto/create-sales.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * [입고 처리]
   * 새로운 상품이 들어오면 유통기한별 배치를 생성하거나 기존 배치에 합산
   * 항상 유통기한 오름차순(FEFO) 정렬 상태를 유지하여 판매 로직의 성능을 보장
   */
  async inbound(dto: CreateInboundDto): Promise<Inventory> {
    const { productId, expiryDate, quantity } = dto;

    // 1. 유효한 상품인지 검증
    await this.productsService.findOne(productId);

    // 2. 재고 도큐먼트 조회 (없으면 생성)
    let inventory = await this.inventoryModel.findOne({ product: productId });

    if (!inventory) {
      inventory = new this.inventoryModel({
        product: productId,
        batches: [],
        totalQuantity: 0,
      });
    }

    // 3. 배치 처리 로직
    const newExpiryDate = new Date(expiryDate);
    const existingBatchIndex = inventory.batches.findIndex(
      (b) => b.expiryDate.getTime() === newExpiryDate.getTime(),
    );

    if (existingBatchIndex > -1) {
      // 이미 같은 유통기한의 배치가 있다면 수량만 합산
      inventory.batches[existingBatchIndex].quantity += quantity;
    } else {
      // 새로운 배치라면 추가
      inventory.batches.push({
        expiryDate: newExpiryDate,
        quantity: quantity,
      });
    }

    // 4. 유통기한 오름차순 정렬 (FEFO 준비)
    // 판매 시 항상 앞쪽 인덱스(0번)부터 꺼내면 되도록 미리 정렬해둠
    inventory.batches.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

    // 5. 총 수량 업데이트 (역정규화 필드 동기화)
    inventory.totalQuantity += quantity;

    return inventory.save();
  }
}
