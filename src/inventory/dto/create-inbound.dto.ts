import { IsDateString, IsInt, IsMongoId, Min } from 'class-validator';

export class CreateInboundDto {
  @IsMongoId()
  productId: string;

  @IsDateString() // ISO 8601 형식 (YYYY-MM-DD)
  expiryDate: string;

  @IsInt()
  @Min(1)
  quantity: number;
}