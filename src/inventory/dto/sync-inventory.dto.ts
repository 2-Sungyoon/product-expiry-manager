import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsMongoId, IsArray, ValidateNested, Min } from 'class-validator';

class BatchDto {
  @IsDateString()
  expiryDate: string;

  @IsInt()
  @Min(0)
  quantity: number;
}

export class SyncInventoryDto {
  @IsMongoId()
  productId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchDto)
  realBatches: BatchDto[];
}