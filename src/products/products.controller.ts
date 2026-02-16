import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // POST /products
  // 상품 등록 API: 관리자가 새로운 상품을 시스템에 등록
  @Post()
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  // GET /products
  // 상품 전체 목록 조회 API
  @Get()
  async findAll() {
    return this.productsService.findAll();
  }

  // GET /products/:id
  // 상품 상세 조회 API: 특정 상품의 정보를 ID로 조회
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
}