import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory, InventoryDocument } from './schemas/inventory.schema';
import { ProductsService } from '../products/products.service';
import { CreateInboundDto } from './dto/create-inbound.dto';
import { CreateSalesDto } from './dto/create-sales.dto';
import { SyncInventoryDto } from './dto/sync-inventory.dto';

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

  /**
   * [판매 처리 - 워터폴 차감 알고리즘]
   * 요청된 수량만큼 유통기한이 가장 임박한(오래된) 배치부터 순차적으로 차감
   * POS는 바코드만 보내므로, 바코드로 상품을 찾고 -> 재고를 찾고 -> 차감을 수행
   */
  async sales(dto: CreateSalesDto): Promise<Inventory> {
    const { barcode, quantity } = dto;

    // 1. 바코드로 상품 ID 찾기
    // (ProductsService에 findByBarcode가 없으므로 전체 조회 후 필터링)
    const products = await this.productsService.findAll();
    const product = products.find((p) => p.barcode === barcode);

    if (!product) {
      throw new NotFoundException(`Product with barcode ${barcode} not found`);
    }

    // 2. 재고 조회 및 수량 검증
    const inventory = await this.inventoryModel.findOne({ product: product._id });

    if (!inventory || inventory.totalQuantity < quantity) {
      throw new BadRequestException('Not enough stock');
    }

    // 3. 워터폴 차감
    let remainingQuantity = quantity;

    // 이미 입고 시점에 정렬되어 있으므로 0번 인덱스(가장 오래된 것)부터 순회
    for (let i = 0; i < inventory.batches.length; i++) {
      if (remainingQuantity <= 0) break;

      const batch = inventory.batches[i];
      if (batch.quantity > 0) {
        // 현재 배치에서 뺄 수 있는 만큼 뺌 (전부 다 빼거나, 필요한 만큼만 빼거나)
        const deduct = Math.min(batch.quantity, remainingQuantity);

        batch.quantity -= deduct;
        remainingQuantity -= deduct;
      }
    }

    // 4. 총 수량 업데이트 및 저장
    inventory.totalQuantity -= quantity;
    return inventory.save();
  }

  /**
   * [재고 동기화]
   * 관리자의 실사 데이터를 기준으로 시스템상의 가상 배치를 강제로 보정
   * 워터폴 차감으로 발생한 전산-실물 간의 괴리를 해소
   */
  async sync(dto: SyncInventoryDto): Promise<Inventory> {
    const { productId, realBatches } = dto;

    const inventory = await this.inventoryModel.findOne({ product: productId });
    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    // 1. 기존 배치를 무시하고 실사 데이터로 덮어씌움
    inventory.batches = realBatches.map((b) => ({
      expiryDate: new Date(b.expiryDate),
      quantity: b.quantity,
    }));

    // 2. 날짜순 재정렬 (데이터 일관성 유지)
    inventory.batches.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

    // 3. 총 수량 재계산
    inventory.totalQuantity = inventory.batches.reduce((sum, b) => sum + b.quantity, 0);

    return inventory.save();
  }
}