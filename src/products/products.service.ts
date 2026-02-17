import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  // 상품 등록 로직
  async create(createProductDto: CreateProductDto): Promise<Product> {
    const { barcode } = createProductDto;

    // 1. 바코드 중복 검사 (DB에서 처리되지만, 명시적인 에러 처리를 위해 확인)
    const existingProduct = await this.productModel.findOne({ barcode });
    if (existingProduct) {
      throw new ConflictException(`Product with barcode ${barcode} already exists.`);
    }

    // 2. 상품 생성
    const createdProduct = new this.productModel(createProductDto);
    return createdProduct.save();
  }

  // 전체 상품 목록 조회
  async findAll(): Promise<Product[]> {
    // 최신 등록순으로 정렬하여 반환
    return this.productModel.find().sort({ createdAt: -1 }).exec();
  }

  // 특정 상품 상세 조회
  async findOne(id: string): Promise<Product> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  // 바코드로 단일 상품 조회 (O(1) 성능 최적화용)
  async findByBarcode(barcode: string): Promise<ProductDocument> {
    const product = await this.productModel.findOne({ barcode }).exec();
    if (!product) {
      throw new NotFoundException(`Product with barcode ${barcode} not found`);
    }
    return product;
  }
}