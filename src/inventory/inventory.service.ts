import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

    // DTO의 string ID를 ObjectId로 변환
    const productObjectId = new Types.ObjectId(productId);

    // 2. 재고 도큐먼트 조회 (없으면 생성)
    let inventory = await this.inventoryModel.findOne({ product: productObjectId });

    if (!inventory) {
      inventory = new this.inventoryModel({
        product: productObjectId,
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
   * 성능 최적화: findAll() 대신 findByBarcode()를 사용하여 DB 부하를 최소화함
   */
  async sales(dto: CreateSalesDto): Promise<Inventory> {
    const { barcode, quantity } = dto;

    // 1. 바코드로 상품 ID 찾기 (O(1) 성능 최적화 적용)
    const product = await this.productsService.findByBarcode(barcode);

    // 2. 재고 조회 및 수량 검증
    // Product 객체의 _id를 안전하게 ObjectId로 사용하여 조회
    const inventory = await this.inventoryModel.findOne({ product: (product as any)._id });

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

    // DTO의 string ID를 ObjectId로 변환
    const productObjectId = new Types.ObjectId(productId);

    const inventory = await this.inventoryModel.findOne({ product: productObjectId });
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

  /**
   * [모니터링] 유통기한 임박 상품 조회
   * 기준일(오늘)로부터 지정된 일수(days) 이내에 만료되는 배치가 있는 상품들을 조회
   * 리스크 관리를 위해 잔여 유통기한이 짧은 상품을 선별하여 제공
   */
  async findExpiring(days: number): Promise<any[]> {
    const today = new Date();
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + days);

    // MongoDB Aggregation Pipeline을 사용하여 효율적으로 필터링
    return this.inventoryModel.aggregate([
      { $unwind: '$batches' }, // 배치를 낱개 도큐먼트로 분해
      {
        $match: {
          'batches.expiryDate': {
            $gte: today, // 오늘 이후 (이미 만료된 건 제외할 경우)
            $lte: targetDate, // N일 후 이전
          },
          'batches.quantity': { $gt: 0 }, // 재고가 있는 것만
        },
      },
      {
        $lookup: {
          // 상품 정보 조인 (Join)
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: '$productInfo' },
      {
        $project: {
          // 클라이언트에 필요한 핵심 정보만 선택적으로 반환
          productName: '$productInfo.name',
          barcode: '$productInfo.barcode',
          expiryDate: '$batches.expiryDate',
          quantity: '$batches.quantity',
        },
      },
    ]);
  }
}