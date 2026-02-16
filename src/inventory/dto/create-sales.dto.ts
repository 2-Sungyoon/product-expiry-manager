import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateSalesDto {
  @IsString()
  @IsNotEmpty()
  barcode: string; // POS에서는 상품 ID가 아닌 바코드가 넘어옴

  @IsInt()
  @Min(1)
  quantity: number;
}